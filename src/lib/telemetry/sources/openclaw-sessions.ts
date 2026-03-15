import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";

import { OPENCLAW_DIR } from "@/lib/paths";
import {
  TELEMETRY_DEGRADATION_CODE,
  TELEMETRY_DEGRADATION_SECTION,
  type AgentSessionTelemetry,
  type TelemetryDegradation,
} from "@/lib/telemetry/types";

const OPENCLAW_EXECUTABLE = "openclaw";
const OPENCLAW_SESSIONS_ARGS = ["sessions", "--all-agents", "--json"] as const;
const ONLINE_WINDOW_MS = 2 * 60 * 1000;
const OPENCLAW_SESSIONS_TIMEOUT_MS = Number(process.env.OPENCLAW_SESSIONS_TIMEOUT_MS ?? "20000");

interface OpenClawSession {
  key: string;
  updatedAt: number;
  ageMs: number;
}

interface OpenClawSessionsOutput {
  sessions?: OpenClawSession[];
}

interface SessionRunnerOptions {
  timeout: number;
  encoding: "utf-8";
}

type SessionRunner = (
  file: string,
  args: readonly string[],
  options: SessionRunnerOptions,
) => string;

export interface OpenClawSessionsSourceResult {
  sessions: AgentSessionTelemetry[];
  degraded: TelemetryDegradation[];
}

const EXCLUDED_SESSION_KEYS = ["agent:main:main"] as const;

export function getAgentIdFromSessionKey(key: string): string | null {
  const parts = key.split(":");
  if (parts.length < 3 || parts[0] !== "agent") {
    return null;
  }

  return parts[1] || null;
}

function isExcludedSessionKey(key: string): boolean {
  return EXCLUDED_SESSION_KEYS.includes(key as (typeof EXCLUDED_SESSION_KEYS)[number]);
}

export function classifySessionSourceError(error: unknown): TelemetryDegradation {
  if (error instanceof Error && /timed out/i.test(error.message)) {
    return {
      section: TELEMETRY_DEGRADATION_SECTION.SESSIONS,
      code: TELEMETRY_DEGRADATION_CODE.TIMEOUT,
      retriable: true,
      message: error.message,
    };
  }

  return {
    section: TELEMETRY_DEGRADATION_SECTION.SESSIONS,
    code: TELEMETRY_DEGRADATION_CODE.SOURCE_UNAVAILABLE,
    retriable: true,
    message: error instanceof Error ? error.message : "Failed to execute openclaw sessions",
  };
}

export function aggregateSessionsByAgent(
  normalizedSessions: { key: string; updatedAt: number; ageMs: number }[],
): AgentSessionTelemetry[] {
  const perAgent = new Map<string, AgentSessionTelemetry>();

  for (const session of normalizedSessions) {
    const agentId = getAgentIdFromSessionKey(session.key);
    if (!agentId) {
      continue;
    }

    const current = perAgent.get(agentId) ?? {
      id: agentId,
      freshSessions: 0,
      latestActivity: undefined,
    };

    if (session.ageMs < ONLINE_WINDOW_MS) {
      current.freshSessions += 1;
    }

    const sessionTimestamp = new Date(session.updatedAt).toISOString();
    if (!current.latestActivity) {
      current.latestActivity = sessionTimestamp;
    } else {
      const previousTime = new Date(current.latestActivity).getTime();
      const nextTime = new Date(sessionTimestamp).getTime();
      if (nextTime > previousTime) {
        current.latestActivity = sessionTimestamp;
      }
    }

    perAgent.set(agentId, current);
  }

  return Array.from(perAgent.values());
}

export function parseOpenClawSessionsOutput(rawOutput: string): AgentSessionTelemetry[] {
  const parsed = JSON.parse(rawOutput) as OpenClawSessionsOutput;
  const sessions = parsed.sessions ?? [];
  const now = Date.now();
  const normalized: { key: string; updatedAt: number; ageMs: number }[] = [];

  for (const session of sessions) {
    if (typeof session.key !== "string" || typeof session.updatedAt !== "number") {
      continue;
    }

    if (isExcludedSessionKey(session.key)) {
      continue;
    }

    const ageMs = typeof session.ageMs === "number" ? session.ageMs : now - session.updatedAt;
    normalized.push({ key: session.key, updatedAt: session.updatedAt, ageMs });
  }

  return aggregateSessionsByAgent(normalized);
}

function getOpenClawSessionsCliTelemetry(runCommand: SessionRunner = execFileSync): OpenClawSessionsSourceResult {
  try {
    const output = runCommand(OPENCLAW_EXECUTABLE, OPENCLAW_SESSIONS_ARGS, {
      timeout: OPENCLAW_SESSIONS_TIMEOUT_MS,
      encoding: "utf-8",
    });

    return {
      sessions: parseOpenClawSessionsOutput(output),
      degraded: [
        {
          section: TELEMETRY_DEGRADATION_SECTION.SESSIONS,
          code: TELEMETRY_DEGRADATION_CODE.SOURCE_UNAVAILABLE,
          retriable: false,
          message: "Session store unavailable, using CLI fallback",
        },
      ],
    };
  } catch (error) {
    return {
      sessions: [],
      degraded: [classifySessionSourceError(error)],
    };
  }
}

function getStoreSourceTelemetry(): OpenClawSessionsSourceResult {
  const agentsDir = path.join(OPENCLAW_DIR, "agents");

  if (!fs.existsSync(agentsDir)) {
    return {
      sessions: [],
      degraded: [
        {
          section: TELEMETRY_DEGRADATION_SECTION.SESSIONS,
          code: TELEMETRY_DEGRADATION_CODE.SOURCE_UNAVAILABLE,
          retriable: true,
          message: "Session store directory not available",
        },
      ],
    };
  }

  const degradations: TelemetryDegradation[] = [];
  const allNormalizedSessions: { key: string; updatedAt: number; ageMs: number }[] = [];
  const now = Date.now();

  let dirEntries: fs.Dirent[];
  try {
    dirEntries = fs.readdirSync(agentsDir, { withFileTypes: true });
  } catch (error) {
    return {
      sessions: [],
      degraded: [
        {
          section: TELEMETRY_DEGRADATION_SECTION.SESSIONS,
          code: TELEMETRY_DEGRADATION_CODE.SOURCE_UNAVAILABLE,
          retriable: true,
          message: error instanceof Error ? error.message : "Failed to read agents directory",
        },
      ],
    };
  }

  for (const entry of dirEntries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const agentId = entry.name;
    const sessionsPath = path.join(agentsDir, agentId, "sessions", "sessions.json");

    if (!fs.existsSync(sessionsPath)) {
      continue;
    }

    let fileContent: string;
    try {
      fileContent = fs.readFileSync(sessionsPath, "utf-8");
    } catch (error) {
      degradations.push({
        section: TELEMETRY_DEGRADATION_SECTION.SESSIONS,
        code: TELEMETRY_DEGRADATION_CODE.SOURCE_UNAVAILABLE,
        retriable: true,
        message: `Failed to read sessions.json for agent ${agentId}: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
      continue;
    }

    let parsed: { sessions?: { key: string; updatedAt: number; ageMs?: number }[] };
    try {
      parsed = JSON.parse(fileContent);
    } catch {
      degradations.push({
        section: TELEMETRY_DEGRADATION_SECTION.SESSIONS,
        code: TELEMETRY_DEGRADATION_CODE.VALIDATION_ERROR,
        retriable: true,
        message: `Failed to parse sessions.json for agent ${agentId}`,
      });
      continue;
    }

    const sessions = parsed.sessions ?? [];
    for (const session of sessions) {
      if (typeof session.key !== "string" || typeof session.updatedAt !== "number") {
        continue;
      }

      if (isExcludedSessionKey(session.key)) {
        continue;
      }

      const ageMs = typeof session.ageMs === "number" ? session.ageMs : now - session.updatedAt;
      allNormalizedSessions.push({ key: session.key, updatedAt: session.updatedAt, ageMs });
    }
  }

  const sessions = aggregateSessionsByAgent(allNormalizedSessions);

  return {
    sessions,
    degraded: degradations,
  };
}

export function getOpenClawSessionsTelemetry(runCommand: SessionRunner = execFileSync): OpenClawSessionsSourceResult {
  const storeResult = getStoreSourceTelemetry();

  const hasUsableData = storeResult.sessions.length > 0 || storeResult.degraded.length === 0;

  if (hasUsableData) {
    return storeResult;
  }

  const cliResult = getOpenClawSessionsCliTelemetry(runCommand);

  const allDegradations: TelemetryDegradation[] = [
    ...storeResult.degraded,
    ...cliResult.degraded,
  ];

  return {
    sessions: cliResult.sessions,
    degraded: allDegradations,
  };
}

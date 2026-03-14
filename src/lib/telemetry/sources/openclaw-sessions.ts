import { execSync } from "child_process";

import {
  TELEMETRY_DEGRADATION_CODE,
  TELEMETRY_DEGRADATION_SECTION,
  type AgentSessionTelemetry,
  type TelemetryDegradation,
} from "@/lib/telemetry/types";

const OPENCLAW_SESSIONS_COMMAND = "openclaw sessions --all-agents --json 2>/dev/null";
const ONLINE_WINDOW_MS = 2 * 60 * 1000;

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

type SessionRunner = (command: string, options: SessionRunnerOptions) => string;

export interface OpenClawSessionsSourceResult {
  sessions: AgentSessionTelemetry[];
  degraded: TelemetryDegradation[];
}

function getAgentIdFromSessionKey(key: string): string | null {
  const parts = key.split(":");
  if (parts.length < 3 || parts[0] !== "agent") {
    return null;
  }

  return parts[1] || null;
}

function classifySessionSourceError(error: unknown): TelemetryDegradation {
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

export function parseOpenClawSessionsOutput(rawOutput: string): AgentSessionTelemetry[] {
  const parsed = JSON.parse(rawOutput) as OpenClawSessionsOutput;
  const sessions = parsed.sessions ?? [];
  const perAgent = new Map<string, AgentSessionTelemetry>();

  for (const session of sessions) {
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

    if (typeof session.updatedAt === "number") {
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
    }

    perAgent.set(agentId, current);
  }

  return Array.from(perAgent.values());
}

export function getOpenClawSessionsTelemetry(runCommand: SessionRunner = execSync): OpenClawSessionsSourceResult {
  try {
    const output = runCommand(OPENCLAW_SESSIONS_COMMAND, {
      timeout: 10000,
      encoding: "utf-8",
    });

    return {
      sessions: parseOpenClawSessionsOutput(output),
      degraded: [],
    };
  } catch (error) {
    return {
      sessions: [],
      degraded: [classifySessionSourceError(error)],
    };
  }
}

import fs from "fs";
import path from "path";

import { OPENCLAW_DIR } from "@/lib/paths";
import {
  TELEMETRY_DEGRADATION_CODE,
  TELEMETRY_DEGRADATION_SECTION,
  type AgentSessionTelemetry,
  type TelemetryDegradation,
} from "@/lib/telemetry/types";

const ONLINE_WINDOW_MS = 2 * 60 * 1000;

interface RawStoreSession {
  key: string;
  updatedAt: number;
  ageMs: number;
}

interface StoreSessionsFile {
  sessions?: RawStoreSession[];
}

interface AgentStoreResult {
  agentId: string;
  sessions: RawStoreSession[];
  error?: string;
}

const EXCLUDED_SESSION_KEYS = ["agent:main:main"] as const;

export interface OpenClawSessionStoreSourceResult {
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

function isExcludedSessionKey(key: string): boolean {
  return EXCLUDED_SESSION_KEYS.includes(key as (typeof EXCLUDED_SESSION_KEYS)[number]);
}

export { getAgentIdFromSessionKey, isExcludedSessionKey };

function getAgentsDirectory(): string {
  return path.join(OPENCLAW_DIR, "agents");
}

function getAgentSessionsPath(agentId: string): string {
  return path.join(getAgentsDirectory(), agentId, "sessions", "sessions.json");
}

function loadAgentSessions(agentId: string): AgentStoreResult {
  const sessionsPath = getAgentSessionsPath(agentId);

  if (!fs.existsSync(sessionsPath)) {
    return { agentId, sessions: [] };
  }

  try {
    const content = fs.readFileSync(sessionsPath, "utf-8");
    const parsed: StoreSessionsFile = JSON.parse(content);
    const sessions = parsed.sessions ?? [];
    return { agentId, sessions };
  } catch (error) {
    return {
      agentId,
      sessions: [],
      error: error instanceof Error ? error.message : "Failed to parse sessions.json",
    };
  }
}

function discoverAgentIds(): string[] {
  const agentsDir = getAgentsDirectory();

  if (!fs.existsSync(agentsDir)) {
    return [];
  }

  try {
    const entries = fs.readdirSync(agentsDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  } catch {
    return [];
  }
}

function normalizeRawSession(
  session: RawStoreSession,
  now: number,
): { key: string; updatedAt: number; ageMs: number } | null {
  if (typeof session.key !== "string" || typeof session.updatedAt !== "number") {
    return null;
  }

  const ageMs = typeof session.ageMs === "number" ? session.ageMs : now - session.updatedAt;

  return {
    key: session.key,
    updatedAt: session.updatedAt,
    ageMs,
  };
}

export { normalizeRawSession };

function normalizeStoreSessions(
  sessions: RawStoreSession[],
): { key: string; updatedAt: number; ageMs: number }[] {
  const now = Date.now();
  const normalized: { key: string; updatedAt: number; ageMs: number }[] = [];

  for (const session of sessions) {
    if (!session || typeof session !== "object") {
      continue;
    }

    const normalizedSession = normalizeRawSession(session, now);
    if (!normalizedSession) {
      continue;
    }

    if (isExcludedSessionKey(normalizedSession.key)) {
      continue;
    }

    normalized.push(normalizedSession);
  }

  return normalized;
}

export { normalizeStoreSessions };

function aggregateSessionsByAgent(
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

export { aggregateSessionsByAgent };

function classifyStoreReadError(agentId: string, error: string): TelemetryDegradation {
  return {
    section: TELEMETRY_DEGRADATION_SECTION.SESSIONS,
    code: TELEMETRY_DEGRADATION_CODE.SOURCE_UNAVAILABLE,
    retriable: true,
    message: `Failed to read session store for agent ${agentId}: ${error}`,
  };
}

/**
 * Read session telemetry directly from OpenClaw session store files.
 * This is a faster alternative to the CLI-based source.
 * @returns OpenClawSessionStoreSourceResult with aggregated session telemetry
 */
export function getOpenClawSessionStoreTelemetry(): OpenClawSessionStoreSourceResult {
  const agentIds = discoverAgentIds();
  const degradations: TelemetryDegradation[] = [];
  const allNormalizedSessions: { key: string; updatedAt: number; ageMs: number }[] = [];

  for (const agentId of agentIds) {
    const result = loadAgentSessions(agentId);

    if (result.error) {
      degradations.push(classifyStoreReadError(agentId, result.error));
      continue;
    }

    if (result.sessions.length === 0) {
      continue;
    }

    const normalized = normalizeStoreSessions(result.sessions);
    allNormalizedSessions.push(...normalized);
  }

  const sessions = aggregateSessionsByAgent(allNormalizedSessions);

  return {
    sessions,
    degraded: degradations,
  };
}

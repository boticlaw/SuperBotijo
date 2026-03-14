import { getActivitiesTelemetrySummary } from "@/lib/telemetry/sources/activities";
import { getAgentsConfigTelemetry } from "@/lib/telemetry/sources/agents-config";
import { getOpenClawSessionsTelemetry } from "@/lib/telemetry/sources/openclaw-sessions";
import { TelemetryValidationError } from "@/lib/telemetry/errors";
import {
  AGENT_TELEMETRY_STATUS,
  TELEMETRY_DEGRADATION_CODE,
  TELEMETRY_DEGRADATION_SECTION,
  TELEMETRY_FRESHNESS_STATUS,
  type AgentIdentityTelemetry,
  type AgentSessionTelemetry,
  type AgentTelemetry,
  type DashboardTelemetryResponse,
  type TelemetryFreshness,
  type TelemetryDegradation,
} from "@/lib/telemetry/types";

const DEFAULT_STALENESS_THRESHOLD_SEC = 30;

interface DashboardSnapshotDependencies {
  now: () => Date;
  stalenessThresholdSec: number;
  getAgentsConfigTelemetry: typeof getAgentsConfigTelemetry;
  getActivitiesTelemetrySummary: typeof getActivitiesTelemetrySummary;
  getOpenClawSessionsTelemetry: typeof getOpenClawSessionsTelemetry;
}

function createSessionLookup(items: AgentSessionTelemetry[]): Map<string, AgentSessionTelemetry> {
  const lookup = new Map<string, AgentSessionTelemetry>();
  for (const item of items) {
    lookup.set(item.id, item);
  }
  return lookup;
}

function createUnknownSessionIdentityDegradation(
  identities: AgentIdentityTelemetry[],
  sessions: AgentSessionTelemetry[],
): TelemetryDegradation[] {
  const knownIds = new Set(identities.map((identity) => identity.id));
  const unknownSessionIds = sessions
    .filter((session) => !knownIds.has(session.id))
    .map((session) => session.id);

  if (unknownSessionIds.length === 0) {
    return [];
  }

  return [
    {
      section: TELEMETRY_DEGRADATION_SECTION.AGENTS,
      code: TELEMETRY_DEGRADATION_CODE.VALIDATION_ERROR,
      retriable: false,
      message: `Excluded ${unknownSessionIds.length} session identities not present in agent config: ${unknownSessionIds.join(", ")}`,
    },
  ];
}

function dedupeAgentIdentities(items: AgentIdentityTelemetry[]): AgentIdentityTelemetry[] {
  const deduped = new Map<string, AgentIdentityTelemetry>();
  for (const item of items) {
    if (!deduped.has(item.id)) {
      deduped.set(item.id, item);
    }
  }
  return Array.from(deduped.values());
}

function resolveAgentStatus(sessionData: AgentSessionTelemetry | undefined): AgentTelemetry["status"] {
  if (!sessionData || sessionData.freshSessions === 0) {
    return AGENT_TELEMETRY_STATUS.OFFLINE;
  }

  if (sessionData.freshSessions > 1) {
    return AGENT_TELEMETRY_STATUS.WORKING;
  }

  return AGENT_TELEMETRY_STATUS.ONLINE;
}

function buildFreshness(snapshotAt: Date, now: Date, stalenessThresholdSec: number): TelemetryFreshness {
  const snapshotAgeSec = Math.max(0, Math.floor((now.getTime() - snapshotAt.getTime()) / 1000));
  const status = snapshotAgeSec > stalenessThresholdSec
    ? TELEMETRY_FRESHNESS_STATUS.STALE
    : TELEMETRY_FRESHNESS_STATUS.FRESH;

  return {
    snapshotAt: snapshotAt.toISOString(),
    snapshotAgeSec,
    stalenessThresholdSec,
    status,
  };
}

function validateSnapshot(snapshot: DashboardTelemetryResponse): void {
  if (!Array.isArray(snapshot.agents)) {
    throw new TelemetryValidationError("Telemetry snapshot must include an agents array");
  }

  if (!Array.isArray(snapshot.degraded)) {
    throw new TelemetryValidationError("Telemetry snapshot must include degraded details array");
  }

  if (!snapshot.freshness.snapshotAt) {
    throw new TelemetryValidationError("Telemetry snapshot freshness timestamp is required");
  }
}

function buildDashboardTelemetrySnapshot(
  deps: DashboardSnapshotDependencies,
): DashboardTelemetryResponse {
  const snapshotAt = deps.now();
  const agentSource = deps.getAgentsConfigTelemetry();
  const activitySource = deps.getActivitiesTelemetrySummary();
  const sessionsSource = deps.getOpenClawSessionsTelemetry();

  const dedupedAgents = dedupeAgentIdentities(agentSource.agents);
  const sessionsByAgent = createSessionLookup(sessionsSource.sessions);
  const unknownIdentityDegradation = createUnknownSessionIdentityDegradation(
    dedupedAgents,
    sessionsSource.sessions,
  );

  const agents: AgentTelemetry[] = dedupedAgents.map((agent) => {
    const session = sessionsByAgent.get(agent.id);
    const status = resolveAgentStatus(session);

    return {
      id: agent.id,
      name: agent.name,
      emoji: agent.emoji,
      color: agent.color,
      model: agent.model,
      status,
      activeSessions: session?.freshSessions ?? 0,
      lastActivity: session?.latestActivity,
    };
  });

  const snapshot: DashboardTelemetryResponse = {
    freshness: buildFreshness(snapshotAt, deps.now(), deps.stalenessThresholdSec),
    summary: activitySource.summary,
    agents,
    degraded: [
      ...agentSource.degraded,
      ...activitySource.degraded,
      ...sessionsSource.degraded,
      ...unknownIdentityDegradation,
    ],
  };

  validateSnapshot(snapshot);
  return snapshot;
}

export function getDashboardTelemetrySnapshot(
  overrides: Partial<DashboardSnapshotDependencies> = {},
): DashboardTelemetryResponse {
  const snapshot = buildDashboardTelemetrySnapshot({
    now: () => new Date(),
    stalenessThresholdSec: DEFAULT_STALENESS_THRESHOLD_SEC,
    getAgentsConfigTelemetry,
    getActivitiesTelemetrySummary,
    getOpenClawSessionsTelemetry,
    ...overrides,
  });

  if (snapshot.degraded.length > 0) {
    console.warn("[telemetry/dashboard-snapshot] degraded sources detected", {
      degradedCount: snapshot.degraded.length,
      sections: snapshot.degraded.map((entry) => entry.section),
      codes: snapshot.degraded.map((entry) => entry.code),
    });
  }

  return snapshot;
}

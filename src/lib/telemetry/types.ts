export const TELEMETRY_FRESHNESS_STATUS = {
  FRESH: "fresh",
  STALE: "stale",
} as const;

export type TelemetryFreshnessStatus =
  (typeof TELEMETRY_FRESHNESS_STATUS)[keyof typeof TELEMETRY_FRESHNESS_STATUS];

export const TELEMETRY_DEGRADATION_SECTION = {
  AGENTS: "agents",
  ACTIVITY: "activity",
  SESSIONS: "sessions",
  SUMMARY: "summary",
} as const;

export type TelemetryDegradationSection =
  (typeof TELEMETRY_DEGRADATION_SECTION)[keyof typeof TELEMETRY_DEGRADATION_SECTION];

export const TELEMETRY_DEGRADATION_CODE = {
  SOURCE_UNAVAILABLE: "source_unavailable",
  PARSE_ERROR: "parse_error",
  VALIDATION_ERROR: "validation_error",
  TIMEOUT: "timeout",
} as const;

export type TelemetryDegradationCode =
  (typeof TELEMETRY_DEGRADATION_CODE)[keyof typeof TELEMETRY_DEGRADATION_CODE];

export const AGENT_TELEMETRY_STATUS = {
  WORKING: "working",
  ONLINE: "online",
  IDLE: "idle",
  OFFLINE: "offline",
} as const;

export type AgentTelemetryStatus =
  (typeof AGENT_TELEMETRY_STATUS)[keyof typeof AGENT_TELEMETRY_STATUS];

export interface TelemetryDegradation {
  section: TelemetryDegradationSection;
  code: TelemetryDegradationCode;
  retriable: boolean;
  message: string;
}

export interface TelemetryFreshness {
  snapshotAt: string;
  snapshotAgeSec: number;
  stalenessThresholdSec: number;
  status: TelemetryFreshnessStatus;
}

export interface ActivitySummaryTelemetry {
  totalActivities: number;
  todayActivities: number;
  successfulActivities: number;
  failedActivities: number;
}

export interface AgentTelemetry {
  id: string;
  name: string;
  emoji: string;
  color: string;
  model: string;
  status: AgentTelemetryStatus;
  activeSessions: number;
  lastActivity?: string;
}

export interface DashboardTelemetryResponse {
  freshness: TelemetryFreshness;
  summary: ActivitySummaryTelemetry;
  agents: AgentTelemetry[];
  degraded: TelemetryDegradation[];
}

export interface AgentIdentityTelemetry {
  id: string;
  name: string;
  emoji: string;
  color: string;
  model: string;
}

export interface AgentActivityTelemetry {
  id: string;
  lastActivity?: string;
  successfulActivities: number;
  failedActivities: number;
  runningActivities: number;
}

export interface AgentSessionTelemetry {
  id: string;
  freshSessions: number;
  latestActivity?: string;
}

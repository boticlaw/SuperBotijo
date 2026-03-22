import { getDashboardTelemetrySnapshot } from "@/lib/telemetry/dashboard-snapshot";
import { getActivityStats } from "@/lib/activities-db";
import { getAgents } from "@/operations/agent-ops";
import { getAgentStatusList } from "@/operations";
import type { DashboardTelemetryResponse, AgentTelemetry } from "@/lib/telemetry/types";
import DashboardClient from "./DashboardClient";

export const dynamic = "force-dynamic";

function isRealTelemetryEnabled(): boolean {
  return process.env.NEXT_PUBLIC_DASHBOARD_REAL_TELEMETRY === "true";
}

const AGENT_STATUS = {
  WORKING: "working",
  ONLINE: "online",
  IDLE: "idle",
  OFFLINE: "offline",
} as const;

type AgentStatus = (typeof AGENT_STATUS)[keyof typeof AGENT_STATUS];

async function getLegacyTelemetry(): Promise<DashboardTelemetryResponse> {
  const [activityStatsResult, agentsResult, statusResult] = await Promise.all([
    Promise.resolve(getActivityStats()),
    getAgents(),
    getAgentStatusList(),
  ]);

  const activityStats = activityStatsResult;
  const agents = agentsResult.success && agentsResult.data ? agentsResult.data : [];
  const agentStatuses = statusResult.success && statusResult.data ? statusResult.data : [];

  const statusByAgent = new Map<string, { status: AgentStatus; activeSessions: number; lastActivity?: string }>();
  agentStatuses.forEach((entry) => {
    statusByAgent.set(entry.id, {
      status: entry.status as AgentStatus,
      activeSessions: entry.activeSessions,
      lastActivity: entry.lastActivity,
    });
  });

  const telemetryAgents: AgentTelemetry[] = agents.map((agent) => {
    const status = statusByAgent.get(agent.id);
    return {
      id: agent.id,
      name: agent.name,
      emoji: agent.emoji ?? "🤖",
      color: agent.color ?? "#3b82f6",
      model: agent.model ?? "unknown",
      status: status?.status ?? AGENT_STATUS.OFFLINE,
      activeSessions: status?.activeSessions ?? 0,
      lastActivity: status?.lastActivity,
    };
  });

  const successfulActivities =
    (activityStats.byStatus?.success ?? 0) +
    (activityStats.byStatus?.approved ?? 0);

  const failedActivities =
    (activityStats.byStatus?.error ?? 0) +
    (activityStats.byStatus?.rejected ?? 0);

  return {
    freshness: {
      snapshotAt: new Date().toISOString(),
      snapshotAgeSec: 0,
      stalenessThresholdSec: 30,
      status: "fresh",
    },
    summary: {
      totalActivities: activityStats.total ?? 0,
      todayActivities: activityStats.today ?? 0,
      successfulActivities,
      failedActivities,
    },
    agents: telemetryAgents,
    degraded: [],
  };
}

async function getInitialTelemetry(): Promise<DashboardTelemetryResponse> {
  if (isRealTelemetryEnabled()) {
    try {
      return getDashboardTelemetrySnapshot();
    } catch (error) {
      console.error("[Dashboard] Failed to get telemetry snapshot, falling back to legacy:", error);
      return getLegacyTelemetry();
    }
  }

  return getLegacyTelemetry();
}

export default async function DashboardPage() {
  const initialTelemetry = await getInitialTelemetry();
  return <DashboardClient initialTelemetry={initialTelemetry} />;
}

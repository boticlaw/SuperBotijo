import { NextResponse } from "next/server";

import { getAgentStatusList } from "@/operations";
import type { AgentStatusEntry } from "@/operations/agent-ops";
import { getDashboardTelemetrySnapshot } from "@/lib/telemetry/dashboard-snapshot";
import { createAsyncCache } from "@/lib/cache";

export const dynamic = "force-dynamic";

function isRealTelemetryEnabled(): boolean {
  return process.env.NEXT_PUBLIC_DASHBOARD_REAL_TELEMETRY === "true";
}

interface StatusResponse {
  agents: AgentStatusEntry[];
  timestamp: number;
}

/**
 * Compatibility endpoint for older clients.
 *
 * Strategy: when real telemetry is enabled, proxy status data from the
 * normalized telemetry snapshot to keep status semantics aligned.
 * If the snapshot fails, fallback to legacy status computation.
 */
function getStatusEntriesFromTelemetry(): AgentStatusEntry[] {
  const snapshot = getDashboardTelemetrySnapshot();

  return snapshot.agents.map((agent) => ({
    id: agent.id,
    name: agent.name,
    status: agent.status,
    lastActivity: agent.lastActivity,
    activeSessions: agent.activeSessions,
  }));
}

/** Compute status data from telemetry or legacy path */
async function computeAgentStatus(): Promise<StatusResponse> {
  let statusResult: { success: boolean; data?: AgentStatusEntry[]; error?: string };

  if (isRealTelemetryEnabled()) {
    try {
      statusResult = {
        success: true,
        data: getStatusEntriesFromTelemetry(),
      };
    } catch (telemetryError) {
      console.warn("[api/agents/status] telemetry proxy failed, falling back to legacy status", {
        error: telemetryError instanceof Error ? telemetryError.message : String(telemetryError),
      });
      statusResult = await getAgentStatusList();
    }
  } else {
    statusResult = await getAgentStatusList();
  }

  if (!statusResult.success || !statusResult.data) {
    throw new Error(statusResult.error || "Failed to compute statuses");
  }

  return {
    agents: statusResult.data,
    timestamp: Date.now(),
  };
}

/** Module-level 10-second cache replacing the ad-hoc statusCache */
const cachedAgentStatus = createAsyncCache<StatusResponse>({
  ttlMs: 10_000,
  compute: computeAgentStatus,
});

export async function GET() {
  try {
    const data = await cachedAgentStatus.get();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error computing agent statuses:", error);

    return NextResponse.json(
      {
        error: "Failed to compute statuses",
        agents: [],
        timestamp: Date.now(),
      },
      { status: 500 }
    );
  }
}

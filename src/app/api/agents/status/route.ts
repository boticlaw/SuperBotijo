import { NextResponse } from "next/server";

import { getAgentStatusList } from "@/operations";
import type { AgentStatusEntry } from "@/operations/agent-ops";
import { getDashboardTelemetrySnapshot } from "@/lib/telemetry/dashboard-snapshot";

export const dynamic = "force-dynamic";

function isRealTelemetryEnabled(): boolean {
  return process.env.NEXT_PUBLIC_DASHBOARD_REAL_TELEMETRY === "true";
}

interface CacheEntry {
  data: { agents: AgentStatusEntry[]; timestamp: number };
  timestamp: number;
}

let statusCache: CacheEntry | null = null;
const CACHE_TTL = 10000; // 10 seconds

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

export async function GET() {
  const now = Date.now();
  
  // Return cached data if still fresh
  if (statusCache && (now - statusCache.timestamp) < CACHE_TTL) {
    return NextResponse.json(statusCache.data);
  }
  
  try {
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
      return NextResponse.json(
        {
          error: statusResult.error || "Failed to compute statuses",
          agents: [],
          timestamp: now,
        },
        { status: 500 }
      );
    }

    const responseData = {
      agents: statusResult.data,
      timestamp: now,
    };

    statusCache = {
      data: responseData,
      timestamp: now,
    };

    return NextResponse.json(responseData);
  } catch (error) {
    console.error("Error computing agent statuses:", error);
    
    // Return error but don't crash
    return NextResponse.json(
      { 
        error: "Failed to compute statuses",
        agents: [],
        timestamp: now 
      },
      { status: 500 }
    );
  }
}

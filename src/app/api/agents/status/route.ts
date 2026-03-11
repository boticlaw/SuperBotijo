import { NextResponse } from "next/server";

import { getAgentStatusList } from "@/operations";
import type { AgentStatusEntry } from "@/operations/agent-ops";

export const dynamic = "force-dynamic";

interface CacheEntry {
  data: { agents: AgentStatusEntry[]; timestamp: number };
  timestamp: number;
}

let statusCache: CacheEntry | null = null;
const CACHE_TTL = 10000; // 10 seconds

export async function GET() {
  const now = Date.now();
  
  // Return cached data if still fresh
  if (statusCache && (now - statusCache.timestamp) < CACHE_TTL) {
    return NextResponse.json(statusCache.data);
  }
  
  try {
    const statusResult = await getAgentStatusList();
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

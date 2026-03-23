/**
 * Agent IDs API
 * 
 * Returns list of agent IDs from OpenClaw configuration.
 * Used for UI filters in the Kanban board.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAgentAuth } from "@/lib/agent-auth";
import { getOpenClawAgents } from "@/lib/openclaw-agents";

export const dynamic = "force-dynamic";

/**
 * GET /api/kanban/agent/ids
 * Returns list of agent IDs from openclaw.json
 * 
 * No authentication required - this is read-only for UI purposes
 */
export async function GET(request: NextRequest) {
  const authResult = requireAgentAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const agents = getOpenClawAgents();
    const agentIds = agents.map((agent) => agent.id);
    return NextResponse.json({ agents: agentIds });
  } catch (error) {
    console.error("[agent-ids] GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch agent IDs" },
      { status: 500 }
    );
  }
}

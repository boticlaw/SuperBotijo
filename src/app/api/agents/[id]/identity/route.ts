/**
 * Agent Identity API - Get/Update identity for a specific agent
 */
import { NextRequest, NextResponse } from "next/server";
import {
  getAgentIdentity,
  updateAgentIdentity,
  createAgentIdentity,
} from "@/lib/kanban-db";
import type { UpdateAgentIdentityInput } from "@/lib/mission-types";

export const dynamic = "force-dynamic";

/**
 * GET /api/agents/[id]/identity
 * Returns agent identity, auto-creates with defaults if not found
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params;

    // Try to get existing identity
    let identity = getAgentIdentity(agentId);

    // Auto-create with defaults if not found
    if (!identity) {
      identity = createAgentIdentity({
        id: agentId,
        name: agentId,
        role: "Agent",
        personality: null,
        avatar: null,
        mission: null,
      });
    }

    return NextResponse.json({ identity });
  } catch (error) {
    console.error("[api/agents/[id]/identity] GET error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get identity" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/agents/[id]/identity
 * Updates agent identity (all fields: name, role, personality, avatar, mission)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params;
    const body = await request.json();

    // Ensure identity exists first (auto-create if needed)
    let identity = getAgentIdentity(agentId);
    if (!identity) {
      identity = createAgentIdentity({
        id: agentId,
        name: agentId,
        role: "Agent",
        personality: null,
        avatar: null,
        mission: null,
      });
    }

    // Build update input
    const updates: UpdateAgentIdentityInput = {};

    if (body.name !== undefined) {
      updates.name = String(body.name);
    }

    if (body.role !== undefined) {
      updates.role = String(body.role);
    }

    if (body.personality !== undefined) {
      updates.personality = body.personality ? String(body.personality) : null;
    }

    if (body.avatar !== undefined) {
      updates.avatar = body.avatar ? String(body.avatar) : null;
    }

    if (body.mission !== undefined) {
      updates.mission = body.mission ? String(body.mission) : null;
    }

    // Apply updates
    const updated = updateAgentIdentity(agentId, updates);

    if (!updated) {
      return NextResponse.json(
        { error: "Failed to update identity" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      identity: updated,
      message: "Identity updated successfully",
    });
  } catch (error) {
    console.error("[api/agents/[id]/identity] PUT error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update identity" },
      { status: 500 }
    );
  }
}

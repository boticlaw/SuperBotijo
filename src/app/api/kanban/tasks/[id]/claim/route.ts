import { NextRequest, NextResponse } from "next/server";
import { claimTask, releaseTask, getTask } from "@/lib/kanban-db";
import { requireAuth } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface ClaimBody {
  agentName: string;
}

/**
 * POST /api/kanban/tasks/[id]/claim
 * Atomically claim a task for an agent
 * Authorization: Requires authenticated session
 * Returns 200 if claimed successfully, 409 if already claimed by another agent
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const authResult = await requireAuth(request);
  if (!authResult.authorized) {
    return authResult.error;
  }

  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: "Task ID is required" },
        { status: 400 }
      );
    }

    const body = (await request.json()) as ClaimBody;

    if (!body.agentName || typeof body.agentName !== "string") {
      return NextResponse.json(
        { error: "agentName is required and must be a string" },
        { status: 400 }
      );
    }

    const result = claimTask(id, body.agentName);

    if (!result.success) {
      if (result.reason === "not_found") {
        return NextResponse.json(
          { error: "Task not found" },
          { status: 404 }
        );
      }

      if (result.reason === "claimed_by_other") {
        const task = getTask(id);
        return NextResponse.json(
          {
            error: "Task already claimed by another agent",
            claimedBy: task?.claimedBy,
            claimedAt: task?.claimedAt,
          },
          { status: 409 }
        );
      }

      if (result.reason === "already_claimed") {
        return NextResponse.json(
          { error: "Task was claimed by another agent during this operation" },
          { status: 409 }
        );
      }
    }

    return NextResponse.json({ task: result.task });
  } catch (error) {
    console.error("[claim] Error claiming task:", error);
    return NextResponse.json(
      { error: "Failed to claim task" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/kanban/tasks/[id]/claim
 * Release a task claim
 * Authorization: Requires authenticated session
 * Only the claiming agent can release their own claim
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const authResult = await requireAuth(request);
  if (!authResult.authorized) {
    return authResult.error;
  }

  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: "Task ID is required" },
        { status: 400 }
      );
    }

    const body = (await request.json()) as ClaimBody;

    if (!body.agentName || typeof body.agentName !== "string") {
      return NextResponse.json(
        { error: "agentName is required and must be a string" },
        { status: 400 }
      );
    }

    const result = releaseTask(id, body.agentName);

    if (!result.success) {
      if (result.reason === "not_found") {
        return NextResponse.json(
          { error: "Task not found" },
          { status: 404 }
        );
      }

      if (result.reason === "not_claimed") {
        return NextResponse.json(
          { error: "Task is not currently claimed" },
          { status: 400 }
        );
      }

      if (result.reason === "claimed_by_other") {
        return NextResponse.json(
          { error: "Cannot release claim owned by another agent" },
          { status: 403 }
        );
      }
    }

    const task = getTask(id);
    return NextResponse.json({ task });
  } catch (error) {
    console.error("[claim] Error releasing task:", error);
    return NextResponse.json(
      { error: "Failed to release task claim" },
      { status: 500 }
    );
  }
}

/**
 * Agent Task API - Single Task Operations
 * 
 * Endpoints for OpenClaw agents to update and delete specific tasks.
 * 
 * Authentication: Requires X-Agent-Id and X-Agent-Key headers
 * 
 * PATCH /api/kanban/agent/tasks/[id] - Update a task
 * DELETE /api/kanban/agent/tasks/[id] - Delete a task
 */
import { NextRequest, NextResponse } from "next/server";
import { getTask, updateTask, deleteTask } from "@/lib/kanban-db";
import { requireAgentAuth } from "@/lib/agent-auth";
import { logActivity } from "@/lib/activities-db";

export const dynamic = "force-dynamic";

// ============================================================================
// Valid Values
// ============================================================================

const VALID_STATUSES = ["backlog", "in_progress", "review", "done", "blocked", "waiting"] as const;
const VALID_PRIORITIES = ["low", "medium", "high", "critical"] as const;

// ============================================================================
// PATCH - Update Task
// ============================================================================

/**
 * PATCH /api/kanban/agent/tasks/[id]
 * Update a task (status, assignee, claim, etc.)
 * 
 * Authorization: Agent must be creator, assignee, or claimer of the task
 * 
 * Body:
 * - status: string (optional)
 * - title: string (optional, max 200 chars)
 * - description: string (optional)
 * - priority: string (optional)
 * - assignee: string (optional)
 * - claim: boolean (optional) - true to claim, false to unclaim
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Authenticate agent
  const authResult = requireAgentAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }
  const { agentId } = authResult;
  const { id } = await params;

  try {
    // Get existing task
    const task = getTask(id);
    if (!task) {
      return NextResponse.json(
        { error: "Task not found" },
        { status: 404 }
      );
    }

    // Authorization check: agent must be creator, assignee, or claimer
    const isCreator = task.createdBy === agentId;
    const isAssignee = task.assignee === agentId;
    const isClaimer = task.claimedBy === agentId;

    if (!isCreator && !isAssignee && !isClaimer) {
      return NextResponse.json(
        { error: "Not authorized to update this task" },
        { status: 403 }
      );
    }

    // Parse update body
    const body = await request.json();

    // Build update object
    const updates: {
      title?: string;
      description?: string | null;
      status?: string;
      priority?: "low" | "medium" | "high" | "critical";
      assignee?: string | null;
      claimedBy?: string | null;
      claimedAt?: string | null;
    } = {};

    // Validate and apply status
    if (body.status !== undefined) {
      if (!VALID_STATUSES.includes(body.status as typeof VALID_STATUSES[number])) {
        return NextResponse.json(
          { error: `Invalid status. Valid values: ${VALID_STATUSES.join(", ")}` },
          { status: 400 }
        );
      }
      updates.status = body.status;
    }

    // Validate and apply title
    if (body.title !== undefined) {
      if (typeof body.title !== "string" || body.title.length > 200) {
        return NextResponse.json(
          { error: "Title must be a string of 200 characters or less" },
          { status: 400 }
        );
      }
      updates.title = body.title;
    }

    // Apply description
    if (body.description !== undefined) {
      updates.description = body.description;
    }

    // Validate and apply priority
    if (body.priority !== undefined) {
      if (!VALID_PRIORITIES.includes(body.priority as typeof VALID_PRIORITIES[number])) {
        return NextResponse.json(
          { error: `Invalid priority. Valid values: ${VALID_PRIORITIES.join(", ")}` },
          { status: 400 }
        );
      }
      updates.priority = body.priority;
    }

    // Apply assignee
    if (body.assignee !== undefined) {
      updates.assignee = body.assignee;
    }

    // Handle claim/unclaim
    if (body.claim === true && !task.claimedBy) {
      // Claim the task
      updates.claimedBy = agentId;
      updates.claimedAt = new Date().toISOString();
    } else if (body.claim === false && task.claimedBy === agentId) {
      // Unclaim the task (only claimer can unclaim)
      updates.claimedBy = null;
      updates.claimedAt = null;
    } else if (body.claim === true && task.claimedBy && task.claimedBy !== agentId) {
      return NextResponse.json(
        { error: `Task already claimed by ${task.claimedBy}` },
        { status: 409 }
      );
    }

    // Apply update
    const updated = updateTask(id, updates);

    if (!updated) {
      return NextResponse.json(
        { error: "Failed to update task" },
        { status: 500 }
      );
    }

    // Log activity
    const changeDesc = Object.keys(updates).join(", ");
    logActivity("task", `Agent ${agentId} updated task "${task.title}" (${changeDesc})`, "success", {
      agent: agentId,
      metadata: {
        taskId: id,
        changes: updates,
      },
    });

    return NextResponse.json({ task: updated });
  } catch (error) {
    console.error("[agent-tasks] PATCH error:", error);
    return NextResponse.json(
      { error: "Failed to update task" },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE - Delete Task
// ============================================================================

/**
 * DELETE /api/kanban/agent/tasks/[id]
 * Delete a task. Only the creator can delete.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Authenticate agent
  const authResult = requireAgentAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }
  const { agentId } = authResult;
  const { id } = await params;

  try {
    const task = getTask(id);
    if (!task) {
      return NextResponse.json(
        { error: "Task not found" },
        { status: 404 }
      );
    }

    // Only creator can delete
    if (task.createdBy !== agentId) {
      return NextResponse.json(
        { error: "Only the creator can delete this task" },
        { status: 403 }
      );
    }

    const deleted = deleteTask(id);

    if (!deleted) {
      return NextResponse.json(
        { error: "Failed to delete task" },
        { status: 500 }
      );
    }

    // Log activity
    logActivity("task", `Agent ${agentId} deleted task: ${task.title}`, "success", {
      agent: agentId,
      metadata: { taskId: id, taskTitle: task.title },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[agent-tasks] DELETE error:", error);
    return NextResponse.json(
      { error: "Failed to delete task" },
      { status: 500 }
    );
  }
}

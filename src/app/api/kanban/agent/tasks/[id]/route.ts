/**
 * Agent Task API - Single Task Operations
 * 
 * Endpoints for OpenClaw agents to update and delete specific tasks.
 * 
 * Authentication: Requires X-Agent-Id + X-Agent-Key headers OR authenticated session
 * 
 * PATCH /api/kanban/agent/tasks/[id] - Update a task
 * DELETE /api/kanban/agent/tasks/[id] - Delete a task
 */
import { NextRequest, NextResponse } from "next/server";
import {
  TASK_COMMENT_TYPE,
  createTaskComment,
  getTask,
  updateTask,
  deleteTask,
} from "@/lib/kanban-db";
import { requireAgentOrSessionAuth } from "@/lib/auth-helpers";
import { logActivity } from "@/lib/activities-db";
import {
  isRequireCommentOnStatusFeatureEnabled,
  normalizeCommentBody,
  shouldRequireTransitionComment,
} from "@/lib/kanban-comments";

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
 * Authorization:
 * - Agent auth: must be creator, assignee, or claimer of the task
 * - Session auth: full access
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
  const authResult = await requireAgentOrSessionAuth(request);
  if (!authResult.authorized) {
    return authResult.error;
  }
  const actorId = authResult.authType === "agent" ? authResult.agentId ?? "agent" : "session";
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
    const isSessionActor = authResult.authType === "session";
    const isCreator = task.createdBy === actorId;
    const isAssignee = task.assignee === actorId;
    const isClaimer = task.claimedBy === actorId;

    if (!isSessionActor && !isCreator && !isAssignee && !isClaimer) {
      return NextResponse.json(
        { error: "Not authorized to update this task" },
        { status: 403 }
      );
    }

    // Parse update body
    const body = await request.json() as {
      status?: string;
      title?: string;
      description?: string | null;
      priority?: "low" | "medium" | "high" | "critical";
      assignee?: string | null;
      claim?: boolean;
      comment?: unknown;
      body?: unknown;
      content?: unknown;
    };
    const transitionComment = normalizeCommentBody(body.comment ?? body.body ?? body.content);
    const nextStatus = typeof body.status === "string" ? body.status : task.status;
    const hasStatusTransition = nextStatus !== task.status;

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

    if (
      isRequireCommentOnStatusFeatureEnabled()
      && shouldRequireTransitionComment(task.status, nextStatus)
      && !transitionComment
    ) {
      return NextResponse.json(
        { error: "A comment is required when moving this task to blocked, waiting, review, or done" },
        { status: 400 }
      );
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
      updates.claimedBy = actorId;
      updates.claimedAt = new Date().toISOString();
    } else if (body.claim === false && (task.claimedBy === actorId || isSessionActor)) {
      // Unclaim the task (only claimer can unclaim)
      updates.claimedBy = null;
      updates.claimedAt = null;
    } else if (body.claim === true && task.claimedBy && task.claimedBy !== actorId) {
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

    if (transitionComment) {
      createTaskComment({
        taskId: id,
        authorType: authResult.authType === "agent" ? "agent" : "human",
        authorId: actorId,
        body: transitionComment,
        commentType: hasStatusTransition ? TASK_COMMENT_TYPE.STATUS_CHANGE : TASK_COMMENT_TYPE.COMMENT,
        statusFrom: hasStatusTransition ? task.status : null,
        statusTo: hasStatusTransition ? nextStatus : null,
        metadata: {
          source: "agent-task-update",
        },
      });
    }

    // Log activity
    const changeDesc = Object.keys(updates).join(", ");
    logActivity("task", `${authResult.authType === "agent" ? `Agent ${actorId}` : "Authenticated user"} updated task "${task.title}" (${changeDesc})`, "success", {
      agent: actorId,
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
  const authResult = await requireAgentOrSessionAuth(request);
  if (!authResult.authorized) {
    return authResult.error;
  }
  const actorId = authResult.authType === "agent" ? authResult.agentId ?? "agent" : "session";
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
    if (authResult.authType !== "session" && task.createdBy !== actorId) {
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
    logActivity("task", `${authResult.authType === "agent" ? `Agent ${actorId}` : "Authenticated user"} deleted task: ${task.title}`, "success", {
      agent: actorId,
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

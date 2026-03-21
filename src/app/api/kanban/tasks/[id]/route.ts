import { NextRequest, NextResponse } from "next/server";
import {
  TASK_COMMENT_TYPE,
  createTaskComment,
  getTask,
  updateTask,
  deleteTask,
  type TaskPriority,
  type UpdateTaskInput,
} from "@/lib/kanban-db";
import {
  isRequireCommentOnStatusFeatureEnabled,
  normalizeCommentBody,
  shouldRequireTransitionComment,
} from "@/lib/kanban-comments";
import { emitKanbanTaskUpdated, emitKanbanTaskDeleted } from "@/lib/runtime-events";
import { requireAuth } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/kanban/tasks/[id]
 * Get a single task by ID
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: "Task ID is required" },
        { status: 400 }
      );
    }

    const task = getTask(id);

    if (!task) {
      return NextResponse.json(
        { error: "Task not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ task });
  } catch (error) {
    console.error("Failed to get task:", error);
    return NextResponse.json(
      { error: "Failed to get task" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/kanban/tasks/[id]
 * Update a task
 * Authorization: Requires authenticated session
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
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

    const existingTask = getTask(id);
    if (!existingTask) {
      return NextResponse.json(
        { error: "Task not found" },
        { status: 404 }
      );
    }

    const body = await request.json() as UpdateTaskInput & {
      comment?: unknown;
      body?: unknown;
      content?: unknown;
    };
    const transitionComment = normalizeCommentBody(body.comment ?? body.body ?? body.content);
    const nextStatus = typeof body.status === "string" ? body.status : existingTask.status;
    const hasStatusTransition = nextStatus !== existingTask.status;

    if (body.title !== undefined) {
      if (typeof body.title !== "string" || body.title.length === 0) {
        return NextResponse.json(
          { error: "Title must be a non-empty string" },
          { status: 400 }
        );
      }

      if (body.title.length > 200) {
        return NextResponse.json(
          { error: "Title must be 200 characters or less" },
          { status: 400 }
        );
      }
    }

    const validPriorities: TaskPriority[] = ["low", "medium", "high", "critical"];
    if (body.priority && !validPriorities.includes(body.priority)) {
      return NextResponse.json(
        { error: `Invalid priority. Must be one of: ${validPriorities.join(", ")}` },
        { status: 400 }
      );
    }

    // Validate projectId (can be string or null to unassign)
    if (body.projectId !== undefined && body.projectId !== null && typeof body.projectId !== "string") {
      return NextResponse.json(
        { error: "projectId must be a string or null" },
        { status: 400 }
      );
    }

    // Validate archived (must be boolean)
    if (body.archived !== undefined && typeof body.archived !== "boolean") {
      return NextResponse.json(
        { error: "archived must be a boolean" },
        { status: 400 }
      );
    }

    if (
      isRequireCommentOnStatusFeatureEnabled()
      && shouldRequireTransitionComment(existingTask.status, nextStatus)
      && !transitionComment
    ) {
      return NextResponse.json(
        { error: "A comment is required when moving this task to blocked, waiting, review, or done" },
        { status: 400 }
      );
    }

    const task = updateTask(id, body);

    if (!task) {
      return NextResponse.json(
        { error: "Task not found" },
        { status: 404 }
      );
    }

    if (transitionComment) {
      createTaskComment({
        taskId: id,
        authorType: "human",
        authorId: "user",
        body: transitionComment,
        commentType: hasStatusTransition ? TASK_COMMENT_TYPE.STATUS_CHANGE : TASK_COMMENT_TYPE.COMMENT,
        statusFrom: hasStatusTransition ? existingTask.status : null,
        statusTo: hasStatusTransition ? nextStatus : null,
        metadata: {
          source: "human-task-update",
        },
      });
    }

    // Emit real-time event
    const changes: Record<string, unknown> = {};
    if (body.title !== undefined) changes.title = body.title;
    if (body.description !== undefined) changes.description = body.description;
    if (body.status !== undefined) changes.status = body.status;
    if (body.priority !== undefined) changes.priority = body.priority;
    if (body.assignee !== undefined) changes.assignee = body.assignee;
    if (body.labels !== undefined) changes.labels = body.labels;
    if (body.projectId !== undefined) changes.projectId = body.projectId;
    if (body.archived !== undefined) changes.archived = body.archived;

    emitKanbanTaskUpdated(task.id, task.title, changes);

    return NextResponse.json({ task });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update task";
    console.error("Failed to update task:", error);

    if (message.includes("Title must be")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to update task" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/kanban/tasks/[id]
 * Delete a task
 * Authorization: Requires authenticated session
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

    // Get task before deletion for event emission
    const task = getTask(id);
    const taskTitle = task?.title ?? "Unknown";

    const deleted = deleteTask(id);

    if (!deleted) {
      return NextResponse.json(
        { error: "Task not found" },
        { status: 404 }
      );
    }

    // Emit real-time event
    emitKanbanTaskDeleted(id, taskTitle);

    return NextResponse.json({ success: true, deleted: id });
  } catch (error) {
    console.error("Failed to delete task:", error);
    return NextResponse.json(
      { error: "Failed to delete task" },
      { status: 500 }
    );
  }
}

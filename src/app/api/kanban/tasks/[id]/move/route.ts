import { NextRequest, NextResponse } from "next/server";
import { moveTask, getTask } from "@/lib/kanban-db";
import { emitKanbanTaskMoved } from "@/lib/runtime-events";
import { requireAuth } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface MoveTaskBody {
  targetColumnId: string;
  targetOrder?: number;
}

/**
 * POST /api/kanban/tasks/[id]/move
 * Move a task to a different column/position
 * Authorization: Requires authenticated session
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

    const body: MoveTaskBody = await request.json();

    if (!body.targetColumnId || typeof body.targetColumnId !== "string") {
      return NextResponse.json(
        { error: "targetColumnId is required" },
        { status: 400 }
      );
    }

    if (body.targetOrder !== undefined && typeof body.targetOrder !== "number") {
      return NextResponse.json(
        { error: "targetOrder must be a number if provided" },
        { status: 400 }
      );
    }

    // Get task before move for event emission
    const taskBefore = getTask(id);
    const fromColumn = taskBefore?.status;
    const taskTitle = taskBefore?.title ?? "Unknown";

    const task = moveTask(id, body.targetColumnId, body.targetOrder);

    if (!task) {
      return NextResponse.json(
        { error: "Task or target column not found" },
        { status: 404 }
      );
    }

    // Emit real-time event if column actually changed
    if (fromColumn && fromColumn !== body.targetColumnId) {
      emitKanbanTaskMoved(id, taskTitle, fromColumn, body.targetColumnId);
    }

    return NextResponse.json({ task });
  } catch (error) {
    console.error("Failed to move task:", error);
    return NextResponse.json(
      { error: "Failed to move task" },
      { status: 500 }
    );
  }
}

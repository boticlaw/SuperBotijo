import { NextRequest, NextResponse } from "next/server";
import {
  listTasks,
  createTask,
  type TaskPriority,
  type CreateTaskInput,
  type ListTasksFilters,
} from "@/lib/kanban-db";
import { emitKanbanTaskCreated } from "@/lib/runtime-events";
import { requireAuth } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";

/**
 * GET /api/kanban/tasks
 * List tasks with optional filters
 * Query params: status, assignee, priority, search, columnId, projectId, view
 * - view: "active" (default), "archived", or "all"
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const status = searchParams.get("status") || searchParams.get("columnId") || undefined;
    const assignee = searchParams.get("assignee") || undefined;
    const priority = (searchParams.get("priority") || undefined) as TaskPriority | undefined;
    const search = searchParams.get("search") || undefined;
    const projectId = searchParams.get("projectId") || undefined;
    const createdBy = searchParams.get("createdBy") || undefined;
    const domain = searchParams.get("domain") || undefined;
    
    // Archive view filter: "active" (default), "archived", or "all"
    const viewParam = searchParams.get("view");
    const view: ListTasksFilters["view"] = 
      viewParam === "archived" || viewParam === "all" ? viewParam : "active";

    const tasks = listTasks({ status, assignee, priority, search, projectId, createdBy, domain, view });

    return NextResponse.json({ tasks });
  } catch (error) {
    console.error("Failed to list tasks:", error);
    return NextResponse.json(
      { error: "Failed to list tasks" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/kanban/tasks
 * Create a new task
 * Authorization: Requires authenticated session
 */
export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (!authResult.authorized) {
    return authResult.error;
  }

  try {
    const body: CreateTaskInput = await request.json();

    if (!body.title || typeof body.title !== "string") {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 }
      );
    }

    if (body.title.length > 200) {
      return NextResponse.json(
        { error: "Title must be 200 characters or less" },
        { status: 400 }
      );
    }

    const validPriorities: TaskPriority[] = ["low", "medium", "high", "critical"];
    if (body.priority && !validPriorities.includes(body.priority)) {
      return NextResponse.json(
        { error: `Invalid priority. Must be one of: ${validPriorities.join(", ")}` },
        { status: 400 }
      );
    }

    const task = createTask({
      title: body.title,
      description: body.description ?? null,
      status: body.status,
      priority: body.priority,
      assignee: body.assignee ?? null,
      labels: body.labels ?? [],
      projectId: body.projectId ?? null,
    });

    // Emit real-time event
    emitKanbanTaskCreated(
      task.id,
      task.title,
      task.status,
      task.priority
    );

    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create task";
    console.error("Failed to create task:", error);

    if (message.includes("Title must be")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to create task" },
      { status: 500 }
    );
  }
}

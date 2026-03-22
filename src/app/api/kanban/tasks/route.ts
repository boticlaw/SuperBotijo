import { NextRequest, NextResponse } from "next/server";
import {
  listTasks,
  createTask,
  type TaskPriority,
  type ListTasksFilters,
} from "@/lib/kanban-db";
import { emitKanbanTaskCreated } from "@/lib/runtime-events";
import { requireAuth } from "@/lib/auth-helpers";
import { validateBody, CreateTaskSchema } from "@/lib/api-validation";

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
    const body = await request.json();
    const validation = validateBody(CreateTaskSchema, body);
    if (!validation.success) return validation.error;
    const { title, description, status, priority, assignee, labels, projectId, domain, createdBy } = validation.data;

    const task = createTask({
      title,
      description: description ?? null,
      status,
      priority,
      assignee: assignee ?? null,
      labels: labels ?? [],
      projectId: projectId ?? null,
      domain,
      createdBy,
    });

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

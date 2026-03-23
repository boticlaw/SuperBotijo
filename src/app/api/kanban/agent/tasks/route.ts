/**
 * Agent Tasks API
 * 
 * Endpoints for OpenClaw agents to create and list tasks in the Kanban board.
 * 
 * Authentication: Requires X-Agent-Id + X-Agent-Key headers OR authenticated session
 * 
 * POST /api/kanban/agent/tasks - Create a new task
 * GET /api/kanban/agent/tasks - List tasks with filters
 */
import { NextRequest, NextResponse } from "next/server";
import { createTask, listTasks } from "@/lib/kanban-db";
import { requireAgentOrSessionAuth } from "@/lib/auth-helpers";
import { logActivity } from "@/lib/activities-db";

export const dynamic = "force-dynamic";

// ============================================================================
// Valid Task Statuses
// ============================================================================

const VALID_STATUSES = ["backlog", "in_progress", "review", "done", "blocked", "waiting"] as const;
const VALID_PRIORITIES = ["low", "medium", "high", "critical"] as const;

// ============================================================================
// POST - Create Task
// ============================================================================

/**
 * POST /api/kanban/agent/tasks
 * Create a new task as an authenticated agent
 * 
 * Auth options:
 * - Agent: X-Agent-Id + X-Agent-Key
 * - Human: authenticated session
 * 
 * Body:
 * - title: string (required, max 200 chars)
 * - description: string (optional)
 * - status: string (optional, default: "backlog")
 * - priority: "low" | "medium" | "high" | "critical" (optional)
 * - assignee: string (optional, agent ID to assign to)
 * - projectId: string (optional)
 * - labels: Array<{name: string, color: string}> (optional)
 */
export async function POST(request: NextRequest) {
  // Authenticate agent
  const authResult = await requireAgentOrSessionAuth(request);
  if (!authResult.authorized) {
    return authResult.error;
  }
  const actorId = authResult.authType === "agent" ? authResult.agentId : "session";

  try {
    const body = await request.json();

    // Validate required fields
    if (!body.title || typeof body.title !== "string") {
      return NextResponse.json(
        { error: "Missing required field: title" },
        { status: 400 }
      );
    }

    if (body.title.length > 200) {
      return NextResponse.json(
        { error: "Title must be 200 characters or less" },
        { status: 400 }
      );
    }

    // Validate status if provided
    if (body.status && !VALID_STATUSES.includes(body.status)) {
      return NextResponse.json(
        { error: `Invalid status. Valid values: ${VALID_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }

    // Validate priority if provided
    if (body.priority && !VALID_PRIORITIES.includes(body.priority)) {
      return NextResponse.json(
        { error: `Invalid priority. Valid values: ${VALID_PRIORITIES.join(", ")}` },
        { status: 400 }
      );
    }

    // Create task with agent as creator
    const task = createTask({
      title: body.title,
      description: body.description,
      status: body.status,
      priority: body.priority,
      assignee: body.assignee,
      labels: body.labels,
      projectId: body.projectId,
      createdBy: actorId,
    });

    // Log activity
    logActivity("task", `${authResult.authType === "agent" ? `Agent ${actorId}` : "Authenticated user"} created task: ${task.title}`, "success", {
      agent: actorId,
      metadata: {
        taskId: task.id,
        taskTitle: task.title,
        status: task.status,
        assignedTo: body.assignee,
      },
    });

    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    console.error("[agent-tasks] POST error:", error);
    return NextResponse.json(
      { error: "Failed to create task" },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET - List Tasks
// ============================================================================

/**
 * GET /api/kanban/agent/tasks
 * List tasks with optional filters
 * 
 * Query params:
 * - createdBy: Filter by creator agent ID
 * - assignee: Filter by assigned agent ID
 * - status: Filter by status (backlog, in_progress, etc.)
 * - priority: Filter by priority
 * - projectId: Filter by project ID
 * - limit: Max results (default: 100)
 */
export async function GET(request: NextRequest) {
  const authResult = await requireAgentOrSessionAuth(request);
  if (!authResult.authorized) {
    return authResult.error;
  }

  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "100", 10);

    // Build filters
    const filters: {
      status?: string;
      assignee?: string;
      priority?: "low" | "medium" | "high" | "critical";
      projectId?: string;
      createdBy?: string;
    } = {};

    const status = searchParams.get("status");
    if (status && VALID_STATUSES.includes(status as typeof VALID_STATUSES[number])) {
      filters.status = status;
    }

    const assignee = searchParams.get("assignee");
    if (assignee) {
      filters.assignee = assignee;
    }

    const priority = searchParams.get("priority");
    if (priority && VALID_PRIORITIES.includes(priority as typeof VALID_PRIORITIES[number])) {
      filters.priority = priority as "low" | "medium" | "high" | "critical";
    }

    const projectId = searchParams.get("projectId");
    if (projectId) {
      filters.projectId = projectId;
    }

    const createdBy = searchParams.get("createdBy");
    if (createdBy) {
      filters.createdBy = createdBy;
    }

    // Get tasks with filters
    const tasks = listTasks(filters);

    // Apply limit
    const limitedTasks = tasks.slice(0, limit);

    return NextResponse.json({
      tasks: limitedTasks,
      total: limitedTasks.length,
      unfilteredTotal: tasks.length,
    });
  } catch (error) {
    console.error("[agent-tasks] GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch tasks" },
      { status: 500 }
    );
  }
}

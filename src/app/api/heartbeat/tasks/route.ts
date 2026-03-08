import { NextRequest, NextResponse } from "next/server";
import { listTasks } from "@/lib/kanban-db";
import { resolveDependencies, type ResolvedTask } from "@/lib/dependency-resolver";

export const dynamic = "force-dynamic";

interface TaskResponse {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  isExecutable: boolean;
  blockedReason: string | null;
  claimedBy: string | null;
  claimedAt: string | null;
}

/**
 * GET /api/heartbeat/tasks
 * Returns tasks assigned to the agent with status 'in_progress'
 * Requires agentName in query params
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentName = searchParams.get("agentName");

    if (!agentName) {
      // Return empty tasks list instead of error - page should still render
      return NextResponse.json({
        agentName: null,
        count: 0,
        tasks: [],
        message: "No agent name provided. Use ?agentName=xxx",
      });
    }

    // Get tasks where assignee = agentName AND status = 'in_progress'
    const tasks = listTasks({
      assignee: agentName as string,
      status: "in_progress",
    });

    // Filter out tasks claimed by other agents
    const availableTasks = tasks.filter((task) => {
      if (!task.claimedBy) return true;
      return task.claimedBy === agentName;
    });

    // Resolve dependencies to compute executability
    const resolvedTasks = resolveDependencies(availableTasks);

    // Transform to response format
    const response: TaskResponse[] = resolvedTasks.map((task: ResolvedTask) => ({
      id: task.id,
      title: task.title,
      description: task.description,
      priority: task.priority,
      status: task.status,
      isExecutable: task.isExecutable,
      blockedReason: task.blockedReason,
      claimedBy: task.claimedBy,
      claimedAt: task.claimedAt,
    }));

    return NextResponse.json({
      agentName,
      count: response.length,
      tasks: response,
    });
  } catch (error) {
    console.error("[tasks] Error getting tasks:", error);
    return NextResponse.json(
      { error: "Failed to get tasks" },
      { status: 500 }
    );
  }
}

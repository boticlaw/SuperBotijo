import { NextRequest, NextResponse } from "next/server";
import {
  listProjects,
  createProject,
  listTasks,
  type KanbanTask,
} from "@/lib/kanban-db";
import type { CreateProjectInput, ProjectStatus, Project } from "@/lib/mission-types";

export const dynamic = "force-dynamic";

/**
 * Project with computed task statistics
 */
interface ProjectWithStats extends Project {
  taskCount: number;
  progress: number;
}

/**
 * Calculate progress percentage based on task completion
 * Progress = (completed tasks / total tasks) * 100
 * Tasks in "done" status are considered completed
 */
function calculateProgress(tasks: KanbanTask[]): number {
  if (tasks.length === 0) return 0;
  const completedCount = tasks.filter((t) => t.status === "done").length;
  return Math.round((completedCount / tasks.length) * 100);
}

/**
 * GET /api/projects
 * List all projects with task counts and progress
 * Query params: status (filter by project status)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = (searchParams.get("status") || undefined) as ProjectStatus | undefined;

    const projects = listProjects({ status });

    // Get all tasks to calculate per-project stats
    const allTasks = listTasks();

    // Group tasks by project_id
    const tasksByProject = new Map<string | null, KanbanTask[]>();
    for (const task of allTasks) {
      const key = task.projectId;
      if (!tasksByProject.has(key)) {
        tasksByProject.set(key, []);
      }
      tasksByProject.get(key)!.push(task);
    }

    // Build response with stats
    const projectsWithStats: ProjectWithStats[] = projects.map((project) => {
      const projectTasks = tasksByProject.get(project.id) || [];
      return {
        ...project,
        taskCount: projectTasks.length,
        progress: calculateProgress(projectTasks),
      };
    });

    return NextResponse.json({
      projects: projectsWithStats,
      total: projectsWithStats.length,
    });
  } catch (error) {
    console.error("Failed to list projects:", error);
    return NextResponse.json(
      { error: "Failed to list projects" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/projects
 * Create a new project
 * Body: { name: string, description?: string, status?: string, milestones?: Milestone[] }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.name || typeof body.name !== "string") {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    if (body.name.length > 200) {
      return NextResponse.json(
        { error: "Name must be 200 characters or less" },
        { status: 400 }
      );
    }

    // Validate status if provided
    const validStatuses: ProjectStatus[] = ["active", "paused", "completed", "archived"];
    if (body.status && !validStatuses.includes(body.status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
        { status: 400 }
      );
    }

    // Validate milestones if provided
    if (body.milestones !== undefined && !Array.isArray(body.milestones)) {
      return NextResponse.json(
        { error: "Milestones must be an array" },
        { status: 400 }
      );
    }

    const input: CreateProjectInput = {
      name: body.name,
      description: body.description ?? null,
      status: body.status,
      milestones: body.milestones,
    };

    const project = createProject(input);

    // Return with default stats (new project has no tasks)
    const response: ProjectWithStats = {
      ...project,
      taskCount: 0,
      progress: 0,
    };

    return NextResponse.json({ project: response }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create project";
    console.error("Failed to create project:", error);

    if (message.includes("must be")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to create project" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import {
  getProject,
  updateProject,
  deleteProject,
  listTasks,
  type KanbanTask,
} from "@/lib/kanban-db";
import type { UpdateProjectInput, ProjectStatus, Project } from "@/lib/mission-types";

export const dynamic = "force-dynamic";

/**
 * Project detail response with tasks and progress
 */
interface ProjectDetailResponse {
  project: Project;
  tasks: KanbanTask[];
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
 * GET /api/projects/[id]
 * Get project by ID with tasks and progress
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const project = getProject(id);
    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    // Get tasks for this project
    const tasks = listTasks({ projectId: id });

    const response: ProjectDetailResponse = {
      project,
      tasks,
      progress: calculateProgress(tasks),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to get project:", error);
    return NextResponse.json(
      { error: "Failed to get project" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/projects/[id]
 * Update a project
 * Body: { name?, description?, status?, milestones? }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Check project exists
    const existing = getProject(id);
    if (!existing) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    // Validate name if provided
    if (body.name !== undefined) {
      if (typeof body.name !== "string" || body.name.length === 0) {
        return NextResponse.json(
          { error: "Name must be a non-empty string" },
          { status: 400 }
        );
      }
      if (body.name.length > 200) {
        return NextResponse.json(
          { error: "Name must be 200 characters or less" },
          { status: 400 }
        );
      }
    }

    // Validate status if provided
    const validStatuses: ProjectStatus[] = ["active", "paused", "completed", "archived"];
    if (body.status !== undefined && !validStatuses.includes(body.status)) {
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

    const input: UpdateProjectInput = {
      name: body.name,
      description: body.description,
      status: body.status,
      milestones: body.milestones,
    };

    const project = updateProject(id, input);
    if (!project) {
      return NextResponse.json(
        { error: "Failed to update project" },
        { status: 500 }
      );
    }

    return NextResponse.json({ project });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update project";
    console.error("Failed to update project:", error);

    if (message.includes("must be")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to update project" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/projects/[id]
 * Delete a project
 * Sets project_id = NULL on all related tasks
 * Returns: { success: true, orphanedTasks: number }
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check project exists
    const existing = getProject(id);
    if (!existing) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    const result = deleteProject(id);

    return NextResponse.json({
      success: result.deleted,
      orphanedTasks: result.orphanedTasks,
    });
  } catch (error) {
    console.error("Failed to delete project:", error);
    return NextResponse.json(
      { error: "Failed to delete project" },
      { status: 500 }
    );
  }
}

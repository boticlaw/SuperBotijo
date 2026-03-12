import { NextResponse } from "next/server";
import { getTasksStats, getColumns, listAllTaskComments, listTasks } from "@/lib/kanban-db";

export const dynamic = "force-dynamic";

interface AssigneeStats {
  assignee: string | null;
  count: number;
}

interface ProjectStats {
  projectId: string | null;
  count: number;
}

interface FullStats {
  total: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  byAssignee: AssigneeStats[];
  byProject: ProjectStats[];
  columns: Array<{
    id: string;
    name: string;
    taskCount: number;
    limit: number | null;
  }>;
  commentQuality: {
    blockedWithValidCommentPercent: number;
    handoffsWithCommentPercent: number;
    meanTimeBlockedToResolvedMinutes: number | null;
  };
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * GET /api/kanban/stats
 * Return aggregated statistics
 */
export async function GET() {
  try {
    const stats = getTasksStats();
    const columns = getColumns();
    const allTasks = listTasks();
    const allComments = listAllTaskComments();
    const commentsByTask = new Map<string, typeof allComments>();

    for (const comment of allComments) {
      const comments = commentsByTask.get(comment.taskId) ?? [];
      comments.push(comment);
      commentsByTask.set(comment.taskId, comments);
    }

    // Calculate by assignee
    const assigneeCounts: Map<string | null, number> = new Map();
    for (const task of allTasks) {
      const current = assigneeCounts.get(task.assignee) ?? 0;
      assigneeCounts.set(task.assignee, current + 1);
    }

    const byAssignee: AssigneeStats[] = [];
    for (const [assignee, count] of assigneeCounts) {
      byAssignee.push({ assignee, count });
    }
    // Sort by count descending
    byAssignee.sort((a, b) => b.count - a.count);

    // Calculate by project
    const projectCounts: Map<string | null, number> = new Map();
    for (const task of allTasks) {
      const current = projectCounts.get(task.projectId) ?? 0;
      projectCounts.set(task.projectId, current + 1);
    }

    const byProject: ProjectStats[] = [];
    for (const [projectId, count] of projectCounts) {
      byProject.push({ projectId, count });
    }
    // Sort by count descending, with unassigned (null) at the end
    byProject.sort((a, b) => {
      if (a.projectId === null) return 1;
      if (b.projectId === null) return -1;
      return b.count - a.count;
    });

    // Calculate task count per column
    const taskCountByColumn: Record<string, number> = {};
    for (const task of allTasks) {
      taskCountByColumn[task.status] = (taskCountByColumn[task.status] ?? 0) + 1;
    }

    const columnsWithCounts = columns.map((col) => ({
      id: col.id,
      name: col.name,
      taskCount: taskCountByColumn[col.id] ?? 0,
      limit: col.limit,
    }));

    const blockedTasks = allTasks.filter((task) => task.status === "blocked");
    const blockedWithValidComment = blockedTasks.filter((task) => {
      const taskComments = commentsByTask.get(task.id) ?? [];
      return taskComments.some((comment) => comment.body.trim().length > 0);
    });
    const blockedWithValidCommentPercent = blockedTasks.length > 0
      ? Number(((blockedWithValidComment.length / blockedTasks.length) * 100).toFixed(2))
      : 0;

    const handoffTasks = allTasks.filter((task) => {
      if (!task.assignee) {
        return false;
      }

      if (!task.createdBy) {
        return false;
      }

      return task.createdBy !== task.assignee;
    });

    const handoffsWithComment = handoffTasks.filter((task) => {
      const taskComments = commentsByTask.get(task.id) ?? [];
      return taskComments.some((comment) => {
        if (comment.body.trim().length === 0) {
          return false;
        }

        const metadataType = asNonEmptyString(comment.metadata?.["commentType"]);
        return metadataType === "handoff" || comment.body.toLowerCase().includes("handoff");
      });
    });

    const handoffsWithCommentPercent = handoffTasks.length > 0
      ? Number(((handoffsWithComment.length / handoffTasks.length) * 100).toFixed(2))
      : 0;

    const blockedToResolvedDurationsMs: number[] = [];
    for (const task of allTasks) {
      const taskComments = commentsByTask.get(task.id) ?? [];
      const sorted = [...taskComments].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

      for (let i = 0; i < sorted.length; i++) {
        const current = sorted[i];
        if (current.commentType !== "status_change" || current.statusTo !== "blocked") {
          continue;
        }

        const blockedAtMs = Date.parse(current.createdAt);
        if (Number.isNaN(blockedAtMs)) {
          continue;
        }

        const resolution = sorted.slice(i + 1).find((candidate) => (
          candidate.commentType === "status_change"
          && candidate.statusFrom === "blocked"
          && candidate.statusTo !== "blocked"
        ));

        if (!resolution) {
          continue;
        }

        const resolvedAtMs = Date.parse(resolution.createdAt);
        if (Number.isNaN(resolvedAtMs) || resolvedAtMs <= blockedAtMs) {
          continue;
        }

        blockedToResolvedDurationsMs.push(resolvedAtMs - blockedAtMs);
        break;
      }
    }

    const meanTimeBlockedToResolvedMinutes = blockedToResolvedDurationsMs.length > 0
      ? Number((blockedToResolvedDurationsMs.reduce((sum, duration) => sum + duration, 0) / blockedToResolvedDurationsMs.length / 60000).toFixed(2))
      : null;

    const fullStats: FullStats = {
      total: stats.total,
      byStatus: stats.byStatus,
      byPriority: stats.byPriority,
      byAssignee,
      byProject,
      columns: columnsWithCounts,
      commentQuality: {
        blockedWithValidCommentPercent,
        handoffsWithCommentPercent,
        meanTimeBlockedToResolvedMinutes,
      },
    };

    return NextResponse.json({ stats: fullStats });
  } catch (error) {
    console.error("Failed to get kanban stats:", error);
    return NextResponse.json(
      { error: "Failed to get kanban statistics" },
      { status: 500 }
    );
  }
}

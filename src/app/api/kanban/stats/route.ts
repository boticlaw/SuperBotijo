import { NextResponse } from "next/server";
import { getTasksStats, getColumns, listTasks } from "@/lib/kanban-db";

export const dynamic = "force-dynamic";

interface AssigneeStats {
  assignee: string | null;
  count: number;
}

interface FullStats {
  total: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  byAssignee: AssigneeStats[];
  columns: Array<{
    id: string;
    name: string;
    taskCount: number;
    limit: number | null;
  }>;
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

    const fullStats: FullStats = {
      total: stats.total,
      byStatus: stats.byStatus,
      byPriority: stats.byPriority,
      byAssignee,
      columns: columnsWithCounts,
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

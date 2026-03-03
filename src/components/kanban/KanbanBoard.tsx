"use client";

import { useState, useCallback } from "react";
import { Plus, Filter } from "lucide-react";
import { KanbanColumn } from "./KanbanColumn";
import type { KanbanTask, KanbanColumn as KanbanColumnType } from "@/lib/kanban-db";
import type { Project } from "@/lib/mission-types";

interface ProjectWithStats extends Project {
  taskCount: number;
  progress: number;
}

interface KanbanBoardProps {
  columns: KanbanColumnType[];
  tasks: KanbanTask[];
  projects: ProjectWithStats[];
  selectedProjectId: string | null;
  onProjectFilterChange: (projectId: string | null) => void;
  onTaskClick: (task: KanbanTask) => void;
  onAddTask: (columnId: string) => void;
  onAddColumn: () => void;
  onMoveTask: (taskId: string, targetColumnId: string, targetOrder?: number) => Promise<void>;
}

export function KanbanBoard({
  columns,
  tasks,
  projects,
  selectedProjectId,
  onProjectFilterChange,
  onTaskClick,
  onAddTask,
  onAddColumn,
  onMoveTask,
}: KanbanBoardProps) {
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);

  const handleDragStart = useCallback((e: React.DragEvent, task: KanbanTask) => {
    setDraggingTaskId(task.id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", task.id);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggingTaskId(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent, columnId: string) => {
      e.preventDefault();
      const taskId = e.dataTransfer.getData("text/plain");

      if (taskId && draggingTaskId) {
        // Find the task being moved
        const task = tasks.find((t) => t.id === taskId);
        if (task && task.status !== columnId) {
          await onMoveTask(taskId, columnId);
        }
      }

      setDraggingTaskId(null);
    },
    [draggingTaskId, tasks, onMoveTask]
  );

  // Sort columns by order
  const sortedColumns = [...columns].sort((a, b) => a.order - b.order);

  // Filter tasks by selected project
  const filteredTasks = selectedProjectId === null
    ? tasks
    : selectedProjectId === "unassigned"
      ? tasks.filter((t) => t.projectId === null)
      : tasks.filter((t) => t.projectId === selectedProjectId);

  // Group tasks by column
  const tasksByColumn = sortedColumns.map((column) => ({
    column,
    tasks: filteredTasks
      .filter((t) => t.status === column.id)
      .sort((a, b) => a.order - b.order),
  }));

  return (
    <div className="flex h-full flex-col">
      {/* Board Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1
            className="text-2xl font-bold"
            style={{ color: "var(--text-primary)" }}
          >
            Kanban Board
          </h1>
          <p
            className="text-sm"
            style={{ color: "var(--text-muted)" }}
          >
            Drag and drop tasks to organize your workflow
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Project Filter */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4" style={{ color: "var(--text-muted)" }} />
            <select
              value={selectedProjectId || ""}
              onChange={(e) => onProjectFilterChange(e.target.value || null)}
              className="rounded-lg border px-3 py-2 text-sm outline-none cursor-pointer"
              style={{
                backgroundColor: "var(--card)",
                borderColor: "var(--border)",
                color: "var(--text-secondary)",
              }}
            >
              <option value="">All Projects</option>
              <option value="unassigned">Unassigned</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={onAddColumn}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
            style={{
              backgroundColor: "var(--card)",
              border: "1px solid var(--border)",
              color: "var(--text-secondary)",
            }}
          >
            <Plus className="h-4 w-4" />
            Add Column
          </button>
        </div>
      </div>

      {/* Columns Container */}
      <div className="flex-1 overflow-x-auto pb-4">
        <div className="flex gap-4 h-full min-h-[600px]">
          {tasksByColumn.map(({ column, tasks: columnTasks }) => (
            <KanbanColumn
              key={column.id}
              column={column}
              tasks={columnTasks}
              onTaskClick={onTaskClick}
              onAddTask={onAddTask}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              draggingTaskId={draggingTaskId}
            />
          ))}

          {/* Empty State */}
          {columns.length === 0 && (
            <div
              className="flex flex-1 items-center justify-center rounded-xl"
              style={{
                backgroundColor: "var(--card)",
                border: "1px solid var(--border)",
              }}
            >
              <div className="text-center">
                <p
                  className="text-lg font-medium"
                  style={{ color: "var(--text-primary)" }}
                >
                  No columns yet
                </p>
                <p
                  className="mt-1 text-sm"
                  style={{ color: "var(--text-muted)" }}
                >
                  Click &quot;Add Column&quot; to get started
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

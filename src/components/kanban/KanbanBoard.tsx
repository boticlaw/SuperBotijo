"use client";

import { useState, useCallback } from "react";
import { Plus } from "lucide-react";
import { KanbanColumn } from "./KanbanColumn";
import { useI18n } from "@/i18n/provider";
import type { KanbanTask, KanbanColumn as KanbanColumnType } from "@/lib/kanban-db";

interface KanbanBoardProps {
  columns: KanbanColumnType[];
  tasks: KanbanTask[];
  onTaskClick: (task: KanbanTask) => void;
  onAddTask: (columnId: string) => void;
  onAddColumn: () => void;
  onMoveTask: (taskId: string, targetColumnId: string, targetOrder?: number) => Promise<void>;
  // Agent filters
  configuredAgents?: string[];
  createdByFilter?: string | null;
  assigneeFilter?: string | null;
  onCreatedByFilterChange?: (agentId: string | null) => void;
  onAssigneeFilterChange?: (agentId: string | null) => void;
  // Domain filters
  domains?: { id: string; name: string }[];
  domainFilter?: string | null;
  onDomainFilterChange?: (domain: string | null) => void;
}

export function KanbanBoard({
  columns,
  tasks,
  onTaskClick,
  onAddTask,
  onAddColumn,
  onMoveTask,
  configuredAgents = [],
  createdByFilter = null,
  assigneeFilter = null,
  onCreatedByFilterChange,
  onAssigneeFilterChange,
  domains = [],
  domainFilter = null,
  onDomainFilterChange,
}: KanbanBoardProps) {
  const { t } = useI18n();
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

  // Filter tasks by agent filters
  let filteredTasks = tasks;

  // Filter by domain
  if (domainFilter) {
    if (domainFilter === "unassigned") {
      filteredTasks = filteredTasks.filter((t) => !t.domain);
    } else {
      filteredTasks = filteredTasks.filter((t) => t.domain === domainFilter);
    }
  }

  // Filter by creator agent
  if (createdByFilter) {
    filteredTasks = filteredTasks.filter((t) => t.createdBy === createdByFilter);
  }

  // Filter by assignee agent
  if (assigneeFilter) {
    filteredTasks = filteredTasks.filter((t) => t.assignee === assigneeFilter);
  }

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
            {t("kanban.title")}
          </h1>
          <p
            className="text-sm"
            style={{ color: "var(--text-muted)" }}
          >
            {t("kanban.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Domain Filter - Only show if there are domains */}
          {domains.length > 0 && onDomainFilterChange && (
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>{t("kanban.domain")}</span>
              <select
                value={domainFilter || ""}
                onChange={(e) => onDomainFilterChange(e.target.value || null)}
                className="rounded-lg border px-2 py-1.5 text-xs outline-none cursor-pointer"
                style={{
                  backgroundColor: "var(--card)",
                  borderColor: "var(--border)",
                  color: "var(--text-secondary)",
                }}
              >
                <option value="">{t("common.all")}</option>
                {domains.map((domain) => (
                  <option key={domain.id} value={domain.id}>
                    {domain.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          
          {/* Agent Filters - Only show if there are configured agents */}
          {configuredAgents.length > 0 && (
            <>
              {/* Created By Filter */}
              {onCreatedByFilterChange && (
                <div className="flex items-center gap-2">
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>{t("kanban.createdBy")}</span>
                  <select
                    value={createdByFilter || ""}
                    onChange={(e) => onCreatedByFilterChange(e.target.value || null)}
                    className="rounded-lg border px-2 py-1.5 text-xs outline-none cursor-pointer"
                    style={{
                      backgroundColor: "var(--card)",
                      borderColor: "var(--border)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    <option value="">{t("common.all")}</option>
                    {configuredAgents.map((agentId) => (
                      <option key={agentId} value={agentId}>
                        {agentId}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Assignee Filter */}
              {onAssigneeFilterChange && (
                <div className="flex items-center gap-2">
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>{t("kanban.assignedTo")}</span>
                  <select
                    value={assigneeFilter || ""}
                    onChange={(e) => onAssigneeFilterChange(e.target.value || null)}
                    className="rounded-lg border px-2 py-1.5 text-xs outline-none cursor-pointer"
                    style={{
                      backgroundColor: "var(--card)",
                      borderColor: "var(--border)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    <option value="">{t("common.all")}</option>
                    {configuredAgents.map((agentId) => (
                      <option key={agentId} value={agentId}>
                        {agentId}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}
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
            {t("kanban.addColumn")}
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
                  {t("kanban.noColumns")}
                </p>
                <p
                  className="mt-1 text-sm"
                  style={{ color: "var(--text-muted)" }}
                >
                  {t("kanban.noColumnsHint")}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

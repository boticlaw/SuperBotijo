"use client";

import { useState } from "react";
import { Plus, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { KanbanTask } from "./KanbanTask";
import { useI18n } from "@/i18n/provider";
import type { KanbanTask as KanbanTaskType, KanbanColumn as KanbanColumnType } from "@/lib/kanban-db";

interface KanbanColumnProps {
  column: KanbanColumnType;
  tasks: KanbanTaskType[];
  onTaskClick: (task: KanbanTaskType) => void;
  onAddTask: (columnId: string) => void;
  onDragStart: (e: React.DragEvent, task: KanbanTaskType) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, columnId: string) => void;
  draggingTaskId: string | null;
}

export function KanbanColumn({
  column,
  tasks,
  onTaskClick,
  onAddTask,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  draggingTaskId,
}: KanbanColumnProps) {
  const { t } = useI18n();
  const [isDragOver, setIsDragOver] = useState(false);

  const taskCount = tasks.length;
  const isOverLimit = column.limit !== null && taskCount > column.limit;

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(true);
    onDragOver(e);
  }

  function handleDragLeave() {
    setIsDragOver(false);
  }

  function handleDrop(e: React.DragEvent) {
    setIsDragOver(false);
    onDrop(e, column.id);
  }

  return (
    <div
      className="flex h-full w-72 flex-shrink-0 flex-col rounded-xl"
      style={{
        backgroundColor: "var(--card)",
        border: isDragOver ? "2px dashed var(--accent)" : "1px solid var(--border)",
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Column Header */}
      <div
        className="flex items-center justify-between rounded-t-xl px-4 py-3"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-2">
          <div
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: column.color }}
          />
          <h3
            className="text-sm font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            {column.name}
          </h3>
          <span
            className="rounded-full px-2 py-0.5 text-xs font-medium"
            style={{
              backgroundColor: "var(--card-elevated)",
              color: "var(--text-muted)",
            }}
          >
            {taskCount}
          </span>
        </div>

        {/* WIP Limit Indicator */}
        {column.limit !== null && (
          <div className="flex items-center gap-1">
            {isOverLimit ? (
              <AlertTriangle className="h-4 w-4" style={{ color: "var(--warning)" }} />
            ) : null}
            <span
              className="text-xs"
              style={{
                color: isOverLimit ? "var(--warning)" : "var(--text-muted)",
              }}
            >
              {taskCount}/{column.limit}
            </span>
          </div>
        )}
      </div>

      {/* Tasks Container */}
      <div className="flex-1 overflow-y-auto p-3">
        <AnimatePresence mode="popLayout">
          <div className="flex flex-col gap-1.5">
            {tasks.map((task) => (
              <KanbanTask
                key={task.id}
                task={task}
                onClick={() => onTaskClick(task)}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
                isDragging={draggingTaskId === task.id}
              />
            ))}
          </div>
        </AnimatePresence>

        {/* Empty State */}
        {tasks.length === 0 && !isDragOver && (
          <div
            className="flex h-24 items-center justify-center rounded-lg border-2 border-dashed"
            style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
          >
            <p className="text-xs">{t("kanban.noTasks")}</p>
          </div>
        )}

        {/* Drop Zone Indicator */}
        {isDragOver && tasks.length === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex h-24 items-center justify-center rounded-lg"
            style={{
              backgroundColor: "rgba(255, 59, 48, 0.1)",
              border: "2px dashed var(--accent)",
            }}
          >
            <p className="text-sm font-medium" style={{ color: "var(--accent)" }}>
              {t("kanban.dropHere")}
            </p>
          </motion.div>
        )}
      </div>

      {/* Add Task Button */}
      <div className="p-3 pt-0">
        <button
          onClick={() => onAddTask(column.id)}
          className="flex w-full items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-colors"
          style={{
            backgroundColor: "var(--card-elevated)",
            color: "var(--text-secondary)",
            border: "1px solid var(--border)",
          }}
        >
          <Plus className="h-4 w-4" />
          {t("kanban.addTask")}
        </button>
      </div>
    </div>
  );
}

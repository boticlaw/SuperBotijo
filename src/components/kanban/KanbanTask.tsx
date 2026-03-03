"use client";

import { GripVertical, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import type { KanbanTask as KanbanTaskType, KanbanLabel } from "@/lib/kanban-db";

interface KanbanTaskProps {
  task: KanbanTaskType;
  onClick: () => void;
  onDragStart: (e: React.DragEvent, task: KanbanTaskType) => void;
  onDragEnd: (e: React.DragEvent) => void;
  isDragging: boolean;
}

const PRIORITY_CONFIG = {
  low: { color: "var(--text-muted)", bgColor: "rgba(82, 82, 82, 0.2)" },
  medium: { color: "var(--info)", bgColor: "rgba(10, 132, 255, 0.15)" },
  high: { color: "var(--warning)", bgColor: "rgba(255, 214, 10, 0.15)" },
  critical: { color: "var(--error)", bgColor: "rgba(255, 69, 58, 0.15)" },
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 70%, 50%)`;
}

export function KanbanTask({ task, onClick, onDragStart, onDragEnd, isDragging }: KanbanTaskProps) {
  const priorityConfig = PRIORITY_CONFIG[task.priority];

  function handleDragStart(e: React.DragEvent) {
    onDragStart(e, task);
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className="group cursor-grab active:cursor-grabbing"
    >
      <motion.div
        layout
        layoutId={task.id}
        initial={{ opacity: 0, y: 10 }}
        animate={{
          opacity: isDragging ? 0.5 : 1,
          y: 0,
          scale: isDragging ? 1.02 : 1,
        }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.15 }}
        className="rounded-lg border transition-shadow hover:shadow-lg"
        style={{
          backgroundColor: "var(--card)",
          borderColor: isDragging ? "var(--accent)" : "var(--border)",
        }}
      >
        {/* Priority indicator bar */}
        <div
          className="h-1 rounded-t-lg"
          style={{ backgroundColor: priorityConfig.color }}
        />

        <div className="p-3">
          {/* Header with drag handle */}
          <div className="flex items-start gap-2">
            <div
              className="mt-0.5 cursor-grab opacity-0 transition-opacity group-hover:opacity-100"
              style={{ color: "var(--text-muted)" }}
            >
              <GripVertical className="h-4 w-4" />
            </div>

            <div className="flex-1 min-w-0">
              <h4
                className="text-sm font-medium line-clamp-2"
                style={{ color: "var(--text-primary)" }}
              >
                {task.title}
              </h4>

              {task.description && (
                <p
                  className="mt-1 text-xs line-clamp-2"
                  style={{ color: "var(--text-muted)" }}
                >
                  {task.description}
                </p>
              )}
            </div>
          </div>

          {/* Labels */}
          {task.labels.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {task.labels.map((label, index) => (
                <LabelBadge key={`${label.name}-${index}`} label={label} />
              ))}
            </div>
          )}

          {/* Footer: Priority + Assignee */}
          <div className="mt-3 flex items-center justify-between">
            <span
              className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium"
              style={{
                backgroundColor: priorityConfig.bgColor,
                color: priorityConfig.color,
              }}
            >
              {task.priority === "critical" && <AlertCircle className="h-3 w-3" />}
              {task.priority}
            </span>

            {task.assignee && (
              <div
                className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold"
                style={{
                  backgroundColor: stringToColor(task.assignee),
                  color: "white",
                }}
                title={task.assignee}
              >
                {getInitials(task.assignee)}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function LabelBadge({ label }: { label: KanbanLabel }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
      style={{
        backgroundColor: `${label.color}20`,
        color: label.color,
        border: `1px solid ${label.color}40`,
      }}
    >
      {label.name}
    </span>
  );
}

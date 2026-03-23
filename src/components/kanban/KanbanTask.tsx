"use client";

import { AlertCircle, Lock, Clock, Play, CheckCircle, XCircle, PauseCircle, MessageSquare } from "lucide-react";
import { motion } from "framer-motion";
import { useI18n } from "@/i18n/provider";
import type { KanbanTask as KanbanTaskType } from "@/lib/kanban-db";

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

function getDomainColor(domain: string): string {
  const colors: Record<string, string> = {
    work: "#3b82f6",
    finance: "#22c55e",
    personal: "#ec4899",
    communication: "#f59e0b",
    admin: "#8b5cf6",
    general: "#6b7280",
  };
  return colors[domain.toLowerCase()] || colors.general;
}

function getExecutionIcon(status: string) {
  const icons: Record<string, React.ReactNode> = {
    running: <Play className="h-3 w-3" />,
    success: <CheckCircle className="h-3 w-3" />,
    error: <XCircle className="h-3 w-3" />,
    skipped: <PauseCircle className="h-3 w-3" />,
    pending: <Clock className="h-3 w-3" />,
  };
  return icons[status] || icons.pending;
}

export function KanbanTask({ task, onClick, onDragStart, onDragEnd, isDragging }: KanbanTaskProps) {
  const { t } = useI18n();
  const priorityConfig = PRIORITY_CONFIG[task.priority];

  function handleDragStart(e: React.DragEvent) {
    onDragStart(e, task);
  }

  // Build metadata indicators for the compact view
  const hasMetadata =
    task.claimedBy ||
    task.executionStatus ||
    task.labels.length > 0 ||
    task.domain ||
    task.priority === "high" ||
    task.priority === "critical";

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
        className="rounded border transition-shadow hover:shadow-md"
        style={{
          backgroundColor: "var(--card)",
          borderColor: isDragging ? "var(--accent)" : "var(--border)",
          borderLeftColor: priorityConfig.color,
          borderLeftWidth: "3px",
        }}
      >
        <div className="px-2.5 py-2">
          {/* Title row */}
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <h4
                className="text-xs font-medium leading-tight line-clamp-2"
                style={{ color: "var(--text-primary)" }}
                title={task.title}
              >
                {task.title}
              </h4>
            </div>

            {/* Assignee avatar - compact */}
            {task.assignee && (
              <div
                className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
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

          {/* Metadata row - single line with dots */}
          {hasMetadata && (
            <div className="mt-1.5 flex items-center gap-1 flex-wrap">
              {/* Domain dot */}
              {task.domain && (
                <span
                  className="h-2 w-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: getDomainColor(task.domain) }}
                  title={task.domain}
                />
              )}

              {/* Labels as colored dots */}
              {task.labels.slice(0, 3).map((label, index) => (
                <span
                  key={`${label.name}-${index}`}
                  className="h-2 w-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: label.color }}
                  title={label.name}
                />
              ))}

              {/* Claimed indicator */}
              {task.claimedBy && (
                <span
                  className="flex items-center gap-0.5 text-[10px]"
                  style={{ color: "var(--warning)" }}
                  title={t("kanban.claimedBy", { name: task.claimedBy })}
                >
                  <Lock className="h-2.5 w-2.5" />
                </span>
              )}

              {/* Execution status */}
              {task.executionStatus && (
                <span
                  className="flex items-center"
                  style={{
                    color: task.executionStatus === "success" ? "var(--success)" :
                           task.executionStatus === "error" ? "var(--error)" :
                           task.executionStatus === "running" ? "var(--info)" : "var(--text-muted)"
                  }}
                  title={`${task.executionStatus}${task.executionResult ? `: ${task.executionResult}` : ""}`}
                >
                  {getExecutionIcon(task.executionStatus)}
                </span>
              )}

              {/* Created by agent - subtle indicator */}
              {task.createdBy && (
                <span
                  className="text-[9px] px-1 rounded"
                  style={{
                    backgroundColor: "rgba(139, 92, 246, 0.15)",
                    color: "#a855f7",
                  }}
                  title={t("kanban.createdByAgent", { name: task.createdBy })}
                >
                  {t("kanban.bot")}
                </span>
              )}

              {/* Priority badge - only for high/critical */}
              {(task.priority === "high" || task.priority === "critical") && (
                <span
                  className="flex items-center gap-0.5 rounded px-1 py-0.5 text-[9px] font-medium"
                  style={{
                    backgroundColor: priorityConfig.bgColor,
                    color: priorityConfig.color,
                  }}
                >
                  {task.priority === "critical" && <AlertCircle className="h-2.5 w-2.5" />}
                  {task.priority.charAt(0).toUpperCase()}
                </span>
              )}

              {/* Comment counter */}
              {typeof task.commentCount === "number" && task.commentCount > 0 && (
                <span
                  className="flex items-center gap-0.5 rounded px-1 py-0.5 text-[9px] font-medium"
                  style={{
                    backgroundColor: "var(--card-elevated)",
                    color: "var(--text-muted)",
                  }}
                >
                  <MessageSquare className="h-2.5 w-2.5" />
                  {task.commentCount}
                </span>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

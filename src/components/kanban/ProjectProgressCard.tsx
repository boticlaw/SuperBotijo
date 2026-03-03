"use client";

import { FolderOpen } from "lucide-react";

interface ProjectProgressCardProps {
  id: string;
  name: string;
  taskCount: number;
  progress: number;
  onClick?: () => void;
  isActive?: boolean;
}

export function ProjectProgressCard({
  name,
  taskCount,
  progress,
  onClick,
  isActive = false,
}: ProjectProgressCardProps) {
  // Determine progress bar color based on completion
  const getProgressColor = (value: number): string => {
    if (value >= 80) return "var(--success)";
    if (value >= 50) return "var(--info)";
    if (value >= 25) return "var(--warning)";
    return "var(--text-muted)";
  };

  return (
    <div
      onClick={onClick}
      className="rounded-xl p-4 transition-all cursor-pointer"
      style={{
        backgroundColor: isActive ? "var(--card-elevated)" : "var(--card)",
        border: `1px solid ${isActive ? "var(--accent)" : "var(--border)"}`,
        boxShadow: isActive ? "0 0 0 1px var(--accent)" : "none",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <FolderOpen
            className="h-4 w-4"
            style={{ color: isActive ? "var(--accent)" : "var(--text-muted)" }}
          />
          <span
            className="text-sm font-medium truncate max-w-[150px]"
            style={{ color: "var(--text-primary)" }}
            title={name}
          >
            {name}
          </span>
        </div>
        <span
          className="text-xs px-2 py-0.5 rounded-full"
          style={{
            backgroundColor: "var(--card-elevated)",
            color: "var(--text-muted)",
          }}
        >
          {taskCount} {taskCount === 1 ? "task" : "tasks"}
        </span>
      </div>

      {/* Progress Bar */}
      <div className="space-y-1">
        <div
          className="h-2 rounded-full overflow-hidden"
          style={{ backgroundColor: "var(--card-elevated)" }}
        >
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${progress}%`,
              backgroundColor: getProgressColor(progress),
            }}
          />
        </div>
        <div className="flex justify-between text-xs">
          <span style={{ color: "var(--text-muted)" }}>Progress</span>
          <span
            className="font-medium"
            style={{ color: getProgressColor(progress) }}
          >
            {progress}%
          </span>
        </div>
      </div>
    </div>
  );
}

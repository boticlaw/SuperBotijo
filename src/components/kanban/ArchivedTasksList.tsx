"use client";

import { useState, useMemo } from "react";
import { Search, RotateCcw, Tag, X } from "lucide-react";
import { useI18n } from "@/i18n/provider";
import type { KanbanTask, KanbanLabel, TaskPriority } from "@/lib/kanban-db";

interface ArchivedTasksListProps {
  tasks: KanbanTask[];
  onRestore: (taskId: string) => void;
  onTaskClick: (task: KanbanTask) => void;
}

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  low: "var(--text-muted)",
  medium: "var(--info)",
  high: "var(--warning)",
  critical: "var(--error)",
};

// Simple relative time formatter
function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

export function ArchivedTasksList({ tasks, onRestore, onTaskClick }: ArchivedTasksListProps) {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | "all">("all");
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);

  // Extract all unique labels from archived tasks
  const allLabels = useMemo(() => {
    const labelMap = new Map<string, KanbanLabel>();
    for (const task of tasks) {
      for (const label of task.labels || []) {
        labelMap.set(label.name, label);
      }
    }
    return Array.from(labelMap.values());
  }, [tasks]);

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      // Search filter
      if (search) {
        const searchLower = search.toLowerCase();
        const matchesTitle = task.title.toLowerCase().includes(searchLower);
        const matchesDesc = task.description?.toLowerCase().includes(searchLower);
        if (!matchesTitle && !matchesDesc) return false;
      }

      // Priority filter
      if (priorityFilter !== "all" && task.priority !== priorityFilter) {
        return false;
      }

      // Labels filter
      if (selectedLabels.length > 0) {
        const taskLabelNames = (task.labels || []).map((l) => l.name);
        const hasAllLabels = selectedLabels.every((label) => taskLabelNames.includes(label));
        if (!hasAllLabels) return false;
      }

      return true;
    });
  }, [tasks, search, priorityFilter, selectedLabels]);

  function toggleLabel(labelName: string) {
    setSelectedLabels((prev) =>
      prev.includes(labelName)
        ? prev.filter((l) => l !== labelName)
        : [...prev, labelName]
    );
  }

  function clearFilters() {
    setSearch("");
    setPriorityFilter("all");
    setSelectedLabels([]);
  }

  const hasActiveFilters = search || priorityFilter !== "all" || selectedLabels.length > 0;

  if (tasks.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center rounded-xl p-12 text-center"
        style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
      >
        <div
          className="mb-4 rounded-full p-4"
          style={{ backgroundColor: "var(--surface-elevated)" }}
        >
          <Tag className="h-8 w-8" style={{ color: "var(--text-muted)" }} />
        </div>
        <p className="text-lg font-medium" style={{ color: "var(--text-primary)" }}>
          {t("kanban.archived.empty")}
        </p>
        <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
          {t("kanban.archived.emptyHint")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div
        className="flex flex-wrap items-center gap-2 rounded-xl p-3"
        style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
      >
        {/* Search */}
        <div className="relative flex-1 min-w-[180px]">
          <Search
            className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
            style={{ color: "var(--text-muted)" }}
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("kanban.archived.searchPlaceholder")}
            className="w-full rounded-lg border py-1.5 pl-8 pr-3 text-sm outline-none"
            style={{
              backgroundColor: "var(--card-elevated)",
              borderColor: "var(--border)",
              color: "var(--text-primary)",
            }}
          />
        </div>

        {/* Priority filter */}
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value as TaskPriority | "all")}
          className="rounded-lg border px-2 py-1.5 text-sm outline-none"
          style={{
            backgroundColor: "var(--card-elevated)",
            borderColor: "var(--border)",
            color: "var(--text-primary)",
          }}
        >
          <option value="all">{t("kanban.archived.allPriorities")}</option>
          <option value="critical">{t("kanban.priorities.critical")}</option>
          <option value="high">{t("kanban.priorities.high")}</option>
          <option value="medium">{t("kanban.priorities.medium")}</option>
          <option value="low">{t("kanban.priorities.low")}</option>
        </select>

        {/* Labels filter */}
        {allLabels.length > 0 && (
          <div className="flex flex-wrap items-center gap-1">
            {allLabels.map((label) => (
              <button
                key={label.name}
                onClick={() => toggleLabel(label.name)}
                className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium transition-all"
                style={{
                  backgroundColor: selectedLabels.includes(label.name)
                    ? `${label.color}30`
                    : "var(--surface-elevated)",
                  color: selectedLabels.includes(label.name) ? label.color : "var(--text-muted)",
                  border: `1px solid ${selectedLabels.includes(label.name) ? label.color : "var(--border)"}`,
                }}
              >
                {label.name}
              </button>
            ))}
          </div>
        )}

        {/* Clear filters */}
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs transition-colors"
            style={{
              color: "var(--text-muted)",
              backgroundColor: "var(--surface-elevated)",
            }}
          >
            <X className="h-3 w-3" />
            {t("kanban.archived.clearFilters")}
          </button>
        )}
      </div>

      {/* Results count */}
      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
        {t("kanban.archived.showing", { count: filteredTasks.length, total: tasks.length })}
      </p>

      {/* Tasks list - compact */}
      <div
        className="overflow-hidden rounded-xl"
        style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
      >
        <div className="divide-y" style={{ borderColor: "var(--border)" }}>
          {filteredTasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center gap-3 px-3 py-2 transition-colors hover:bg-white/5"
            >
              {/* Title + priority + labels - single line when possible */}
              <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => onTaskClick(task)}
                  className="truncate text-sm text-left hover:underline cursor-pointer"
                  style={{ color: "var(--text-primary)" }}
                  title={task.title}
                >
                  {task.title}
                </button>

                {/* Priority indicator */}
                <span
                  className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase"
                  style={{
                    backgroundColor: `${PRIORITY_COLORS[task.priority]}20`,
                    color: PRIORITY_COLORS[task.priority],
                  }}
                >
                  {task.priority.charAt(0)}
                </span>

                {/* Labels - compact */}
                {(task.labels?.length ?? 0) > 0 && (
                  <div className="flex flex-wrap gap-0.5">
                    {task.labels!.slice(0, 3).map((label) => (
                      <span
                        key={label.name}
                        className="rounded px-1.5 py-0.5 text-[10px]"
                        style={{
                          backgroundColor: `${label.color}20`,
                          color: label.color,
                        }}
                      >
                        {label.name}
                      </span>
                    ))}
                    {(task.labels?.length ?? 0) > 3 && (
                      <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                        +{task.labels!.length - 3}
                      </span>
                    )}
                  </div>
                )}

                {/* Archived date */}
                {task.archivedAt && (
                  <span className="text-[10px] shrink-0" style={{ color: "var(--text-muted)" }}>
                    {formatRelativeTime(task.archivedAt)}
                  </span>
                )}
              </div>

              {/* Restore button */}
              <button
                onClick={() => onRestore(task.id)}
                className="flex shrink-0 items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors"
                style={{
                  color: "var(--accent)",
                  backgroundColor: "var(--surface-elevated)",
                }}
                title={t("kanban.archiveActions.unarchiveHint")}
              >
                <RotateCcw className="h-3 w-3" />
                <span className="hidden sm:inline">{t("kanban.archiveActions.unarchive")}</span>
              </button>
            </div>
          ))}
        </div>

        {filteredTasks.length === 0 && (
          <div className="p-6 text-center">
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              {t("kanban.archived.noResults")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

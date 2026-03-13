"use client";

import { useState, useMemo } from "react";
import { Search, RotateCcw, Tag, X } from "lucide-react";
import { useI18n } from "@/i18n/provider";
import type { KanbanTask, KanbanLabel, TaskPriority } from "@/lib/kanban-db";

interface ArchivedTasksListProps {
  tasks: KanbanTask[];
  onRestore: (taskId: string) => void;
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

export function ArchivedTasksList({ tasks, onRestore }: ArchivedTasksListProps) {
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
    <div className="space-y-4">
      {/* Filters */}
      <div
        className="flex flex-wrap items-center gap-3 rounded-xl p-4"
        style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
      >
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
            style={{ color: "var(--text-muted)" }}
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("kanban.archived.searchPlaceholder")}
            className="w-full rounded-lg border py-2 pl-10 pr-4 text-sm outline-none"
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
          className="rounded-lg border px-3 py-2 text-sm outline-none"
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
                className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium transition-all"
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
            className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm transition-colors"
            style={{
              color: "var(--text-muted)",
              backgroundColor: "var(--surface-elevated)",
            }}
          >
            <X className="h-4 w-4" />
            {t("kanban.archived.clearFilters")}
          </button>
        )}
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between">
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          {t("kanban.archived.showing", { count: filteredTasks.length, total: tasks.length })}
        </p>
      </div>

      {/* Tasks list */}
      <div
        className="overflow-hidden rounded-xl"
        style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
      >
        <div className="divide-y" style={{ borderColor: "var(--border)" }}>
          {filteredTasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center gap-4 p-4 transition-colors hover:bg-white/5"
            >
              {/* Task info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3
                    className="truncate font-medium"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {task.title}
                  </h3>
                  {/* Priority badge */}
                  <span
                    className="shrink-0 rounded px-2 py-0.5 text-xs font-medium"
                    style={{
                      backgroundColor: `${PRIORITY_COLORS[task.priority]}20`,
                      color: PRIORITY_COLORS[task.priority],
                    }}
                  >
                    {t(`kanban.priorities.${task.priority}`)}
                  </span>
                </div>

                {/* Labels */}
                {(task.labels?.length ?? 0) > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {task.labels!.map((label) => (
                      <span
                        key={label.name}
                        className="inline-flex items-center rounded-full px-2 py-0.5 text-xs"
                        style={{
                          backgroundColor: `${label.color}20`,
                          color: label.color,
                        }}
                      >
                        {label.name}
                      </span>
                    ))}
                  </div>
                )}

                {/* Metadata */}
                <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                  {task.archivedAt && (
                    <>
                      {t("kanban.archived.archivedAgo", {
                        time: formatRelativeTime(task.archivedAt)
                      })}
                      {task.description && " · "}
                    </>
                  )}
                  {task.description && (
                    <span className="truncate">{task.description}</span>
                  )}
                </p>
              </div>

              {/* Actions */}
              <button
                onClick={() => onRestore(task.id)}
                className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
                style={{
                  color: "var(--accent)",
                  backgroundColor: "var(--surface-elevated)",
                  border: "1px solid var(--border)",
                }}
                title={t("kanban.archiveActions.unarchiveHint")}
              >
                <RotateCcw className="h-4 w-4" />
                {t("kanban.archiveActions.unarchive")}
              </button>
            </div>
          ))}
        </div>

        {filteredTasks.length === 0 && (
          <div className="p-8 text-center">
            <p style={{ color: "var(--text-muted)" }}>
              {t("kanban.archived.noResults")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

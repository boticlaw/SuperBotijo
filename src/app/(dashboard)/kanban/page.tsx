"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { RefreshCw, AlertCircle, Play, CheckCircle, XCircle, Clock, Calendar, Archive, Inbox } from "lucide-react";
import { KanbanBoard, TaskModal } from "@/components/kanban";
import { useI18n } from "@/i18n/provider";
import type { KanbanTask, KanbanColumn } from "@/lib/kanban-db";

type ExecutionFilter = "all" | "running" | "success" | "error" | "pending" | "none";
type ArchiveView = "active" | "archived";

export default function KanbanPage() {
  const { t } = useI18n();
  const [columns, setColumns] = useState<KanbanColumn[]>([]);
  const [tasks, setTasks] = useState<KanbanTask[]>([]);
  const [executionFilter, setExecutionFilter] = useState<ExecutionFilter>("all");
  const [archiveView, setArchiveView] = useState<ArchiveView>("active");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<KanbanTask | null>(null);
  const [addColumnModalOpen, setAddColumnModalOpen] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");
  const [newColumnColor, setNewColumnColor] = useState("#3b82f6");
  // Agent filter state
  const [configuredAgents, setConfiguredAgents] = useState<string[]>([]);
  const [createdByFilter, setCreatedByFilter] = useState<string | null>(null);
  const [assigneeFilter, setAssigneeFilter] = useState<string | null>(null);
  // Domain filter state
  const [domains, setDomains] = useState<{ id: string; name: string }[]>([]);
  const [domainFilter, setDomainFilter] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [columnsRes, tasksRes, agentsRes, domainsRes] = await Promise.all([
        fetch("/api/kanban/columns"),
        fetch(`/api/kanban/tasks?view=${archiveView}`),
        fetch("/api/kanban/agent/ids").catch(() => ({ ok: false, json: async () => ({ agents: [] }) })),
        fetch("/api/kanban/agent/domains").catch(() => ({ ok: false, json: async () => ({ domains: [] }) })),
      ]);

      if (!columnsRes.ok || !tasksRes.ok) {
        throw new Error("Failed to fetch kanban data");
      }

      const columnsData = await columnsRes.json();
      const tasksData = await tasksRes.json();
      const agentsData = agentsRes.ok ? await agentsRes.json() : { agents: [] };
      const domainsData = domainsRes.ok ? await domainsRes.json() : { domains: [] };

      setColumns(columnsData.columns || []);
      setTasks(tasksData.tasks || []);
      setConfiguredAgents(agentsData.agents || []);
      setDomains(domainsData.domains || []);
    } catch (err) {
      console.error("Failed to fetch kanban data:", err);
      setError(err instanceof Error ? err.message : "Failed to load kanban board");
    } finally {
      setLoading(false);
    }
  }, [archiveView]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter tasks by execution status
  const filteredTasks = useMemo(() => {
    if (executionFilter === "all") return tasks;
    if (executionFilter === "none") return tasks.filter((t) => !t.executionStatus);
    return tasks.filter((t) => t.executionStatus === executionFilter);
  }, [tasks, executionFilter]);

  // Count tasks by execution status
  const taskCounts = useMemo(() => {
    return {
      all: tasks.length,
      running: tasks.filter((t) => t.executionStatus === "running").length,
      success: tasks.filter((t) => t.executionStatus === "success").length,
      error: tasks.filter((t) => t.executionStatus === "error").length,
      pending: tasks.filter((t) => t.executionStatus === "pending").length,
      none: tasks.filter((t) => !t.executionStatus).length,
    };
  }, [tasks]);

  const handleTaskClick = useCallback((task: KanbanTask) => {
    setEditingTask(task);
    setIsModalOpen(true);
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleAddTask = useCallback((_columnId: string) => {
    setEditingTask(null);
    setIsModalOpen(true);
  }, []);

  const handleSaveTask = useCallback(async (taskData: Partial<KanbanTask>) => {
    try {
      if (editingTask) {
        // Update existing task
        const res = await fetch(`/api/kanban/tasks/${editingTask.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(taskData),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to update task");
        }
      }

      setIsModalOpen(false);
      setEditingTask(null);
      fetchData();
    } catch (err) {
      console.error("Failed to save task:", err);
      throw err;
    }
  }, [editingTask, fetchData]);

  const handleDeleteTask = useCallback(async (taskId: string) => {
    try {
      const res = await fetch(`/api/kanban/tasks/${taskId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete task");
      }

      fetchData();
    } catch (err) {
      console.error("Failed to delete task:", err);
    }
  }, [fetchData]);

  const handleMoveTask = useCallback(async (taskId: string, targetColumnId: string, targetOrder?: number) => {
    try {
      const res = await fetch(`/api/kanban/tasks/${taskId}/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetColumnId, targetOrder }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to move task");
      }

      fetchData();
    } catch (err) {
      console.error("Failed to move task:", err);
    }
  }, [fetchData]);

  const handleAddColumn = useCallback(async () => {
    if (!newColumnName.trim()) return;

    try {
      const res = await fetch("/api/kanban/columns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newColumnName.trim(),
          color: newColumnColor,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create column");
      }

      setNewColumnName("");
      setNewColumnColor("#3b82f6");
      setAddColumnModalOpen(false);
      fetchData();
    } catch (err) {
      console.error("Failed to create column:", err);
    }
  }, [newColumnName, newColumnColor, fetchData]);

  // Loading state
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div
          className="flex items-center gap-3 rounded-xl p-4"
          style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
        >
          <RefreshCw className="h-5 w-5 animate-spin" style={{ color: "var(--accent)" }} />
          <span style={{ color: "var(--text-secondary)" }}>{t("kanban.loading")}</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div
          className="flex items-center gap-3 rounded-xl p-4"
          style={{ backgroundColor: "var(--card)", border: "1px solid var(--error)" }}
        >
          <AlertCircle className="h-5 w-5" style={{ color: "var(--error)" }} />
          <span style={{ color: "var(--error)" }}>{error}</span>
          <button
            onClick={fetchData}
            className="rounded-lg px-3 py-1 text-sm font-medium"
            style={{ backgroundColor: "var(--accent)", color: "white" }}
          >
            {t("common.retry")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full p-4 md:p-6">
      {/* Archive View Toggle + Execution Status Filters */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Archive View Toggle */}
          <div className="mr-4 flex items-center gap-1 rounded-lg p-1" style={{ backgroundColor: "var(--surface-elevated)" }}>
            <button
              onClick={() => setArchiveView("active")}
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all"
              style={{
                backgroundColor: archiveView === "active" ? "var(--accent)" : "transparent",
                color: archiveView === "active" ? "white" : "var(--text-secondary)",
              }}
            >
              <Inbox className="h-4 w-4" />
              {t("kanban.archiveView.active")}
            </button>
            <button
              onClick={() => setArchiveView("archived")}
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all"
              style={{
                backgroundColor: archiveView === "archived" ? "var(--accent)" : "transparent",
                color: archiveView === "archived" ? "white" : "var(--text-secondary)",
              }}
            >
              <Archive className="h-4 w-4" />
              {t("kanban.archiveView.archived")}
            </button>
          </div>

          {/* Execution Filters (only show in active view) */}
          {archiveView === "active" && (
            <>
              <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                {t("kanban.filter")}
              </span>
              <FilterButton
                active={executionFilter === "all"}
                onClick={() => setExecutionFilter("all")}
                count={taskCounts.all}
                label={t("kanban.executionFilter.all")}
              />
              <FilterButton
                active={executionFilter === "running"}
                onClick={() => setExecutionFilter("running")}
                count={taskCounts.running}
                label={t("kanban.executionFilter.running")}
                icon={<Play className="h-3 w-3" />}
                color="var(--info)"
              />
              <FilterButton
                active={executionFilter === "success"}
                onClick={() => setExecutionFilter("success")}
                count={taskCounts.success}
                label={t("kanban.executionFilter.success")}
                icon={<CheckCircle className="h-3 w-3" />}
                color="var(--success)"
              />
              <FilterButton
                active={executionFilter === "error"}
                onClick={() => setExecutionFilter("error")}
                count={taskCounts.error}
                label={t("kanban.executionFilter.error")}
                icon={<XCircle className="h-3 w-3" />}
                color="var(--error)"
              />
              <FilterButton
                active={executionFilter === "pending"}
                onClick={() => setExecutionFilter("pending")}
                count={taskCounts.pending}
                label={t("kanban.executionFilter.pending")}
                icon={<Clock className="h-3 w-3" />}
                color="var(--warning)"
              />
              <FilterButton
                active={executionFilter === "none"}
                onClick={() => setExecutionFilter("none")}
                count={taskCounts.none}
                label={t("kanban.executionFilter.manual")}
                icon={<AlertCircle className="h-3 w-3" />}
                color="var(--text-muted)"
              />
            </>
          )}
        </div>

        {/* Cron Jobs Link */}
        <Link
          href="/cron"
          className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors hover:opacity-80"
          style={{
            backgroundColor: "var(--surface-elevated)",
            color: "var(--text-secondary)",
            border: "1px solid var(--border)",
          }}
        >
          <Calendar className="h-4 w-4" />
          {t("kanban.cronJobs")}
        </Link>
      </div>

      <KanbanBoard
        columns={columns}
        tasks={filteredTasks}
        onTaskClick={handleTaskClick}
        onAddTask={handleAddTask}
        onAddColumn={() => setAddColumnModalOpen(true)}
        onMoveTask={handleMoveTask}
        configuredAgents={configuredAgents}
        createdByFilter={createdByFilter}
        assigneeFilter={assigneeFilter}
        onCreatedByFilterChange={setCreatedByFilter}
        onAssigneeFilterChange={setAssigneeFilter}
        domains={domains}
        domainFilter={domainFilter}
        onDomainFilterChange={setDomainFilter}
      />

      {/* Task Modal */}
      <TaskModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingTask(null);
        }}
        onSave={handleSaveTask}
        onDelete={handleDeleteTask}
        columns={columns}
        editingTask={editingTask}
        onCommentsUpdated={fetchData}
      />

      {/* Add Column Modal */}
      {addColumnModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setAddColumnModalOpen(false)}
          />
          <div
            className="relative w-full max-w-md rounded-2xl p-6 shadow-2xl"
            style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
          >
            <h2
              className="mb-4 text-lg font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              {t("kanban.columnModal.title")}
            </h2>

            <div className="space-y-4">
              <div>
                <label
                  className="mb-2 block text-sm font-medium"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {t("kanban.columnModal.columnName")}
                </label>
                <input
                  type="text"
                  value={newColumnName}
                  onChange={(e) => setNewColumnName(e.target.value)}
                  placeholder={t("kanban.columnModal.columnNamePlaceholder")}
                  className="w-full rounded-lg border px-4 py-3 text-sm outline-none"
                  style={{
                    backgroundColor: "var(--card-elevated)",
                    borderColor: "var(--border)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>

              <div>
                <label
                  className="mb-2 block text-sm font-medium"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {t("kanban.columnModal.color")}
                </label>
                <input
                  type="color"
                  value={newColumnColor}
                  onChange={(e) => setNewColumnColor(e.target.value)}
                  className="h-10 w-full cursor-pointer rounded-lg border"
                  style={{ borderColor: "var(--border)" }}
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setAddColumnModalOpen(false)}
                className="rounded-lg px-4 py-2 text-sm font-medium"
                style={{ color: "var(--text-muted)" }}
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={handleAddColumn}
                disabled={!newColumnName.trim()}
                className="rounded-lg px-4 py-2 text-sm font-bold disabled:opacity-50"
                style={{ backgroundColor: "var(--accent)", color: "white" }}
              >
                {t("kanban.columnModal.create")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Filter button component
function FilterButton({
  active,
  onClick,
  count,
  label,
  icon,
  color = "var(--accent)",
}: {
  active: boolean;
  onClick: () => void;
  count: number;
  label: string;
  icon?: React.ReactNode;
  color?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all"
      style={{
        backgroundColor: active ? color : "transparent",
        color: active ? "white" : "var(--text-secondary)",
        border: `1px solid ${active ? color : "var(--border)"}`,
      }}
    >
      {icon}
      {label}
      <span
        className="ml-1 rounded-full px-1.5 py-0.5 text-xs"
        style={{
          backgroundColor: active ? "rgba(255,255,255,0.2)" : "var(--surface-elevated)",
          color: active ? "white" : "var(--text-muted)",
        }}
      >
        {count}
      </span>
    </button>
  );
}

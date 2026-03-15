"use client";

import { useEffect, useState } from "react";
import { Trash2, Clock, Heart, AlertCircle, CheckCircle, XCircle, Loader2, RefreshCw } from "lucide-react";
import { useI18n } from "@/i18n/provider";

interface ScheduledTask {
  id: string;
  name: string;
  type: "cron" | "heartbeat" | "scheduled";
  agentId?: string;
  schedule: string;
  scheduleDisplay: string;
  enabled: boolean;
  nextRun: string | null;
  lastRun: string | null;
  description?: string;
  status?: "success" | "error" | "running" | "pending";
  error?: string;
}

interface ScheduledTasksManagerProps {
  onTasksChange?: () => void;
}

export function ScheduledTasksManager({ onTasksChange }: ScheduledTasksManagerProps) {
  const { t } = useI18n();
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = async () => {
    try {
      const res = await fetch("/api/tasks");
      const data = await res.json();
      if (Array.isArray(data)) {
        setTasks(data);
      }
    } catch (err) {
      console.error("Failed to fetch tasks:", err);
      setError("Failed to load tasks");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const handleDelete = async (taskId: string) => {
    if (!confirm(t("tasks.deleteConfirm", { name: taskId }))) return;

    setDeleting(taskId);
    setError(null);

    try {
      const res = await fetch(`/api/tasks?jobId=${encodeURIComponent(taskId)}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete");
      }

      // Remove from local state
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      onTasksChange?.();
    } catch (err) {
      console.error("Failed to delete task:", err);
      setError(err instanceof Error ? err.message : "Failed to delete task");
    } finally {
      setDeleting(null);
    }
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case "success":
        return <CheckCircle className="w-4 h-4" style={{ color: "var(--success)" }} />;
      case "error":
        return <XCircle className="w-4 h-4" style={{ color: "var(--error)" }} />;
      case "running":
        return <Loader2 className="w-4 h-4 animate-spin" style={{ color: "var(--accent)" }} />;
      default:
        return <AlertCircle className="w-4 h-4" style={{ color: "var(--text-muted)" }} />;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "heartbeat":
        return <Heart className="w-4 h-4" style={{ color: "var(--error)" }} />;
      case "cron":
        return <Clock className="w-4 h-4" style={{ color: "var(--accent)" }} />;
      default:
        return <Clock className="w-4 h-4" style={{ color: "var(--text-muted)" }} />;
    }
  };

  if (loading) {
    return (
      <div
        style={{
          backgroundColor: "var(--card)",
          borderRadius: "0.75rem",
          padding: "2rem",
          textAlign: "center",
        }}
      >
        <Loader2 className="w-6 h-6 animate-spin mx-auto" style={{ color: "var(--accent)" }} />
        <p className="mt-2" style={{ color: "var(--text-muted)" }}>
          {t("tasks.loading")}
        </p>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div
        style={{
          backgroundColor: "var(--card)",
          borderRadius: "0.75rem",
          padding: "2rem",
          textAlign: "center",
        }}
      >
        <Clock className="w-8 h-8 mx-auto mb-2" style={{ color: "var(--text-muted)" }} />
        <p style={{ color: "var(--text-secondary)" }}>{t("tasks.empty")}</p>
      </div>
    );
  }

  return (
    <div
      style={{
        backgroundColor: "var(--card)",
        borderRadius: "0.75rem",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "1rem",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <h3
          style={{
            fontSize: "1rem",
            fontWeight: 600,
            color: "var(--text-primary)",
          }}
        >
          {t("tasks.title")}
        </h3>
        <button
          onClick={fetchTasks}
          className="p-2 rounded-lg transition-colors"
          style={{
            backgroundColor: "var(--card-elevated)",
            color: "var(--text-secondary)",
          }}
          title={t("common.refresh")}
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Error message */}
      {error && (
        <div
          style={{
            padding: "0.75rem 1rem",
            backgroundColor: "color-mix(in srgb, var(--error) 15%, transparent)",
            borderBottom: "1px solid var(--border)",
            color: "var(--error)",
            fontSize: "0.875rem",
          }}
        >
          {error}
        </div>
      )}

      {/* Tasks list */}
      <div style={{ maxHeight: "400px", overflowY: "auto" }}>
        {tasks.map((task) => (
          <div
            key={task.id}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0.75rem 1rem",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", minWidth: 0 }}>
              {getTypeIcon(task.type)}
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: "0.875rem",
                    fontWeight: 500,
                    color: "var(--text-primary)",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                  }}
                >
                  {task.name}
                  {getStatusIcon(task.status)}
                </div>
                <div
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--text-muted)",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                  }}
                >
                  <span>{task.scheduleDisplay || task.schedule}</span>
                  {task.agentId && <span>• {task.agentId}</span>}
                  <span>• {task.type}</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => handleDelete(task.id)}
              disabled={deleting === task.id}
              className="p-2 rounded-lg transition-colors"
              style={{
                backgroundColor: deleting === task.id ? "var(--card-elevated)" : "transparent",
                color: "var(--error)",
                opacity: deleting === task.id ? 0.5 : 1,
                cursor: deleting === task.id ? "not-allowed" : "pointer",
              }}
              title={t("tasks.delete")}
            >
              {deleting === task.id ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
            </button>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div
        style={{
          padding: "0.75rem 1rem",
          borderTop: "1px solid var(--border)",
          fontSize: "0.75rem",
          color: "var(--text-muted)",
          textAlign: "center",
        }}
      >
        {tasks.length} {t("tasks.count", { count: tasks.length })}
      </div>
    </div>
  );
}

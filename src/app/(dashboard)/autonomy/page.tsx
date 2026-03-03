"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Rocket,
  ToggleLeft,
  ToggleRight,
  Eye,
  History,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  Bot,
  Loader2,
  ExternalLink,
  Settings,
} from "lucide-react";

interface AutonomySettings {
  enabled: boolean;
  mode: "suggest" | "auto";
  agentName: string;
  maxTasksPerCycle: number;
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  labels: { name: string; color: string }[];
}

interface Execution {
  id: string;
  timestamp: string;
  taskId: string;
  taskTitle: string;
  agentName: string;
  mode: string;
  status: string;
  result: string | null;
  durationMs: number | null;
}

const STATUS_COLORS: Record<string, string> = {
  success: "var(--success)",
  error: "var(--error)",
  pending: "var(--info)",
  running: "var(--accent)",
  skipped: "var(--text-muted)",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "var(--text-muted)",
  medium: "var(--info)",
  high: "var(--accent)",
  critical: "var(--error)",
};

export default function AutonomyPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<AutonomySettings | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"preview" | "history">("preview");

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [settingsRes, tasksRes, executionsRes] = await Promise.all([
        fetch("/api/heartbeat/autonomy"),
        fetch("/api/heartbeat/tasks"),
        fetch("/api/heartbeat/executions?limit=20"),
      ]);

      if (!settingsRes.ok || !tasksRes.ok || !executionsRes.ok) {
        throw new Error("Failed to fetch autonomy data");
      }

      const settingsData = await settingsRes.json();
      const tasksData = await tasksRes.json();
      const executionsData = await executionsRes.json();

      setSettings(settingsData);
      setTasks(tasksData.tasks || []);
      setExecutions(executionsData.executions || []);
    } catch (err) {
      console.error("Failed to fetch autonomy data:", err);
      setError(err instanceof Error ? err.message : "Failed to load autonomy data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleToggleEnabled = async () => {
    if (!settings) return;

    try {
      setSaving(true);
      const res = await fetch("/api/heartbeat/autonomy", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...settings, enabled: !settings.enabled }),
      });

      if (!res.ok) throw new Error("Failed to update settings");

      const data = await res.json();
      setSettings(data);
    } catch (err) {
      console.error("Failed to toggle autonomy:", err);
      setError(err instanceof Error ? err.message : "Failed to update settings");
    } finally {
      setSaving(false);
    }
  };

  const handleModeChange = async (mode: "suggest" | "auto") => {
    if (!settings) return;

    try {
      setSaving(true);
      const res = await fetch("/api/heartbeat/autonomy", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...settings, mode }),
      });

      if (!res.ok) throw new Error("Failed to update mode");

      const data = await res.json();
      setSettings(data);
    } catch (err) {
      console.error("Failed to change mode:", err);
      setError(err instanceof Error ? err.message : "Failed to update mode");
    } finally {
      setSaving(false);
    }
  };

  const handleTaskClick = (taskId: string) => {
    router.push(`/kanban?task=${taskId}`);
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div
          className="flex items-center gap-3 rounded-xl p-4"
          style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
        >
          <RefreshCw className="h-5 w-5 animate-spin" style={{ color: "var(--accent)" }} />
          <span style={{ color: "var(--text-secondary)" }}>Loading autonomy data...</span>
        </div>
      </div>
    );
  }

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
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full p-4 md:p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1
              className="text-2xl font-bold"
              style={{ color: "var(--text-primary)" }}
            >
              Autonomy
            </h1>
            <p
              className="text-sm"
              style={{ color: "var(--text-muted)" }}
            >
              Autonomous task execution from Kanban
            </p>
          </div>
          <div className="flex items-center gap-2">
            {settings?.enabled ? (
              <ToggleRight
                className="h-5 w-5 cursor-pointer"
                style={{ color: "var(--success)" }}
                onClick={handleToggleEnabled}
              />
            ) : (
              <ToggleLeft
                className="h-5 w-5 cursor-pointer"
                style={{ color: "var(--text-muted)" }}
                onClick={handleToggleEnabled}
              />
            )}
            <span
              className="text-sm font-medium"
              style={{ color: settings?.enabled ? "var(--success)" : "var(--text-muted)" }}
            >
              {settings?.enabled ? "Enabled" : "Disabled"}
            </span>
          </div>
        </div>
      </div>

      {/* Settings Card */}
      <div
        className="mb-6 rounded-xl p-4"
        style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-2 mb-4">
          <Settings className="h-4 w-4" style={{ color: "var(--text-muted)" }} />
          <span className="font-medium" style={{ color: "var(--text-primary)" }}>
            Configuration
          </span>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {/* Mode */}
          <div>
            <label
              className="mb-2 block text-sm font-medium"
              style={{ color: "var(--text-secondary)" }}
            >
              Mode
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => handleModeChange("suggest")}
                className="flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
                style={{
                  backgroundColor: settings?.mode === "suggest" ? "var(--accent)" : "var(--surface-elevated)",
                  color: settings?.mode === "suggest" ? "white" : "var(--text-primary)",
                  border: "1px solid var(--border)",
                }}
              >
                Suggest
              </button>
              <button
                onClick={() => handleModeChange("auto")}
                className="flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
                style={{
                  backgroundColor: settings?.mode === "auto" ? "var(--error)" : "var(--surface-elevated)",
                  color: settings?.mode === "auto" ? "white" : "var(--text-primary)",
                  border: "1px solid var(--border)",
                }}
              >
                Auto-Execute
              </button>
            </div>
          </div>

          {/* Agent Name */}
          <div>
            <label
              className="mb-2 block text-sm font-medium"
              style={{ color: "var(--text-secondary)" }}
            >
              Agent Name
            </label>
            <div
              className="rounded-lg px-3 py-2 text-sm"
              style={{
                backgroundColor: "var(--surface-elevated)",
                color: "var(--text-primary)",
                border: "1px solid var(--border)",
              }}
            >
              {settings?.agentName || "OpenClaw"}
            </div>
          </div>

          {/* Max Tasks */}
          <div>
            <label
              className="mb-2 block text-sm font-medium"
              style={{ color: "var(--text-secondary)" }}
            >
              Max Tasks per Cycle
            </label>
            <div
              className="rounded-lg px-3 py-2 text-sm"
              style={{
                backgroundColor: "var(--surface-elevated)",
                color: "var(--text-primary)",
                border: "1px solid var(--border)",
              }}
            >
              {settings?.maxTasksPerCycle || 3}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setActiveTab("preview")}
          className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          style={{
            backgroundColor: activeTab === "preview" ? "var(--accent)" : "var(--card)",
            color: activeTab === "preview" ? "white" : "var(--text-secondary)",
            border: "1px solid var(--border)",
          }}
        >
          <Eye className="h-4 w-4" />
          Pending Tasks ({tasks.length})
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          style={{
            backgroundColor: activeTab === "history" ? "var(--accent)" : "var(--card)",
            color: activeTab === "history" ? "white" : "var(--text-secondary)",
            border: "1px solid var(--border)",
          }}
        >
          <History className="h-4 w-4" />
          Executions ({executions.length})
        </button>
      </div>

      {/* Content */}
      <div
        className="rounded-xl p-4"
        style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
      >
        {activeTab === "preview" && (
          <>
            {tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8">
                <Bot
                  className="h-12 w-12 mb-4"
                  style={{ color: "var(--text-muted)" }}
                />
                <p
                  className="mb-2 font-medium"
                  style={{ color: "var(--text-primary)" }}
                >
                  No pending tasks
                </p>
                <p
                  className="text-sm"
                  style={{ color: "var(--text-muted)" }}
                >
                  Tasks assigned to &quot;{settings?.agentName}&quot; will appear here
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    onClick={() => handleTaskClick(task.id)}
                    className="flex cursor-pointer items-center justify-between rounded-lg p-3 transition-colors hover:opacity-80"
                    style={{ backgroundColor: "var(--surface-elevated)" }}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="font-medium"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {task.title}
                        </span>
                        <span
                          className="rounded-full px-2 py-0.5 text-xs"
                          style={{
                            backgroundColor: `${PRIORITY_COLORS[task.priority]}20`,
                            color: PRIORITY_COLORS[task.priority],
                          }}
                        >
                          {task.priority}
                        </span>
                      </div>
                      {task.description && (
                        <p
                          className="mt-1 text-sm"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {task.description}
                        </p>
                      )}
                    </div>
                    <ExternalLink
                      className="h-4 w-4"
                      style={{ color: "var(--text-muted)" }}
                    />
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === "history" && (
          <>
            {executions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8">
                <History
                  className="h-12 w-12 mb-4"
                  style={{ color: "var(--text-muted)" }}
                />
                <p
                  className="mb-2 font-medium"
                  style={{ color: "var(--text-primary)" }}
                >
                  No executions yet
                </p>
                <p
                  className="text-sm"
                  style={{ color: "var(--text-muted)" }}
                >
                  Execution history will appear here
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {executions.map((execution) => (
                  <div
                    key={execution.id}
                    className="flex items-center justify-between rounded-lg p-3"
                    style={{ backgroundColor: "var(--surface-elevated)" }}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="font-medium"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {execution.taskTitle}
                        </span>
                        <span
                          className="rounded-full px-2 py-0.5 text-xs"
                          style={{
                            backgroundColor: `${STATUS_COLORS[execution.status]}20`,
                            color: STATUS_COLORS[execution.status],
                          }}
                        >
                          {execution.status}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-4 text-xs" style={{ color: "var(--text-muted)" }}>
                        <span>{new Date(execution.timestamp).toLocaleString()}</span>
                        {execution.durationMs && <span>{execution.durationMs}ms</span>}
                        <span>{execution.mode}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

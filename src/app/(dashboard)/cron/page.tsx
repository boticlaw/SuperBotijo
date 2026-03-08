"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Clock,
  RefreshCw,
  AlertCircle,
  LayoutGrid,
  CalendarDays,
  Zap,
  Plus,
  Server,
  Bot,
  Heart,
  Play,
  Calendar,
} from "lucide-react";
import { CronJobCard, type CronJob } from "@/components/CronJobCard";
import { CronWeeklyTimeline } from "@/components/CronWeeklyTimeline";
import { CronJobModal } from "@/components/CronJobModal";
import {
  SystemCronCard,
  SystemCronLogsModal,
} from "@/components/SystemCronCard";
import { HeartbeatStatus } from "@/components/HeartbeatStatus";
import type { SystemCronJob } from "@/app/api/cron/system/route";
import { useI18n } from "@/i18n/provider";

type ViewMode = "compact" | "timeline";
type CronTab = "all" | "system" | "openclaw" | "heartbeat";

interface HeartbeatData {
  enabled: boolean;
  every: string;
  target: string;
  activeHours: { start: string; end: string } | null;
  heartbeatMd: string;
  heartbeatMdPath: string;
  configured: boolean;
}

export default function CronJobsPage() {
  const { t } = useI18n();
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [systemJobs, setSystemJobs] = useState<SystemCronJob[]>([]);
  const [heartbeat, setHeartbeat] = useState<HeartbeatData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("compact");
  const [activeTab, setActiveTab] = useState<CronTab>("openclaw");
  const [runToast, setRunToast] = useState<{
    id: string;
    status: "success" | "error";
    name: string;
  } | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<CronJob | null>(null);
  const [saveToast, setSaveToast] = useState<{
    status: "success" | "error";
    message: string;
  } | null>(null);

  const [logsModal, setLogsModal] = useState<{
    isOpen: boolean;
    jobId: string;
    jobName: string;
    logPath?: string;
  }>({ isOpen: false, jobId: "", jobName: "" });

  const fetchAllData = useCallback(async () => {
    try {
      setError(null);
      const [openclawRes, systemRes, heartbeatRes] = await Promise.all([
        fetch("/api/cron"),
        fetch("/api/cron/system"),
        fetch("/api/heartbeat"),
      ]);

      if (openclawRes.ok) {
        const data = await openclawRes.json();
        console.log("[cron] OpenClaw jobs loaded:", Array.isArray(data) ? data.length : 0);
        setJobs(Array.isArray(data) ? data : []);
      } else {
        console.error("[cron] Failed to load OpenClaw jobs:", openclawRes.status, await openclawRes.text());
      }

      if (systemRes.ok) {
        const data = await systemRes.json();
        console.log("[cron] System jobs loaded:", data.jobs?.length || 0);
        setSystemJobs(data.jobs || []);
      } else {
        console.error("[cron] Failed to load system jobs:", systemRes.status);
      }

      if (heartbeatRes.ok) {
        const data = await heartbeatRes.json();
        setHeartbeat(data);
      } else {
        console.error("[cron] Failed to load heartbeat:", heartbeatRes.status);
      }
    } catch (err) {
      console.error("[cron] Error fetching data:", err);
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      const res = await fetch("/api/cron", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, enabled }),
      });
      if (!res.ok) throw new Error("Failed to update job");
      setJobs((prev) =>
        prev.map((job) => (job.id === id ? { ...job, enabled } : job))
      );
    } catch (err) {
      console.error("Toggle error:", err);
      setError("Failed to update job status");
    }
  };

  const handleDelete = async (id: string) => {
    if (deleteConfirm !== id) {
      setDeleteConfirm(id);
      return;
    }
    try {
      const res = await fetch(`/api/cron?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete job");
      setJobs((prev) => prev.filter((job) => job.id !== id));
      setDeleteConfirm(null);
    } catch (err) {
      console.error("Delete error:", err);
      setError("Failed to delete job");
    }
  };

  const handleRun = async (id: string) => {
    const job = jobs.find((j) => j.id === id);
    const res = await fetch("/api/cron/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      setRunToast({ id, status: "error", name: job?.name || id });
      setTimeout(() => setRunToast(null), 4000);
      throw new Error(data.error || "Trigger failed");
    }

    setRunToast({ id, status: "success", name: job?.name || id });
    setTimeout(() => setRunToast(null), 4000);
  };

  const handleSystemRun = async (id: string) => {
    const job = systemJobs.find((j) => j.id === id);
    const res = await fetch("/api/cron/system-run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      setRunToast({ id, status: "error", name: job?.name || id });
      setTimeout(() => setRunToast(null), 4000);
      throw new Error(data.error || "Run failed");
    }

    setRunToast({ id, status: "success", name: job?.name || id });
    setTimeout(() => setRunToast(null), 4000);
  };

  const handleViewLogs = (id: string, logPath?: string) => {
    const job = systemJobs.find((j) => j.id === id);
    setLogsModal({
      isOpen: true,
      jobId: id,
      jobName: job?.name || id,
      logPath,
    });
  };

  const handleEdit = (job: CronJob) => {
    setEditingJob(job);
    setIsModalOpen(true);
  };

  const handleCreateNew = () => {
    setEditingJob(null);
    setIsModalOpen(true);
  };

  const handleSave = async (jobData: Partial<CronJob>) => {
    try {
      const isEditing = !!editingJob?.id;
      const url = "/api/cron";
      const method = isEditing ? "PUT" : "POST";

      const body: Record<string, unknown> = {
        name: jobData.name,
        schedule:
          typeof jobData.schedule === "string" ? jobData.schedule : undefined,
        timezone: jobData.timezone || "UTC",
        message: jobData.description,
      };

      if (isEditing) {
        body.id = editingJob.id;
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to save job");
      }

      setSaveToast({
        status: "success",
        message: isEditing
          ? t("cron.jobUpdated")
          : t("cron.jobCreated"),
      });
      setTimeout(() => setSaveToast(null), 4000);

      setIsModalOpen(false);
      setEditingJob(null);
      fetchAllData();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to save job";
      setSaveToast({ status: "error", message });
      setTimeout(() => setSaveToast(null), 4000);
      throw err;
    }
  };

  const handleHeartbeatSave = async (content: string, agentId?: string) => {
    const res = await fetch("/api/heartbeat", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, agentId }),
    });

    if (!res.ok) {
      throw new Error("Failed to save HEARTBEAT.md");
    }

    fetchAllData();
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingJob(null);
  };

  const activeJobs = jobs.filter((j) => j.enabled).length;
  const pausedJobs = jobs.length - activeJobs;

  const renderTabContent = () => {
    if (activeTab === "heartbeat") {
      if (!heartbeat) return null;
      return <HeartbeatStatus data={heartbeat} onSave={handleHeartbeatSave} />;
    }

    if (viewMode === "timeline") {
      return (
        <div
          className="rounded-xl overflow-hidden"
          style={{
            backgroundColor: "var(--card)",
            border: "1px solid var(--border)",
            padding: "1.25rem",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              marginBottom: "1.25rem",
              paddingBottom: "1rem",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <CalendarDays
              className="w-5 h-5"
              style={{ color: "var(--accent)" }}
            />
            <h2
              style={{
                fontSize: "1rem",
                fontWeight: 700,
                color: "var(--text-primary)",
                fontFamily: "var(--font-heading)",
              }}
            >
              {t("cron.scheduleOverview")}
            </h2>
          </div>
          <CronWeeklyTimeline jobs={jobs} />
        </div>
      );
    }

    const showSystem = activeTab === "all" || activeTab === "system";
    const showOpenclaw = activeTab === "all" || activeTab === "openclaw";

    // Vista compacta (default): solo lo esencial
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2">
        {showSystem &&
          systemJobs.map((job) => (
            <CompactSystemCronCard
              key={job.id}
              job={job}
              onRun={handleSystemRun}
            />
          ))}

        {showOpenclaw &&
          jobs.map((job) => (
            <CompactCronJobCard
              key={job.id}
              job={job}
              onToggle={handleToggle}
              onEdit={handleEdit}
              onRun={handleRun}
            />
          ))}
      </div>
    );
  };

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 md:mb-6">
        <div>
          <h1
            className="text-2xl md:text-3xl font-bold mb-1"
            style={{
              color: "var(--text-primary)",
              fontFamily: "var(--font-heading)",
            }}
          >
            {t("cron.title")}
          </h1>
          <p className="text-sm md:text-base" style={{ color: "var(--text-secondary)" }}>
            {t("cron.subtitle")}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <button
            onClick={handleCreateNew}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.5rem 1rem",
              backgroundColor: "var(--accent)",
              color: "#000",
              borderRadius: "0.5rem",
              border: "none",
              cursor: "pointer",
              fontWeight: 600,
              transition: "opacity 0.2s",
            }}
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">{t("cron.createJob")}</span>
          </button>

          <button
            onClick={() => {
              setIsLoading(true);
              fetchAllData();
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.5rem 1rem",
              backgroundColor: "var(--card)",
              color: "var(--text-primary)",
              borderRadius: "0.5rem",
              border: "1px solid var(--border)",
              cursor: "pointer",
              fontWeight: 500,
              transition: "opacity 0.2s",
            }}
          >
            <RefreshCw className="w-4 h-4" />
            {t("common.refresh")}
          </button>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.5rem",
          marginBottom: "1rem",
        }}
      >
        <button
          onClick={() => setActiveTab("all")}
          style={{
            padding: "0.5rem 1rem",
            borderRadius: "0.5rem",
            backgroundColor:
              activeTab === "all" ? "var(--accent)" : "var(--card)",
            color: activeTab === "all" ? "#000" : "var(--text-secondary)",
            border: "1px solid var(--border)",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: "0.85rem",
          }}
        >
          {t("cron.all")} ({systemJobs.length + jobs.length})
        </button>
        <button
          onClick={() => setActiveTab("system")}
          style={{
            padding: "0.5rem 1rem",
            borderRadius: "0.5rem",
            backgroundColor:
              activeTab === "system" ? "var(--info)" : "var(--card)",
            color: activeTab === "system" ? "#000" : "var(--text-secondary)",
            border: "1px solid var(--border)",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: "0.85rem",
            display: "flex",
            alignItems: "center",
            gap: "0.25rem",
          }}
        >
          <Server className="w-4 h-4" />
          {t("cron.systemJobs")} ({systemJobs.length})
        </button>
        <button
          onClick={() => setActiveTab("openclaw")}
          style={{
            padding: "0.5rem 1rem",
            borderRadius: "0.5rem",
            backgroundColor:
              activeTab === "openclaw" ? "var(--accent)" : "var(--card)",
            color: activeTab === "openclaw" ? "#000" : "var(--text-secondary)",
            border: "1px solid var(--border)",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: "0.85rem",
            display: "flex",
            alignItems: "center",
            gap: "0.25rem",
          }}
        >
          <Bot className="w-4 h-4" />
          {t("cron.agentJobs")} ({activeJobs})
        </button>
        <button
          onClick={() => setActiveTab("heartbeat")}
          style={{
            padding: "0.5rem 1rem",
            borderRadius: "0.5rem",
            backgroundColor:
              activeTab === "heartbeat" ? "var(--error)" : "var(--card)",
            color: activeTab === "heartbeat" ? "#fff" : "var(--text-secondary)",
            border: "1px solid var(--border)",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: "0.85rem",
            display: "flex",
            alignItems: "center",
            gap: "0.25rem",
          }}
        >
          <Heart className="w-4 h-4" />
          {t("cron.heartbeat")} {heartbeat?.enabled ? "✓" : ""}
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-4 md:mb-6">
        <div
          onClick={() => setActiveTab("system")}
          style={{
            backgroundColor: "color-mix(in srgb, var(--info) 10%, var(--card))",
            border:
              activeTab === "system"
                ? "2px solid var(--info)"
                : "1px solid var(--border)",
            borderRadius: "0.75rem",
            padding: "1rem",
            cursor: "pointer",
          }}
        >
          <div
            style={{ display: "flex", alignItems: "center", gap: "1rem" }}
          >
            <div
              style={{
                padding: "0.75rem",
                backgroundColor:
                  "color-mix(in srgb, var(--info) 20%, transparent)",
                borderRadius: "0.5rem",
              }}
            >
              <Server className="w-6 h-6" style={{ color: "var(--info)" }} />
            </div>
            <div>
              <p
                style={{
                  fontSize: "1.5rem",
                  fontWeight: 700,
                  color: "var(--text-primary)",
                }}
              >
                {systemJobs.length}
              </p>
              <p
                style={{
                  fontSize: "0.875rem",
                  color: "var(--text-secondary)",
                }}
              >
                {t("cron.systemJobs")}
              </p>
            </div>
          </div>
        </div>

        <div
          onClick={() => setActiveTab("openclaw")}
          style={{
            backgroundColor:
              "color-mix(in srgb, var(--accent) 10%, var(--card))",
            border:
              activeTab === "openclaw"
                ? "2px solid var(--accent)"
                : "1px solid var(--border)",
            borderRadius: "0.75rem",
            padding: "1rem",
            cursor: "pointer",
          }}
        >
          <div
            style={{ display: "flex", alignItems: "center", gap: "1rem" }}
          >
            <div
              style={{
                padding: "0.75rem",
                backgroundColor:
                  "color-mix(in srgb, var(--accent) 20%, transparent)",
                borderRadius: "0.5rem",
              }}
            >
              <Bot className="w-6 h-6" style={{ color: "var(--accent)" }} />
            </div>
            <div>
              <p
                style={{
                  fontSize: "1.5rem",
                  fontWeight: 700,
                  color: "var(--text-primary)",
                }}
              >
                {activeJobs}
              </p>
              <p
                style={{
                  fontSize: "0.875rem",
                  color: "var(--text-secondary)",
                }}
              >
                {t("cron.agentJobs")}
              </p>
            </div>
          </div>
        </div>

        <div
          onClick={() => setActiveTab("heartbeat")}
          style={{
            backgroundColor: "var(--card)",
            border:
              activeTab === "heartbeat"
                ? "2px solid var(--error)"
                : "1px solid var(--border)",
            borderRadius: "0.75rem",
            padding: "1rem",
            cursor: "pointer",
          }}
        >
          <div
            style={{ display: "flex", alignItems: "center", gap: "1rem" }}
          >
            <div
              style={{
                padding: "0.75rem",
                backgroundColor: heartbeat?.enabled
                  ? "color-mix(in srgb, var(--success) 20%, transparent)"
                  : "var(--card-elevated)",
                borderRadius: "0.5rem",
              }}
            >
              <Heart
                className="w-6 h-6"
                style={{
                  color: heartbeat?.enabled
                    ? "var(--success)"
                    : "var(--text-muted)",
                }}
              />
            </div>
            <div>
              <p
                style={{
                  fontSize: "1.5rem",
                  fontWeight: 700,
                  color: "var(--text-primary)",
                }}
              >
                {heartbeat?.every || "—"}
              </p>
              <p
                style={{
                  fontSize: "0.875rem",
                  color: "var(--text-secondary)",
                }}
              >
                {t("cron.heartbeat")}
              </p>
            </div>
          </div>
        </div>

        <div
          style={{
            backgroundColor: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: "0.75rem",
            padding: "1rem",
          }}
        >
          <div
            style={{ display: "flex", alignItems: "center", gap: "1rem" }}
          >
            <div
              style={{
                padding: "0.75rem",
                backgroundColor: "var(--card-elevated)",
                borderRadius: "0.5rem",
              }}
            >
              <Play
                className="w-6 h-6"
                style={{ color: "var(--text-secondary)" }}
              />
            </div>
            <div>
              <p
                style={{
                  fontSize: "1.5rem",
                  fontWeight: 700,
                  color: "var(--text-primary)",
                }}
              >
                {pausedJobs}
              </p>
              <p
                style={{
                  fontSize: "0.875rem",
                  color: "var(--text-secondary)",
                }}
              >
                {t("cron.paused")}
              </p>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div
          style={{
            marginBottom: "1.5rem",
            padding: "1rem",
            backgroundColor:
              "color-mix(in srgb, var(--error) 10%, transparent)",
            border: "1px solid color-mix(in srgb, var(--error) 30%, transparent)",
            borderRadius: "0.5rem",
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
          }}
        >
          <AlertCircle
            className="w-5 h-5"
            style={{ color: "var(--error)" }}
          />
          <span style={{ color: "var(--error)" }}>{error}</span>
          <button
            onClick={() => setError(null)}
            style={{
              marginLeft: "auto",
              color: "var(--error)",
              background: "none",
              border: "none",
              cursor: "pointer",
            }}
          >
            Dismiss
          </button>
        </div>
      )}

      {activeTab !== "heartbeat" && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            marginBottom: "1rem",
          }}
        >
          <div
            style={{
              display: "flex",
              backgroundColor: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "0.5rem",
              padding: "3px",
            }}
          >
            <button
              onClick={() => setViewMode("compact")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.35rem",
                padding: "0.4rem 0.75rem",
                borderRadius: "0.35rem",
                fontSize: "0.8rem",
                fontWeight: 600,
                backgroundColor:
                  viewMode === "compact" ? "var(--accent)" : "transparent",
                color:
                  viewMode === "compact" ? "white" : "var(--text-secondary)",
                border: "none",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              {t("cron.compact")}
            </button>
            <button
              onClick={() => setViewMode("timeline")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.35rem",
                padding: "0.4rem 0.75rem",
                borderRadius: "0.35rem",
                fontSize: "0.8rem",
                fontWeight: 600,
                backgroundColor:
                  viewMode === "timeline" ? "var(--accent)" : "transparent",
                color:
                  viewMode === "timeline" ? "white" : "var(--text-secondary)",
                border: "none",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              {t("cron.timeline")}
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "3rem 0",
          }}
        >
          <div
            style={{
              width: "2rem",
              height: "2rem",
              border: "2px solid var(--accent)",
              borderTopColor: "transparent",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
            }}
          />
        </div>
      ) : activeTab !== "heartbeat" &&
        systemJobs.length === 0 &&
        jobs.length === 0 ? (
        <div style={{ textAlign: "center", padding: "4rem 0" }}>
          <Clock
            className="w-8 h-8 mx-auto mb-4"
            style={{ color: "var(--text-muted)" }}
          />
          <h3
            style={{
              fontSize: "1.125rem",
              fontWeight: 500,
              color: "var(--text-primary)",
              marginBottom: "0.5rem",
            }}
          >
            {t("cron.noJobs")}
          </h3>
          <p style={{ color: "var(--text-secondary)", marginBottom: "1rem" }}>
            {t("cron.noJobsHint")}
          </p>
          <button
            onClick={handleCreateNew}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.5rem 1rem",
              backgroundColor: "var(--accent)",
              color: "#000",
              borderRadius: "0.5rem",
              border: "none",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            <Plus className="w-4 h-4" />
            {t("cron.createJob")}
          </button>
        </div>
      ) : (
        renderTabContent()
      )}

      <CronJobModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSave={handleSave}
        editingJob={editingJob}
      />

      <SystemCronLogsModal
        isOpen={logsModal.isOpen}
        onClose={() => setLogsModal({ ...logsModal, isOpen: false })}
        jobId={logsModal.jobId}
        jobName={logsModal.jobName}
        logPath={logsModal.logPath}
      />

      {runToast && (
        <div
          style={{
            position: "fixed",
            bottom: "2.5rem",
            right: "1.5rem",
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            padding: "0.875rem 1.25rem",
            borderRadius: "0.75rem",
            backdropFilter: "blur(12px)",
            backgroundColor:
              runToast.status === "success"
                ? "color-mix(in srgb, var(--success) 15%, rgba(12,12,12,0.95))"
                : "color-mix(in srgb, var(--error) 15%, rgba(12,12,12,0.95))",
            border: `1px solid ${
              runToast.status === "success"
                ? "color-mix(in srgb, var(--success) 40%, transparent)"
                : "color-mix(in srgb, var(--error) 40%, transparent)"
            }`,
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            color: "var(--text-primary)",
            fontSize: "0.875rem",
            fontWeight: 500,
            animation: "slideInRight 0.3s ease",
          }}
        >
          <Zap
            className="w-4 h-4"
            style={{
              color:
                runToast.status === "success"
                  ? "var(--success)"
                  : "var(--error)",
            }}
          />
          {runToast.status === "success"
            ? `✓ "${runToast.name}" ${t("cron.triggered")}!`
            : `✗ ${t("cron.failedToTrigger")} "${runToast.name}"`}
        </div>
      )}

      {saveToast && (
        <div
          style={{
            position: "fixed",
            bottom: "2.5rem",
            right: "1.5rem",
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            padding: "0.875rem 1.25rem",
            borderRadius: "0.75rem",
            backdropFilter: "blur(12px)",
            backgroundColor:
              saveToast.status === "success"
                ? "color-mix(in srgb, var(--success) 15%, rgba(12,12,12,0.95))"
                : "color-mix(in srgb, var(--error) 15%, rgba(12,12,12,0.95))",
            border: `1px solid ${
              saveToast.status === "success"
                ? "color-mix(in srgb, var(--success) 40%, transparent)"
                : "color-mix(in srgb, var(--error) 40%, transparent)"
            }`,
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            color: "var(--text-primary)",
            fontSize: "0.875rem",
            fontWeight: 500,
            animation: "slideInRight 0.3s ease",
          }}
        >
          {saveToast.status === "success" ? "✓" : "✗"} {saveToast.message}
        </div>
      )}

      <style jsx global>{`
        @keyframes slideInRight {
          from {
            transform: translateX(2rem);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}

// ============================================
// Componentes de Tarjetas Compactas
// ============================================

const AGENT_EMOJI: Record<string, string> = {
  main: "🫙",
  academic: "🎓",
  infra: "🔧",
  studio: "🎬",
  social: "📱",
  linkedin: "💼",
  freelance: "🔧",
};

function CompactCronJobCard({
  job,
  onToggle,
  onEdit,
  onRun,
}: {
  job: CronJob;
  onToggle: (id: string, enabled: boolean) => void;
  onEdit: (job: CronJob) => void;
  onRun?: (id: string) => Promise<void>;
}) {
  const agentEmoji = AGENT_EMOJI[job.agentId] || "🤖";

  const formatNextRun = (dateStr: string | null) => {
    if (!dateStr) return "—";
    const date = new Date(dateStr);
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (diff < 0) return "now";
    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m`;
    return "soon";
  };

  return (
    <div
      onClick={() => onEdit(job)}
      style={{
        border: "1px solid var(--border)",
        borderRadius: "0.5rem",
        backgroundColor: job.enabled ? "var(--card)" : "color-mix(in srgb, var(--card) 50%, var(--card-elevated))",
        opacity: job.enabled ? 1 : 0.6,
        cursor: "pointer",
        transition: "all 0.15s",
        padding: "0.5rem 0.625rem",
      }}
      className="hover:border-accent"
    >
      {/* Header: emoji + nombre + estado */}
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-sm">{agentEmoji}</span>
        <span
          className="text-xs font-medium truncate flex-1"
          style={{ color: "var(--text-primary)" }}
        >
          {job.name}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle(job.id, !job.enabled);
          }}
          style={{
            padding: "0.125rem 0.375rem",
            fontSize: "0.6rem",
            fontWeight: 600,
            borderRadius: "0.25rem",
            border: "none",
            cursor: "pointer",
            backgroundColor: job.enabled
              ? "color-mix(in srgb, var(--success) 20%, transparent)"
              : "rgba(42, 42, 42, 0.5)",
            color: job.enabled ? "var(--success)" : "var(--text-muted)",
          }}
        >
          {job.enabled ? "ON" : "OFF"}
        </button>
      </div>

      {/* Schedule */}
      <div className="flex items-center gap-1 mb-1">
        <Clock className="w-3 h-3" style={{ color: "var(--info)" }} />
        <code
          className="text-[0.6rem] px-1 py-0.25 rounded"
          style={{
            backgroundColor: "rgba(42, 42, 42, 0.5)",
            color: "var(--text-secondary)",
            fontFamily: "monospace",
          }}
        >
          {job.scheduleDisplay}
        </code>
      </div>

      {/* Next run */}
      {job.enabled && job.nextRun && (
        <div className="flex items-center gap-1">
          <Calendar className="w-3 h-3" style={{ color: "var(--type-cron)" }} />
          <span className="text-[0.65rem]" style={{ color: "var(--text-muted)" }}>
            {formatNextRun(job.nextRun)}
          </span>
        </div>
      )}

      {/* Run button */}
      {onRun && job.enabled && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRun(job.id);
          }}
          className="mt-1.5 w-full flex items-center justify-center gap-1 py-1 px-2 rounded text-[0.65rem] font-medium"
          style={{
            backgroundColor: "color-mix(in srgb, var(--accent) 15%, transparent)",
            color: "var(--accent)",
            border: "1px solid color-mix(in srgb, var(--accent) 30%, transparent)",
            cursor: "pointer",
          }}
        >
          <Play className="w-3 h-3" />
          Run
        </button>
      )}
    </div>
  );
}

function CompactSystemCronCard({
  job,
  onRun,
}: {
  job: SystemCronJob;
  onRun: (id: string) => Promise<void>;
}) {
  return (
    <div
      style={{
        border: "1px solid color-mix(in srgb, var(--info) 30%, var(--border))",
        borderRadius: "0.5rem",
        backgroundColor: "color-mix(in srgb, var(--info) 5%, var(--card))",
        cursor: "pointer",
        transition: "all 0.15s",
        padding: "0.5rem 0.625rem",
      }}
      className="hover:border-info"
    >
      {/* Header */}
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-sm">🖥️</span>
        <span
          className="text-xs font-medium truncate flex-1"
          style={{ color: "var(--text-primary)" }}
        >
          {job.name}
        </span>
        <span
          className="text-[0.55rem] px-1 py-0.25 rounded"
          style={{
            backgroundColor: "color-mix(in srgb, var(--info) 20%, transparent)",
            color: "var(--info)",
            fontWeight: 600,
          }}
        >
          SYS
        </span>
      </div>

      {/* Schedule */}
      <div className="flex items-center gap-1 mb-1">
        <Clock className="w-3 h-3" style={{ color: "var(--info)" }} />
        <code
          className="text-[0.6rem] px-1 py-0.25 rounded"
          style={{
            backgroundColor: "var(--card-elevated)",
            color: "var(--text-secondary)",
            fontFamily: "monospace",
          }}
        >
          {job.scheduleDisplay}
        </code>
      </div>

      {/* Command preview */}
      <div className="flex items-center gap-1 mb-1">
        <span
          className="text-[0.6rem] truncate"
          style={{ color: "var(--text-muted)" }}
        >
          {job.command.split(" ")[0]}
        </span>
      </div>

      {/* Run button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRun(job.id);
        }}
        className="mt-1.5 w-full flex items-center justify-center gap-1 py-1 px-2 rounded text-[0.65rem] font-medium"
        style={{
          backgroundColor: "var(--info)",
          color: "#000",
          border: "none",
          cursor: "pointer",
        }}
      >
        <Play className="w-3 h-3" />
        Run
      </button>
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Clock,
  RefreshCw,
  AlertCircle,
  LayoutGrid,
  CalendarDays,
  Plus,
  Server,
  Bot,
  Heart,
  Play,
  Calendar,
  Trash2,
} from "lucide-react";
import { type CronJob } from "@/components/CronJobCard";
import { CronWeeklyTimeline } from "@/components/CronWeeklyTimeline";
import { CronJobModal } from "@/components/CronJobModal";
import {
  SystemCronLogsModal,
} from "@/components/SystemCronCard";
import { HeartbeatStatus } from "@/components/HeartbeatStatus";
import type { SystemCronJob } from "@/app/api/cron/system/route";
import { useI18n } from "@/i18n/provider";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import type { OpenClawCronJob } from "@/operations/openclaw-cron-ops";
import type { HeartbeatStatus as HeartbeatStatusType } from "@/operations/heartbeat-ops";

type ViewMode = "list" | "timeline";
type CronTab = "all" | "system" | "openclaw" | "heartbeat";

interface CronPageData {
  openclawJobs: OpenClawCronJob[];
  systemJobs: SystemCronJob[];
  heartbeat: HeartbeatStatusType | null;
}

export default function CronClient({ initialData }: { initialData: CronPageData }) {
  const { t } = useI18n();
  const { showSuccess, showError } = useToast();
  const [jobs, setJobs] = useState<CronJob[]>(initialData.openclawJobs as CronJob[]);
  const [systemJobs, setSystemJobs] = useState<SystemCronJob[]>(initialData.systemJobs);
  const [heartbeat, setHeartbeat] = useState<HeartbeatStatusType | null>(initialData.heartbeat);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobToDelete, setJobToDelete] = useState<CronJob | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [activeTab, setActiveTab] = useState<CronTab>("openclaw");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<CronJob | null>(null);

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
    // Initial data already provided, only refresh on demand
  }, []);

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

  const handleDeleteClick = (job: CronJob) => {
    setJobToDelete(job);
  };

  const handleDeleteConfirm = async () => {
    if (!jobToDelete) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/cron?id=${jobToDelete.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete job");
      setJobs((prev) => prev.filter((job) => job.id !== jobToDelete.id));
      setJobToDelete(null);
      showSuccess(t("cron.jobDeleted"));
    } catch (err) {
      console.error("Delete error:", err);
      showError(t("cron.deleteError"));
    } finally {
      setIsDeleting(false);
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
      showError(t("cron.failedToTrigger") + ` "${job?.name || id}"`);
      throw new Error(data.error || "Trigger failed");
    }

    showSuccess(`"${job?.name || id}" ${t("cron.triggered")}!`);
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
      showError(t("cron.failedToTrigger") + ` "${job?.name || id}"`);
      throw new Error(data.error || "Run failed");
    }

    showSuccess(`"${job?.name || id}" ${t("cron.triggered")}!`);
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
        description: jobData.description,
        message: jobData.message,
        schedule:
          typeof jobData.schedule === "string" ? jobData.schedule : undefined,
        timezone: jobData.timezone || "UTC",
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

      showSuccess(isEditing ? t("cron.jobUpdated") : t("cron.jobCreated"));

      setIsModalOpen(false);
      setEditingJob(null);
      fetchAllData();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to save job";
      showError(message);
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

    return (
      <div className="flex flex-col gap-2">
        {showSystem &&
          systemJobs.map((job) => (
            <ListSystemCronRow
              key={job.id}
              job={job}
              onRun={handleSystemRun}
            />
          ))}

        {showOpenclaw &&
          jobs.map((job) => (
            <ListCronJobRow
              key={job.id}
              job={job}
              onToggle={handleToggle}
              onEdit={handleEdit}
              onRun={handleRun}
              onDelete={() => handleDeleteClick(job)}
              isDeleting={isDeleting && jobToDelete?.id === job.id}
            />
          ))}
        
        {(!showSystem || systemJobs.length === 0) && (!showOpenclaw || jobs.length === 0) && (
          <div className="text-center p-8 border border-dashed border-[var(--border)] rounded-xl text-[var(--text-muted)]">
            No hay tareas configuradas en esta vista.
          </div>
        )}
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
              onClick={() => setViewMode("list")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.35rem",
                padding: "0.4rem 0.75rem",
                borderRadius: "0.35rem",
                fontSize: "0.8rem",
                fontWeight: 600,
                backgroundColor:
                  viewMode === "list" ? "var(--accent)" : "transparent",
                color:
                  viewMode === "list" ? "white" : "var(--text-secondary)",
                border: "none",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Lista
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

      <ConfirmDialog
        isOpen={jobToDelete !== null}
        title={t("cron.deleteJob")}
        message={t("cron.confirmDelete", { name: jobToDelete?.name || "" })}
        confirmLabel={t("cron.delete")}
        cancelLabel={t("common.cancel")}
        variant="danger"
        isLoading={isDeleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setJobToDelete(null)}
      />

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

const AGENT_EMOJI: Record<string, string> = {
  main: "🫙",
  academic: "🎓",
  infra: "🔧",
  studio: "🎬",
  social: "📱",
  linkedin: "💼",
  freelance: "🔧",
};

function ListCronJobRow({
  job,
  onToggle,
  onEdit,
  onRun,
  onDelete,
  isDeleting,
}: {
  job: CronJob;
  onToggle: (id: string, enabled: boolean) => void;
  onEdit: (job: CronJob) => void;
  onRun?: (id: string) => Promise<void>;
  onDelete?: (id: string) => void;
  isDeleting?: boolean;
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
    if (days > 0) return `in ${days}d ${hours % 24}h`;
    if (hours > 0) return `in ${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `in ${minutes}m`;
    return "soon";
  };

  return (
    <div
      onClick={() => onEdit(job)}
      className="flex items-center gap-4 py-3 px-4 hover:bg-[color-mix(in_srgb,var(--card-elevated)_50%,transparent)] border-b border-[var(--border)] last:border-0 cursor-pointer transition-colors group"
      style={{
        opacity: job.enabled ? 1 : 0.5,
        backgroundColor: "var(--card)",
      }}
    >
      <div className="flex items-center gap-3 w-48 shrink-0">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle(job.id, !job.enabled);
          }}
          className="w-10 text-[0.65rem] font-bold py-1 rounded transition-colors"
          style={{
            backgroundColor: job.enabled
              ? "color-mix(in srgb, var(--success) 20%, transparent)"
              : "color-mix(in srgb, var(--text-muted) 20%, transparent)",
            color: job.enabled ? "var(--success)" : "var(--text-muted)",
          }}
        >
          {job.enabled ? "ON" : "OFF"}
        </button>
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base shrink-0">{agentEmoji}</span>
          <span className="text-sm font-medium text-[var(--text-primary)] truncate">
            {job.name}
          </span>
        </div>
      </div>

      <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6">
        <div className="flex items-center gap-2 shrink-0">
          <Clock className="w-3.5 h-3.5 text-[var(--info)]" />
          <code className="text-xs bg-[var(--card-elevated)] text-[var(--text-secondary)] px-1.5 py-0.5 rounded font-mono">
            {job.scheduleDisplay}
          </code>
        </div>
        
        {job.message && (
          <span className="text-xs text-[var(--text-muted)] truncate flex-1">
            {job.message}
          </span>
        )}
      </div>

      <div className="hidden md:flex items-center gap-1.5 w-32 shrink-0 text-xs text-[var(--text-secondary)]">
        {job.enabled && job.nextRun ? (
          <>
            <Calendar className="w-3.5 h-3.5 text-[var(--type-cron)]" />
            {formatNextRun(job.nextRun)}
          </>
        ) : (
          <span className="text-[var(--text-muted)]">—</span>
        )}
      </div>

      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        {onRun && job.enabled && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRun(job.id);
            }}
            className="p-1.5 rounded bg-[color-mix(in_srgb,var(--accent)_15%,transparent)] text-[var(--accent)] hover:bg-[color-mix(in_srgb,var(--accent)_25%,transparent)] transition-colors"
            title="Run now"
          >
            <Play className="w-4 h-4" />
          </button>
        )}

        {onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(job.id);
            }}
            className="p-1.5 rounded transition-colors flex items-center justify-center min-w-[28px]"
            style={{
              backgroundColor: isDeleting 
                ? "var(--error)" 
                : "color-mix(in srgb, var(--error) 15%, transparent)",
              color: isDeleting ? "white" : "var(--error)",
            }}
            title="Delete job"
          >
            {isDeleting ? <span className="text-[0.65rem] font-bold px-1">?</span> : <Trash2 className="w-4 h-4" />}
          </button>
        )}
      </div>
    </div>
  );
}

function ListSystemCronRow({
  job,
  onRun,
}: {
  job: SystemCronJob;
  onRun: (id: string) => Promise<void>;
}) {
  return (
    <div
      className="flex items-center gap-4 py-3 px-4 hover:bg-[color-mix(in_srgb,var(--card-elevated)_50%,transparent)] border-b border-[var(--border)] last:border-0 transition-colors group"
      style={{ backgroundColor: "var(--card)" }}
    >
      <div className="flex items-center gap-3 w-48 shrink-0">
        <span className="w-10 text-[0.65rem] font-bold py-1 rounded text-center bg-[color-mix(in_srgb,var(--info)_20%,transparent)] text-[var(--info)]">
          SYS
        </span>
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base shrink-0">🖥️</span>
          <span className="text-sm font-medium text-[var(--text-primary)] truncate">
            {job.name}
          </span>
        </div>
      </div>

      <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6">
        <div className="flex items-center gap-2 shrink-0">
          <Clock className="w-3.5 h-3.5 text-[var(--info)]" />
          <code className="text-xs bg-[var(--card-elevated)] text-[var(--text-secondary)] px-1.5 py-0.5 rounded font-mono">
            {job.scheduleDisplay}
          </code>
        </div>
        
        {job.description && (
          <span className="text-xs text-[var(--text-muted)] truncate flex-1">
            {job.description}
          </span>
        )}
      </div>

      <div className="hidden md:flex items-center gap-1.5 w-32 shrink-0 text-xs text-[var(--text-secondary)]">
        <span className="text-[var(--text-muted)]">system task</span>
      </div>

      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        {onRun && (
          <button
            onClick={() => onRun(job.id)}
            className="p-1.5 rounded bg-[color-mix(in_srgb,var(--accent)_15%,transparent)] text-[var(--accent)] hover:bg-[color-mix(in_srgb,var(--accent)_25%,transparent)] transition-colors"
            title="Run now"
          >
            <Play className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

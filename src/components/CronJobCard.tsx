"use client";

import { useState, useCallback } from "react";
import {
  Clock,
  Calendar,
  Play,
  Pause,
  Trash2,
  ChevronDown,
  ChevronUp,
  Bot,
  Zap,
  CheckCircle2,
  XCircle,
  History,
  Loader2,
  Edit3,
  Filter,
  X,
} from "lucide-react";

export interface CronJob {
  id: string;
  agentId: string;
  name: string;
  description: string;
  message: string;
  schedule: string | Record<string, unknown>;
  scheduleDisplay: string;
  timezone: string;
  enabled: boolean;
  nextRun: string | null;
  lastRun: string | null;
  sessionTarget: string;
  payload: Record<string, unknown>;
}

interface RunHistoryEntry {
  id: string;
  jobId: string;
  startedAt: string | null;
  completedAt: string | null;
  status: string;
  durationMs: number | null;
  error: string | null;
}

interface CronJobCardProps {
  job: CronJob;
  onToggle: (id: string, enabled: boolean) => void;
  onEdit: (job: CronJob) => void;
  onDelete: (id: string) => void;
  onRun?: (id: string) => Promise<void>;
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

export function CronJobCard({ job, onToggle, onEdit, onDelete, onRun }: CronJobCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [runResult, setRunResult] = useState<"success" | "error" | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [runHistory, setRunHistory] = useState<RunHistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  const handleToggle = async () => {
    setIsToggling(true);
    await onToggle(job.id, !job.enabled);
    setIsToggling(false);
  };

  const handleRun = useCallback(async () => {
    if (!onRun || isRunning) return;
    setIsRunning(true);
    setRunResult(null);
    try {
      await onRun(job.id);
      setRunResult("success");
    } catch {
      setRunResult("error");
    } finally {
      setIsRunning(false);
      // Clear result indicator after 3s
      setTimeout(() => setRunResult(null), 3000);
    }
  }, [job.id, onRun, isRunning]);

  const loadHistory = useCallback(async (filters?: { status?: string; from?: string; to?: string }) => {
    if (loadingHistory) return;
    setLoadingHistory(true);
    try {
      const params = new URLSearchParams({ id: job.id, limit: "20" });
      const status = filters?.status || statusFilter;
      const from = filters?.from || fromDate;
      const to = filters?.to || toDate;
      
      if (status) params.set("status", status);
      if (from) params.set("from", from);
      if (to) params.set("to", to);

      const res = await fetch(`/api/cron/runs?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setRunHistory(data.runs || []);
        setHistoryTotal(data.total || 0);
      }
    } catch {
      setRunHistory([]);
      setHistoryTotal(0);
    } finally {
      setLoadingHistory(false);
    }
  }, [job.id, loadingHistory, statusFilter, fromDate, toDate]);

  const handleToggleHistory = () => {
    const next = !showHistory;
    setShowHistory(next);
    if (next) {
      setStatusFilter("");
      setFromDate("");
      setToDate("");
      loadHistory({ status: "", from: "", to: "" });
    }
  };

  const handleApplyFilters = () => {
    loadHistory({ status: statusFilter, from: fromDate, to: toDate });
  };

  const handleClearFilters = () => {
    setStatusFilter("");
    setFromDate("");
    setToDate("");
    loadHistory({ status: "", from: "", to: "" });
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    const date = new Date(dateStr);
    return date.toLocaleString("es-ES", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: false,
    });
  };

  const getRelativeTime = (dateStr: string | null) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (diff < 0) return "overdue";
    if (days > 0) return `in ${days}d ${hours % 24}h`;
    if (hours > 0) return `in ${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `in ${minutes}m`;
    return "now";
  };

  const agentEmoji = AGENT_EMOJI[job.agentId] || "🤖";

  const formatHistoryDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleString("es-ES", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  const formatDuration = (ms: number | null) => {
    if (ms === null) return "—";
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  return (
    <div
      className="rounded-xl"
      style={{
        border: '1px solid',
        borderColor: job.enabled ? 'var(--border)' : 'rgba(42, 42, 42, 0.5)',
        backgroundColor: job.enabled ? 'color-mix(in srgb, var(--card) 50%, transparent)' : 'color-mix(in srgb, var(--card) 30%, transparent)',
        opacity: job.enabled ? 1 : 0.6,
        transition: 'all 0.2s'
      }}
    >
      <div className="p-3 md:p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-2 md:mb-3 gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 md:gap-2 flex-wrap">
              <span title={job.agentId}>{agentEmoji}</span>
              <h3 className="text-sm md:text-lg font-semibold truncate" style={{ 
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-heading)'
              }}>
                {job.name}
              </h3>
              <span
                className="text-[10px] md:text-xs px-1.5 md:px-2 py-0.5 rounded-full whitespace-nowrap"
                style={{
                  backgroundColor: job.enabled 
                    ? 'color-mix(in srgb, var(--success) 20%, transparent)' 
                    : 'rgba(42, 42, 42, 0.5)',
                  color: job.enabled ? 'var(--success)' : 'var(--text-secondary)'
                }}
              >
                {job.enabled ? "Active" : "Paused"}
              </span>
            </div>
            <p className="text-xs md:text-sm mt-0.5 md:mt-1 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
              {job.description}
            </p>
          </div>

          {/* Toggle Button */}
          <button
            onClick={handleToggle}
            disabled={isToggling}
            title={job.enabled ? "Pause job" : "Enable job"}
            className="p-1.5 md:p-2 rounded-lg flex-shrink-0"
            style={{
              border: 'none',
              cursor: isToggling ? 'not-allowed' : 'pointer',
              opacity: isToggling ? 0.5 : 1,
              backgroundColor: job.enabled 
                ? 'color-mix(in srgb, var(--success) 20%, transparent)' 
                : 'rgba(42, 42, 42, 0.5)',
              color: job.enabled ? 'var(--success)' : 'var(--text-secondary)',
              transition: 'all 0.2s'
            }}
          >
            {isToggling ? (
              <div className="w-4 h-4 md:w-5 md:h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : job.enabled ? (
              <Pause className="w-4 h-4 md:w-5 md:h-5" />
            ) : (
              <Play className="w-4 h-4 md:w-5 md:h-5" />
            )}
          </button>
        </div>

        {/* Schedule Info */}
        <div className="flex flex-wrap gap-2 md:gap-4 mb-2 md:mb-4">
          <div className="flex items-center gap-1.5 md:gap-2 text-xs md:text-sm">
            <Clock className="w-3.5 h-3.5 md:w-4 md:h-4" style={{ color: 'var(--info)' }} />
            <code className="text-[10px] md:text-xs px-1.5 md:px-2 py-0.5 rounded" style={{
              backgroundColor: 'rgba(42, 42, 42, 0.5)',
              color: 'var(--text-secondary)',
              fontFamily: 'monospace'
            }}>
              {job.scheduleDisplay}
            </code>
          </div>
          <div className="flex items-center gap-1.5 md:gap-2 text-xs md:text-sm">
            <Bot className="w-3.5 h-3.5 md:w-4 md:h-4" style={{ color: 'var(--text-muted)' }} />
            <span style={{ color: 'var(--text-muted)' }}>{job.sessionTarget}</span>
          </div>
        </div>

        {/* Next Run */}
        {job.enabled && job.nextRun && (
          <div className="flex flex-wrap items-center gap-1 md:gap-2 text-xs md:text-sm mb-2 md:mb-4">
            <Calendar className="w-3.5 h-3.5 md:w-4 md:h-4" style={{ color: 'var(--type-cron)' }} />
            <span style={{ color: 'var(--text-secondary)' }}>Next:</span>
            <span style={{ color: 'var(--text-primary)' }}>{formatDate(job.nextRun)}</span>
            <span style={{ color: 'var(--type-cron)' }}>({getRelativeTime(job.nextRun)})</span>
          </div>
        )}

        {/* Expand/Collapse for Details */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-xs md:text-sm"
          style={{
            color: 'var(--text-muted)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            transition: 'color 0.2s'
          }}
        >
          {expanded ? (
            <>
              <ChevronUp className="w-3.5 h-3.5 md:w-4 md:h-4" />
              <span>Hide details</span>
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5 md:w-4 md:h-4" />
              <span>Show details</span>
            </>
          )}
        </button>

        {/* Expanded: Details */}
        {expanded && (
          <div className="mt-2 md:mt-3 pl-3 md:pl-4 flex flex-col gap-1 md:gap-2 text-xs md:text-sm" style={{ borderLeft: '2px solid var(--border)' }}>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>ID: </span>
              <code style={{ color: 'var(--text-secondary)', fontSize: '0.7rem' }}>{job.id}</code>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Agent: </span>
              <span style={{ color: 'var(--text-secondary)' }}>{agentEmoji} {job.agentId}</span>
            </div>
            {job.lastRun && (
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Last run: </span>
                <span style={{ color: 'var(--text-secondary)' }}>{formatDate(job.lastRun)}</span>
              </div>
            )}
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Timezone: </span>
              <span style={{ color: 'var(--text-secondary)' }}>{job.timezone}</span>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1 md:gap-2 mt-3 md:mt-4 pt-2 md:pt-4" style={{ borderTop: '1px solid var(--border)' }}>
          <button
            onClick={() => onDelete(job.id)}
            className="flex items-center gap-1 md:gap-2 px-2 md:px-3 py-1.5 md:py-2 text-xs md:text-sm rounded-lg"
            style={{
              color: 'var(--text-secondary)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <Trash2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
            <span className="hidden sm:inline">Delete</span>
          </button>

          {/* Edit button */}
          <button
            onClick={() => onEdit(job)}
            className="flex items-center gap-1 md:gap-2 px-2 md:px-3 py-1.5 md:py-2 text-xs md:text-sm rounded-lg"
            style={{
              color: 'var(--text-secondary)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            title="Edit job"
          >
            <Edit3 className="w-3.5 h-3.5 md:w-4 md:h-4" />
            <span className="hidden sm:inline">Edit</span>
          </button>

          {/* History button */}
          <button
            onClick={handleToggleHistory}
            className="flex items-center gap-1 md:gap-2 px-2 md:px-3 py-1.5 md:py-2 text-xs md:text-sm rounded-lg"
            style={{
              color: showHistory ? 'var(--info)' : 'var(--text-muted)',
              background: showHistory ? 'color-mix(in srgb, var(--info) 10%, transparent)' : 'none',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            title="Run history"
          >
            <History className="w-3.5 h-3.5 md:w-4 md:h-4" />
            <span className="hidden sm:inline">History</span>
          </button>

          <div className="flex-1" />

          {/* Run Now button */}
          {onRun && (
            <button
              onClick={handleRun}
              disabled={isRunning}
              title="Trigger this job now"
              className="flex items-center gap-1 md:gap-2 px-2 md:px-3 py-1.5 md:py-2 text-xs md:text-sm rounded-lg"
              style={{
                backgroundColor: runResult === "success"
                  ? 'color-mix(in srgb, var(--success) 15%, transparent)'
                  : runResult === "error"
                  ? 'color-mix(in srgb, var(--error) 15%, transparent)'
                  : 'color-mix(in srgb, var(--accent) 15%, transparent)',
                color: runResult === "success"
                  ? 'var(--success)'
                  : runResult === "error"
                  ? 'var(--error)'
                  : 'var(--accent)',
                border: `1px solid ${runResult === "success" ? 'color-mix(in srgb, var(--success) 30%, transparent)' : runResult === "error" ? 'color-mix(in srgb, var(--error) 30%, transparent)' : 'color-mix(in srgb, var(--accent) 30%, transparent)'}`,
                cursor: isRunning ? 'not-allowed' : 'pointer',
                opacity: isRunning ? 0.7 : 1,
                transition: 'all 0.2s',
                fontWeight: 600,
              }}
            >
              {isRunning ? (
                <Loader2 className="w-3.5 h-3.5 md:w-4 md:h-4 animate-spin" />
              ) : runResult === "success" ? (
                <CheckCircle2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
              ) : runResult === "error" ? (
                <XCircle className="w-3.5 h-3.5 md:w-4 md:h-4" />
              ) : (
                <Zap className="w-3.5 h-3.5 md:w-4 md:h-4" />
              )}
              <span className="hidden sm:inline">
                {isRunning ? "Running…" : runResult === "success" ? "Triggered!" : runResult === "error" ? "Failed" : "Run Now"}
              </span>
            </button>
          )}
        </div>

        {/* Run History Panel */}
        {showHistory && (
          <div
            style={{
              marginTop: '0.75rem',
              backgroundColor: 'var(--card-elevated)',
              borderRadius: '0.5rem',
              border: '1px solid var(--border)',
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                padding: '0.5rem 0.75rem',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--text-secondary)'
              }}
            >
              <History className="w-3.5 h-3.5" />
              Recent Runs
              {historyTotal > 0 && (
                <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({historyTotal} total)</span>
              )}
              {loadingHistory && <Loader2 className="w-3 h-3 animate-spin ml-auto" />}
            </div>

            {/* Filters */}
            <div
              style={{
                padding: '0.5rem 0.75rem',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.5rem',
                alignItems: 'center',
                backgroundColor: 'rgba(0,0,0,0.1)'
              }}
            >
              <Filter className="w-3 h-3" style={{ color: 'var(--text-muted)' }} />
              
              {/* Status filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{
                  padding: '0.25rem 0.5rem',
                  fontSize: '0.7rem',
                  backgroundColor: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: '0.25rem',
                  color: 'var(--text-primary)',
                  cursor: 'pointer'
                }}
              >
                <option value="">All status</option>
                <option value="success">Success</option>
                <option value="error">Error</option>
                <option value="pending">Pending</option>
                <option value="running">Running</option>
              </select>

              {/* From date */}
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                placeholder="From"
                style={{
                  padding: '0.25rem 0.5rem',
                  fontSize: '0.7rem',
                  backgroundColor: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: '0.25rem',
                  color: 'var(--text-primary)',
                  width: 'auto'
                }}
              />

              {/* To date */}
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                placeholder="To"
                style={{
                  padding: '0.25rem 0.5rem',
                  fontSize: '0.7rem',
                  backgroundColor: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: '0.25rem',
                  color: 'var(--text-primary)',
                  width: 'auto'
                }}
              />

              {/* Apply button */}
              <button
                onClick={handleApplyFilters}
                style={{
                  padding: '0.25rem 0.5rem',
                  fontSize: '0.7rem',
                  backgroundColor: 'var(--accent)',
                  color: '#000',
                  border: 'none',
                  borderRadius: '0.25rem',
                  cursor: 'pointer',
                  fontWeight: 500
                }}
              >
                Apply
              </button>

              {/* Clear button */}
              {(statusFilter || fromDate || toDate) && (
                <button
                  onClick={handleClearFilters}
                  style={{
                    padding: '0.25rem 0.5rem',
                    fontSize: '0.7rem',
                    backgroundColor: 'transparent',
                    color: 'var(--text-muted)',
                    border: 'none',
                    borderRadius: '0.25rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem'
                  }}
                >
                  <X className="w-3 h-3" />
                  Clear
                </button>
              )}
            </div>

            {!loadingHistory && runHistory.length === 0 && (
              <div style={{ padding: '0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                {statusFilter || fromDate || toDate ? "No runs match filters" : "No run history available"}
              </div>
            )}

            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {runHistory.map((run, idx) => (
                <div
                  key={run.id || idx}
                  style={{
                    padding: '0.5rem 0.75rem',
                    borderBottom: idx < runHistory.length - 1 ? '1px solid var(--border)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontSize: '0.75rem',
                  }}
                >
                  {run.status === "success" ? (
                    <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--success)' }} />
                  ) : run.status === "error" ? (
                    <XCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--error)' }} />
                  ) : (
                    <Clock className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--warning)' }} />
                  )}
                  <span style={{ color: 'var(--text-secondary)', flex: 1 }}>
                    {formatHistoryDate(run.startedAt)}
                  </span>
                  <span style={{ color: 'var(--text-muted)' }}>
                    {formatDuration(run.durationMs)}
                  </span>
                  {run.error && (
                    <span
                      style={{
                        color: 'var(--error)',
                        maxWidth: '100px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                      title={run.error}
                    >
                      {run.error}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

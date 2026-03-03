"use client";

import { useEffect, useState, useCallback } from "react";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { ActivityHeatmap } from "@/components/ActivityHeatmap";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useI18n } from "@/i18n/provider";
import {
  FileText,
  Search,
  MessageSquare,
  Terminal,
  CheckCircle,
  XCircle,
  Clock,
  Zap,
  Filter,
  RefreshCw,
  Shield,
  Wrench,
  Calendar,
  ChevronDown,
  Timer,
  Coins,
  Brain,
  RotateCcw,
  ArrowUpDown,
  Download,
} from "lucide-react";
import { RichDescription } from "@/components/RichDescription";
import { ApprovalCard } from "@/components/ApprovalCard";

interface Activity {
  id: string;
  timestamp: string;
  type: string;
  description: string;
  status: string;
  duration_ms: number | null;
  tokens_used: number | null;
  metadata?: Record<string, unknown>;
}

interface ActivitiesResponse {
  activities: Activity[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

const typeIcons: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  file: FileText,
  search: Search,
  message: MessageSquare,
  command: Terminal,
  security: Shield,
  build: Wrench,
  task: Zap,
  cron: RotateCcw,
  memory: Brain,
  approval: Shield,
  default: Zap,
};

const typeColorVars: Record<string, string> = {
  file: "--type-file",
  search: "--type-search",
  message: "--type-message",
  command: "--type-command",
  security: "--type-security",
  build: "--type-build",
  task: "--type-task",
  cron: "--type-cron",
  memory: "--type-memory",
  approval: "--type-approval",
};

const statusConfig: Record<string, { icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; colorVar: string }> = {
  success: { icon: CheckCircle, colorVar: "--success" },
  error: { icon: XCircle, colorVar: "--error" },
  pending: { icon: Clock, colorVar: "--warning" },
};

const allTypes = ["file", "search", "message", "command", "security", "build", "task", "cron", "memory", "approval"];

const datePresets = [
  { labelKey: "activity.today", days: 0 },
  { labelKey: "activity.last7days", days: 7 },
  { labelKey: "activity.last30days", days: 30 },
  { labelKey: "activity.allTime", days: -1 },
];

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function formatTokens(tokens: number): string {
  if (tokens < 1000) return tokens.toString();
  return `${(tokens / 1000).toFixed(1)}k`;
}

export default function ActivityPage() {
  const { t } = useI18n();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  
  // Filters
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [activePreset, setActivePreset] = useState<number | null>(1); // Default: Last 7 days

  const limit = 20;

  const fetchActivities = useCallback(async (append = false) => {
    const currentOffset = append ? offset : 0;
    
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    try {
      const params = new URLSearchParams();
      params.set("limit", limit.toString());
      params.set("offset", currentOffset.toString());
      params.set("sort", sort);
      
      if (selectedTypes.size > 0 && selectedTypes.size < allTypes.length) {
        if (selectedTypes.size === 1) {
          params.set("type", Array.from(selectedTypes)[0]);
        }
      }
      
      if (filterStatus !== "all") {
        params.set("status", filterStatus);
      }
      
      if (startDate) {
        params.set("startDate", startDate);
      }
      
      if (endDate) {
        params.set("endDate", endDate);
      }

      const res = await fetch(`/api/activities?${params.toString()}`);
      const data: ActivitiesResponse = await res.json();
      
      let filteredActivities = data.activities;
      if (selectedTypes.size > 1) {
        filteredActivities = data.activities.filter((a) => selectedTypes.has(a.type));
      }
      
      if (append) {
        setActivities((prev) => [...prev, ...filteredActivities]);
      } else {
        setActivities(filteredActivities);
      }
      
      setTotal(data.total);
      setHasMore(data.hasMore);
      setOffset(currentOffset + data.activities.length);
    } catch (error) {
      console.error("Failed to fetch activities:", error);
      if (!append) {
        setActivities([]);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [offset, sort, selectedTypes, filterStatus, startDate, endDate]);

  useEffect(() => {
    setOffset(0);
    fetchActivities(false);
  }, [sort, selectedTypes, filterStatus, startDate, endDate]);

  useEffect(() => {
    const end = format(endOfDay(new Date()), "yyyy-MM-dd");
    const start = format(startOfDay(subDays(new Date(), 7)), "yyyy-MM-dd");
    setStartDate(start);
    setEndDate(end);
  }, []);

  const handlePresetClick = (days: number, index: number) => {
    setActivePreset(index);
    const end = format(endOfDay(new Date()), "yyyy-MM-dd");
    
    if (days === -1) {
      setStartDate("");
      setEndDate("");
    } else if (days === 0) {
      const today = format(startOfDay(new Date()), "yyyy-MM-dd");
      setStartDate(today);
      setEndDate(end);
    } else {
      const start = format(startOfDay(subDays(new Date(), days)), "yyyy-MM-dd");
      setStartDate(start);
      setEndDate(end);
    }
  };

  const toggleType = (type: string) => {
    const newTypes = new Set(selectedTypes);
    if (newTypes.has(type)) {
      newTypes.delete(type);
    } else {
      newTypes.add(type);
    }
    setSelectedTypes(newTypes);
    setActivePreset(null);
  };

  const clearTypeFilters = () => {
    setSelectedTypes(new Set());
  };

  const handleLoadMore = () => {
    fetchActivities(true);
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem 0' }}>
          <RefreshCw className="w-8 h-8 animate-spin" style={{ color: 'var(--accent)' }} />
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="p-4 md:p-8">
        <div className="mb-4 md:mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold mb-2" style={{ 
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-heading)'
          }}>
            {t("activity.title")}
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>{t("activity.subtitle")}</p>
        </div>
        <a
          href="/api/activities?format=csv&limit=10000"
          download={`activities-${new Date().toISOString().split('T')[0]}.csv`}
          style={{
            display: "flex", alignItems: "center", gap: "0.5rem",
            padding: "0.5rem 1rem", borderRadius: "0.5rem",
            backgroundColor: "var(--card)", color: "var(--text-secondary)",
            border: "1px solid var(--border)", textDecoration: "none",
            fontSize: "0.875rem", cursor: "pointer", marginTop: "0.25rem",
          }}
        >
          <Download className="w-4 h-4" />
          {t("common.exportCsv")}
        </a>
      </div>

      {/* Activity Heatmap */}
      <div className="mb-4 md:mb-6">
        <ActivityHeatmap />
      </div>

      {/* Date Range Picker */}
      <div className="p-3 md:p-4 mb-4 md:mb-6 rounded-xl" style={{ 
        backgroundColor: 'var(--card)'
      }}>
        <div className="flex items-center gap-3 md:gap-4 mb-3 md:mb-4">
          <Calendar className="w-4 h-4 md:w-5 md:h-5" style={{ color: 'var(--text-secondary)' }} />
          <span className="text-xs md:text-sm" style={{ color: 'var(--text-secondary)' }}>Date Range</span>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          {datePresets.map((preset, index) => (
            <button
              key={preset.labelKey}
              onClick={() => handlePresetClick(preset.days, index)}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: 500,
                transition: 'all 0.2s',
                backgroundColor: activePreset === index ? 'rgba(255, 59, 48, 0.2)' : 'rgba(42, 42, 42, 0.5)',
                color: activePreset === index ? 'var(--accent)' : 'var(--text-secondary)',
                border: activePreset === index ? '1px solid rgba(255, 59, 48, 0.3)' : '1px solid transparent',
                cursor: 'pointer'
              }}
            >
              {t(preset.labelKey)}
            </button>
          ))}

          <div style={{ width: '1px', height: '2rem', backgroundColor: 'var(--border)', margin: '0 0.5rem' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setActivePreset(null);
              }}
              style={{
                backgroundColor: 'rgba(42, 42, 42, 0.5)',
                color: 'var(--text-secondary)',
                padding: '0.5rem 0.75rem',
                borderRadius: '0.5rem',
                border: '1px solid var(--border)',
                fontSize: '0.875rem',
                outline: 'none'
              }}
            />
            <span style={{ color: 'var(--text-muted)' }}>to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setActivePreset(null);
              }}
              style={{
                backgroundColor: 'rgba(42, 42, 42, 0.5)',
                color: 'var(--text-secondary)',
                padding: '0.5rem 0.75rem',
                borderRadius: '0.5rem',
                border: '1px solid var(--border)',
                fontSize: '0.875rem',
                outline: 'none'
              }}
            />
          </div>
        </div>
      </div>

      {/* Type Filter Chips */}
      <div className="p-3 md:p-4 mb-4 md:mb-6 rounded-xl" style={{ 
        backgroundColor: 'var(--card)'
      }}>
        <div className="flex items-center gap-3 md:gap-4 mb-3 md:mb-4">
          <Filter className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
          <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Filter by Type</span>
          {selectedTypes.size > 0 && (
            <button
              onClick={clearTypeFilters}
              style={{
                fontSize: '0.75rem',
                color: 'var(--accent)',
                marginLeft: 'auto',
                background: 'none',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              Clear all
            </button>
          )}
        </div>
        
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {allTypes.map((type) => {
            const TypeIcon = typeIcons[type] || typeIcons.default;
            const colorVar = typeColorVars[type] || "--text-secondary";
            const isSelected = selectedTypes.has(type);
            
            return (
              <button
                key={type}
                onClick={() => toggleType(type)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.375rem 0.75rem',
                  borderRadius: '9999px',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  transition: 'all 0.2s',
                  backgroundColor: isSelected ? `color-mix(in srgb, var(${colorVar}) 15%, transparent)` : 'rgba(42, 42, 42, 0.5)',
                  color: isSelected ? `var(${colorVar})` : 'var(--text-muted)',
                  border: isSelected ? `1px solid color-mix(in srgb, var(${colorVar}) 30%, transparent)` : '1px solid var(--border)',
                  cursor: 'pointer'
                }}
              >
                <TypeIcon className="w-4 h-4" />
                <span style={{ textTransform: 'capitalize' }}>{type}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Status and Sort Filters */}
      <div className="flex flex-wrap items-center gap-2 md:gap-4 mb-4 md:mb-6">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={{
            backgroundColor: 'rgba(42, 42, 42, 0.5)',
            color: 'var(--text-secondary)',
            padding: '0.5rem 0.75rem',
            borderRadius: '0.5rem',
            border: '1px solid var(--border)',
            outline: 'none',
            cursor: 'pointer'
          }}
        >
          <option value="all">All Statuses</option>
          <option value="success">Success</option>
          <option value="error">Error</option>
          <option value="pending">Pending</option>
        </select>

        <button
          onClick={() => setSort(sort === "newest" ? "oldest" : "newest")}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            backgroundColor: 'rgba(42, 42, 42, 0.5)',
            color: 'var(--text-secondary)',
            padding: '0.5rem 0.75rem',
            borderRadius: '0.5rem',
            border: '1px solid var(--border)',
            cursor: 'pointer',
            transition: 'border-color 0.2s'
          }}
        >
          <ArrowUpDown className="w-4 h-4" />
          <span>{sort === "newest" ? "Newest first" : "Oldest first"}</span>
        </button>

        <div className="text-xs md:text-sm w-full md:w-auto md:ml-auto mt-2 md:mt-0" style={{ color: 'var(--text-muted)' }}>
          Showing {activities.length} of {total} activities
        </div>
      </div>

      {/* Activity List */}
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--card)' }}>
        {activities.length === 0 && (
          <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-secondary)' }}>
            <Zap className="w-12 h-12" style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
            <p>No activities found</p>
          </div>
        )}

        {activities.map((activity, index) => {
          if (activity.type === "approval") {
            return (
              <ApprovalCard
                key={activity.id}
                id={activity.id}
                description={activity.description}
                timestamp={activity.timestamp}
                status={activity.status as "pending" | "approved" | "rejected"}
                metadata={activity.metadata as Record<string, unknown> | null}
                onDecision={(id, approved) => {
                  console.log(`Activity ${id} ${approved ? "approved" : "rejected"}`);
                }}
              />
            );
          }

          const TypeIcon = typeIcons[activity.type] || typeIcons.default;
          const colorVar = typeColorVars[activity.type] || "--text-secondary";
          const status = statusConfig[activity.status] || statusConfig.success;
          const StatusIcon = status.icon;

          return (
            <div
              key={activity.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '1rem',
                padding: '1.5rem',
                transition: 'background-color 0.2s',
                borderBottom: index !== activities.length - 1 ? '1px solid var(--border)' : 'none'
              }}
            >
              <div style={{
                padding: '0.75rem',
                borderRadius: '0.5rem',
                backgroundColor: `color-mix(in srgb, var(${colorVar}) 15%, transparent)`
              }}>
                <TypeIcon className="w-5 h-5" style={{ color: `var(${colorVar})` }} />
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                  <span style={{ 
                    fontWeight: 500, 
                    textTransform: 'capitalize', 
                    color: `var(${colorVar})` 
                  }}>
                    {activity.type}
                  </span>
                  <span style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    fontSize: '0.875rem',
                    color: `var(${status.colorVar})`,
                    backgroundColor: `color-mix(in srgb, var(${status.colorVar}) 15%, transparent)`,
                    padding: '0.125rem 0.5rem',
                    borderRadius: '0.25rem'
                  }}>
                    <StatusIcon className="w-3 h-3" />
                    {activity.status}
                  </span>
                </div>
                <RichDescription text={activity.description} style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }} />
                
                {/* Duration and Tokens */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.875rem' }}>
                  {activity.duration_ms !== null && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-muted)' }}>
                      <Timer className="w-3.5 h-3.5" />
                      {formatDuration(activity.duration_ms)}
                    </span>
                  )}
                  {activity.tokens_used !== null && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-muted)' }}>
                      <Coins className="w-3.5 h-3.5" />
                      {formatTokens(activity.tokens_used)} tokens
                    </span>
                  )}
                </div>
                
                {activity.metadata && Object.keys(activity.metadata).length > 0 && (
                  <details style={{ marginTop: '0.75rem' }}>
                    <summary style={{ 
                      fontSize: '0.75rem', 
                      color: 'var(--text-muted)', 
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem'
                    }}>
                      <ChevronDown className="w-3 h-3" />
                      View metadata
                    </summary>
                    <pre style={{
                      marginTop: '0.5rem',
                      fontSize: '0.75rem',
                      color: 'var(--text-muted)',
                      backgroundColor: 'rgba(42, 42, 42, 0.5)',
                      padding: '0.75rem',
                      borderRadius: '0.5rem',
                      overflowX: 'auto'
                    }}>
                      {JSON.stringify(activity.metadata, null, 2)}
                    </pre>
                  </details>
                )}
              </div>

              <div style={{ textAlign: 'right', fontSize: '0.875rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                <div>{format(new Date(activity.timestamp), "MMM d, yyyy")}</div>
                <div style={{ color: 'var(--text-muted)', opacity: 0.7 }}>{format(new Date(activity.timestamp), "HH:mm:ss")}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Load More Button */}
      {hasMore && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1.5rem' }}>
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              backgroundColor: 'rgba(42, 42, 42, 0.5)',
              color: 'var(--text-secondary)',
              padding: '0.75rem 1.5rem',
              borderRadius: '0.5rem',
              fontWeight: 500,
              border: 'none',
              cursor: loadingMore ? 'not-allowed' : 'pointer',
              opacity: loadingMore ? 0.5 : 1,
              transition: 'background-color 0.2s'
            }}
          >
            {loadingMore ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4" />
                Load more activities
              </>
            )}
          </button>
        </div>
      )}

      {/* End of list indicator */}
      {!hasMore && activities.length > 0 && (
        <div style={{ textAlign: 'center', marginTop: '1.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          — End of activity log —
        </div>
      )}
      </div>
    </ErrorBoundary>
  );
}

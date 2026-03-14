"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  Bot,
  Calendar,
  CheckCircle,
  Circle,
  Gamepad2,
  Puzzle,
  Server,
  Terminal,
  Users,
  XCircle,
  Zap,
  Brain,
} from "lucide-react";

import { ActivityFeed } from "@/components/ActivityFeed";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { MoodWidget } from "@/components/MoodWidget";
import { PageHeader } from "@/components/PageHeader";
import { StatsCard } from "@/components/StatsCard";
import { SuggestionsPanel } from "@/components/SuggestionsPanel";
import { WeatherWidget } from "@/components/WeatherWidget";
import { useI18n } from "@/i18n/provider";

function isRealTelemetryEnabled(): boolean {
  return process.env.NEXT_PUBLIC_DASHBOARD_REAL_TELEMETRY === "true";
}

const AGENT_STATUS = {
  WORKING: "working",
  ONLINE: "online",
  IDLE: "idle",
  OFFLINE: "offline",
} as const;

type AgentStatus = (typeof AGENT_STATUS)[keyof typeof AGENT_STATUS];

const STATUS_COLORS: Record<AgentStatus, string> = {
  working: "var(--accent)",
  online: "var(--success)",
  idle: "var(--info)",
  offline: "var(--text-muted)",
};

interface DashboardAgentTelemetry {
  id: string;
  name: string;
  emoji: string;
  color: string;
  model: string;
  status: AgentStatus;
  activeSessions: number;
  lastActivity?: string;
}

interface DashboardTelemetryDegraded {
  section: string;
  code: string;
  retriable: boolean;
  message: string;
}

interface DashboardTelemetryPayload {
  freshness: {
    snapshotAt: string;
    snapshotAgeSec: number;
    stalenessThresholdSec: number;
    status: "fresh" | "stale";
  };
  summary: {
    totalActivities: number;
    todayActivities: number;
    successfulActivities: number;
    failedActivities: number;
  };
  agents: DashboardAgentTelemetry[];
  degraded: DashboardTelemetryDegraded[];
}

interface LegacyActivityStatsPayload {
  total?: number;
  today?: number;
  byStatus?: Record<string, number>;
}

interface LegacyAgentPayload {
  id: string;
  name: string;
  emoji?: string;
  color?: string;
  model?: string;
}

interface LegacyAgentStatusPayload {
  id: string;
  name: string;
  status: AgentStatus;
  activeSessions: number;
  lastActivity?: string;
}

interface LegacyAgentsResponse {
  agents?: LegacyAgentPayload[];
}

interface LegacyAgentStatusResponse {
  agents?: LegacyAgentStatusPayload[];
}

function normalizeLegacyTelemetry(
  activityStats: LegacyActivityStatsPayload,
  agentsResponse: LegacyAgentsResponse,
  statusResponse: LegacyAgentStatusResponse,
): DashboardTelemetryPayload {
  const statusByAgent = new Map<string, LegacyAgentStatusPayload>();
  const statusEntries = statusResponse.agents ?? [];
  statusEntries.forEach((entry) => {
    statusByAgent.set(entry.id, entry);
  });

  const agents = (agentsResponse.agents ?? []).map((agent) => {
    const status = statusByAgent.get(agent.id);

    return {
      id: agent.id,
      name: agent.name,
      emoji: agent.emoji ?? "🤖",
      color: agent.color ?? "#3b82f6",
      model: agent.model ?? "unknown",
      status: status?.status ?? AGENT_STATUS.OFFLINE,
      activeSessions: status?.activeSessions ?? 0,
      lastActivity: status?.lastActivity,
    };
  });

  const successfulActivities =
    (activityStats.byStatus?.success ?? 0) +
    (activityStats.byStatus?.approved ?? 0);

  const failedActivities =
    (activityStats.byStatus?.error ?? 0) +
    (activityStats.byStatus?.rejected ?? 0);

  return {
    freshness: {
      snapshotAt: new Date().toISOString(),
      snapshotAgeSec: 0,
      stalenessThresholdSec: 30,
      status: "fresh",
    },
    summary: {
      totalActivities: activityStats.total ?? 0,
      todayActivities: activityStats.today ?? 0,
      successfulActivities,
      failedActivities,
    },
    agents,
    degraded: [],
  };
}

function isDashboardTelemetryPayload(value: unknown): value is DashboardTelemetryPayload {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const payload = value as Partial<DashboardTelemetryPayload>;
  return Boolean(
    payload.summary &&
    payload.freshness &&
    Array.isArray(payload.agents) &&
    Array.isArray(payload.degraded),
  );
}

const EMPTY_TELEMETRY: DashboardTelemetryPayload = {
  freshness: {
    snapshotAt: new Date(0).toISOString(),
    snapshotAgeSec: 0,
    stalenessThresholdSec: 30,
    status: "fresh",
  },
  summary: {
    totalActivities: 0,
    todayActivities: 0,
    successfulActivities: 0,
    failedActivities: 0,
  },
  agents: [],
  degraded: [],
};

export default function DashboardPage() {
  const { t } = useI18n();
  const [telemetry, setTelemetry] = useState<DashboardTelemetryPayload>(EMPTY_TELEMETRY);
  const [telemetryLoading, setTelemetryLoading] = useState(true);
  const [telemetryError, setTelemetryError] = useState<string | null>(null);
  const [manualRefreshCounter, setManualRefreshCounter] = useState(0);

  useEffect(() => {
    let active = true;

    const fetchTelemetry = async () => {
      try {
        let payload: DashboardTelemetryPayload;

        if (isRealTelemetryEnabled()) {
          const response = await fetch("/api/telemetry/dashboard");
          if (!response.ok) {
            throw new Error(`Telemetry request failed: ${response.status}`);
          }

          const parsed = await response.json();
          if (!isDashboardTelemetryPayload(parsed)) {
            throw new Error("Telemetry payload is invalid");
          }

          payload = parsed;
        } else {
          const [activityStatsResponse, agentsResponse, statusResponse] = await Promise.all([
            fetch("/api/activities/stats"),
            fetch("/api/agents"),
            fetch("/api/agents/status"),
          ]);

          if (!activityStatsResponse.ok || !agentsResponse.ok || !statusResponse.ok) {
            throw new Error("Legacy telemetry request failed");
          }

          payload = normalizeLegacyTelemetry(
            await activityStatsResponse.json(),
            await agentsResponse.json(),
            await statusResponse.json(),
          );
        }

        if (!active) {
          return;
        }

        setTelemetry(payload);
        setTelemetryError(null);
      } catch (error) {
        console.error("Failed to load telemetry dashboard payload:", error);
        if (active) {
          setTelemetryError(t("dashboard.telemetry.loadError"));
        }
      } finally {
        if (active) {
          setTelemetryLoading(false);
        }
      }
    };

    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 15000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [t, manualRefreshCounter]);

  const handleRetry = () => {
    setTelemetryLoading(true);
    setManualRefreshCounter((current) => current + 1);
  };

  const hasDegradedSections = telemetry.degraded.length > 0;
  const hasStaleSnapshot = telemetry.freshness.status === "stale";

  return (
    <ErrorBoundary>
      <div className="p-4 md:p-8">
        <PageHeader
          title={t("dashboard.title")}
          subtitle={t("dashboard.overview")}
          helpTitle={t("help.dashboard.title")}
          helpDescription={t("help.dashboard.description")}
        />

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-4 md:mb-6">
          <div className="lg:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatsCard
              title={t("dashboard.totalActivities")}
              value={telemetry.summary.totalActivities.toLocaleString()}
              icon={<Activity className="w-5 h-5" />}
              iconColor="var(--info)"
            />
            <StatsCard
              title={t("dashboard.today")}
              value={telemetry.summary.todayActivities.toLocaleString()}
              icon={<Zap className="w-5 h-5" />}
              iconColor="var(--accent)"
            />
            <StatsCard
              title={t("dashboard.successful")}
              value={telemetry.summary.successfulActivities.toLocaleString()}
              icon={<CheckCircle className="w-5 h-5" />}
              iconColor="var(--success)"
            />
            <StatsCard
              title={t("dashboard.errors")}
              value={telemetry.summary.failedActivities.toLocaleString()}
              icon={<XCircle className="w-5 h-5" />}
              iconColor="var(--error)"
            />
          </div>

          <div className="lg:col-span-1">
            <WeatherWidget />
          </div>
        </div>

        <div
          className="mb-6 rounded-xl overflow-hidden"
          style={{
            backgroundColor: "var(--card)",
            border: "1px solid var(--border)",
          }}
        >
          <div
            className="flex items-center justify-between px-5 py-4"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <div className="flex items-center gap-3">
              <div className="accent-line" />
              <h2
                className="text-base font-semibold"
                style={{
                  fontFamily: "var(--font-heading)",
                  color: "var(--text-primary)",
                }}
              >
                <Users className="inline-block w-5 h-5 mr-2 mb-1" />
                {t("dashboard.multiAgentSystem")}
              </h2>
            </div>
            <div className="flex gap-2">
              <Link
                href="/office"
                className="text-sm font-medium px-3 py-1.5 rounded-lg transition-all"
                style={{
                  backgroundColor: "var(--accent)",
                  color: "var(--text-primary)",
                }}
              >
                <Gamepad2 className="inline-block w-4 h-4 mr-1 mb-0.5" />
                {t("dashboard.openOffice")}
              </Link>
              <Link
                href="/agents"
                className="text-sm font-medium"
                style={{ color: "var(--accent)" }}
              >
                {t("common.viewAll")}
              </Link>
            </div>
          </div>

          <div className="p-5">
            {hasStaleSnapshot && !telemetryLoading && !telemetryError && (
              <div
                className="mb-3 text-xs flex items-center justify-between rounded-md px-3 py-2"
                style={{ backgroundColor: "var(--card-elevated)", color: "var(--text-secondary)" }}
              >
                <span>
                  {t("dashboard.telemetry.stale", { seconds: telemetry.freshness.snapshotAgeSec })}
                </span>
                <button
                  type="button"
                  className="text-xs font-medium"
                  style={{ color: "var(--accent)" }}
                  onClick={handleRetry}
                >
                  {t("common.retry")}
                </button>
              </div>
            )}

            {hasDegradedSections && !telemetryLoading && !telemetryError && (
              <div
                className="mb-3 rounded-md px-3 py-2"
                style={{ backgroundColor: "var(--card-elevated)", border: "1px solid var(--border)" }}
              >
                <p className="text-xs font-medium" style={{ color: "var(--error)" }}>
                  {t("dashboard.telemetry.degradedTitle", { count: telemetry.degraded.length })}
                </p>
                <div className="mt-1 space-y-1">
                  {telemetry.degraded.map((entry) => (
                    <p
                      key={`${entry.section}-${entry.code}`}
                      className="text-xs"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {t("dashboard.telemetry.degradedItem", {
                        section: entry.section,
                        message: entry.message,
                      })}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {telemetryLoading && (
              <div className="text-sm" style={{ color: "var(--text-muted)" }}>
                {t("dashboard.telemetry.loading")}
              </div>
            )}

            {!telemetryLoading && telemetryError && (
              <div className="space-y-2">
                <p className="text-sm" style={{ color: "var(--error)" }}>
                  {telemetryError}
                </p>
                <button
                  type="button"
                  className="text-xs font-medium"
                  style={{ color: "var(--accent)" }}
                  onClick={handleRetry}
                >
                  {t("common.retry")}
                </button>
              </div>
            )}

            {!telemetryLoading && !telemetryError && telemetry.agents.length === 0 && (
              <div className="text-sm" style={{ color: "var(--text-muted)" }}>
                {t("dashboard.telemetry.empty")}
              </div>
            )}

            {!telemetryLoading && !telemetryError && telemetry.agents.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {telemetry.agents.map((agent) => (
                  <div
                    key={agent.id}
                    className="p-3 rounded-lg transition-all hover:scale-105"
                    style={{
                      backgroundColor: "var(--card-elevated)",
                      border: `2px solid ${agent.color}`,
                      cursor: "pointer",
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-2xl">{agent.emoji}</div>
                      <Circle
                        className="w-2 h-2"
                        style={{
                          fill: STATUS_COLORS[agent.status],
                          color: STATUS_COLORS[agent.status],
                        }}
                      />
                    </div>
                    <div
                      className="text-sm font-bold mb-1"
                      style={{
                        fontFamily: "var(--font-heading)",
                        color: "var(--text-primary)",
                      }}
                    >
                      {agent.name}
                    </div>
                    <div
                      className="text-xs truncate mb-1"
                      style={{ color: "var(--text-muted)" }}
                      title={agent.model}
                    >
                      <Bot className="inline-block w-3 h-3 mr-1" />
                      {agent.model.split("/").pop()}
                    </div>
                    <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {t(`agents.status.${agent.status}`)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          <div
            className="lg:col-span-2 rounded-xl overflow-hidden"
            style={{
              backgroundColor: "var(--card)",
              border: "1px solid var(--border)",
            }}
          >
            <div
              className="flex items-center justify-between px-5 py-4"
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              <div className="flex items-center gap-3">
                <div className="accent-line" />
                <h2
                  className="text-base font-semibold"
                  style={{
                    fontFamily: "var(--font-heading)",
                    color: "var(--text-primary)",
                  }}
                >
                  {t("dashboard.recentActivity")}
                </h2>
              </div>
            </div>
            <div className="p-0">
              <ActivityFeed limit={5} />
            </div>
          </div>

          <div
            className="rounded-xl overflow-hidden"
            style={{
              backgroundColor: "var(--card)",
              border: "1px solid var(--border)",
            }}
          >
            <div
              className="flex items-center justify-between px-5 py-4"
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              <div className="flex items-center gap-3">
                <div className="accent-line" />
                <h2
                  className="text-base font-semibold"
                  style={{
                    fontFamily: "var(--font-heading)",
                    color: "var(--text-primary)",
                  }}
                >
                  {t("dashboard.quickLinks")}
                </h2>
              </div>
            </div>
            <div className="p-4 grid grid-cols-2 gap-2">
              {[
                { href: "/cron", icon: Calendar, labelKey: "dashboard.cronJobs", color: "#a78bfa" },
                { href: "/system", icon: Server, labelKey: "dashboard.system", color: "var(--success)" },
                { href: "/logs", icon: Terminal, labelKey: "dashboard.liveLogs", color: "#60a5fa" },
                { href: "/memory", icon: Brain, labelKey: "dashboard.memory", color: "#f59e0b" },
                { href: "/skills", icon: Puzzle, labelKey: "dashboard.skills", color: "#4ade80" },
              ].map(({ href, icon: Icon, labelKey, color }) => (
                <Link
                  key={href}
                  href={href}
                  className="p-3 rounded-lg transition-all hover:scale-[1.02]"
                  style={{ backgroundColor: "var(--card-elevated)", border: "1px solid var(--border)" }}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4" style={{ color }} />
                    <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                      {t(labelKey)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>

            <div style={{ margin: "1rem", marginTop: "0.5rem" }}>
              <MoodWidget />
            </div>

            <div style={{ margin: "1rem", marginTop: "0.5rem" }}>
              <div
                className="p-4 rounded-lg"
                style={{ backgroundColor: "var(--card-elevated)", border: "1px solid var(--border)" }}
              >
                <h3
                  className="text-sm font-semibold mb-3"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {t("dashboard.smartSuggestions")}
                </h3>
                <SuggestionsPanel compact maxItems={3} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}

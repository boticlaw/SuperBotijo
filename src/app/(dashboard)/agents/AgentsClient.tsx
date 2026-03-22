"use client";

import { useEffect, useState } from "react";
import {
  Bot,
  Circle,
  MessageSquare,
  HardDrive,
  Shield,
  Users,
  Activity,
  GitBranch,
  LayoutGrid,
  Zap,
  TrendingUp,
  Clock,
  Wrench,
} from "lucide-react";
import { AgentOrganigrama } from "@/components/AgentOrganigrama";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PageHeader } from "@/components/PageHeader";
import { useI18n } from "@/i18n/provider";

type AgentStatus = "working" | "idle" | "error" | "paused" | "online" | "offline";

interface AgentMood {
  agentId: string;
  mood: "productive" | "busy" | "frustrated" | "content" | "tired";
  emoji: string;
  streak: number;
  energyLevel: number;
  lastCalculated: string;
}

export interface Agent {
  id: string;
  name: string;
  emoji: string;
  color: string;
  model: string;
  workspace?: string;
  dmPolicy?: string;
  allowAgents: string[];
  allowAgentsDetails?: Array<{
    id: string;
    name: string;
    emoji: string;
    color: string;
  }>;
  botToken?: string;
  status: AgentStatus;
  lastActivity?: string;
  activeSessions: number;
  sessionCount: number;
  tokensUsed: number;
  currentTask?: string;
  mood?: AgentMood;
  skills?: string[];
}

// Status configuration with colors
const STATUS_CONFIG: Record<AgentStatus, { color: string; bgColor: string; label: string }> = {
  working: { color: "#3b82f6", bgColor: "#3b82f620", label: "Working" },
  online: { color: "#4ade80", bgColor: "#4ade8020", label: "Online" },
  idle: { color: "#f59e0b", bgColor: "#f59e0b20", label: "Idle" },
  paused: { color: "#8b5cf6", bgColor: "#8b5cf620", label: "Paused" },
  error: { color: "#ef4444", bgColor: "#ef444420", label: "Error" },
  offline: { color: "#6b7280", bgColor: "#6b728020", label: "Offline" },
};

// Mood configuration
const MOOD_CONFIG: Record<AgentMood["mood"], { color: string; label: string }> = {
  productive: { color: "#4ade80", label: "Productive" },
  busy: { color: "#3b82f6", label: "Busy" },
  content: { color: "#f59e0b", label: "Content" },
  frustrated: { color: "#ef4444", label: "Frustrated" },
  tired: { color: "#6b7280", label: "Tired" },
};

function formatTokens(tokens: number): string {
  if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`;
  return tokens.toString();
}

function formatWorkspace(workspace?: string): string {
  if (!workspace) return "-";
  const parts = workspace.split("/");
  return parts.length > 3 ? `.../${parts.slice(-2).join("/")}` : workspace;
}

export default function AgentsClient({ initialAgents }: { initialAgents: Agent[] }) {
  const [agents, setAgents] = useState<Agent[]>(initialAgents);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"cards" | "organigrama">("cards");
  const { t } = useI18n();

  useEffect(() => {
    // Only set interval, we already have initial data
    const interval = setInterval(fetchAgents, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchAgents = async () => {
    try {
      const res = await fetch("/api/agents");
      const data = await res.json();
      setAgents(data.agents || []);
    } catch (error) {
      console.error("Error fetching agents:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatLastActivity = (timestamp?: string) => {
    if (!timestamp) return t("agents.never");
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return t("agents.justNow");
    if (minutes < 60) return t("agents.minutesAgo", { count: minutes });
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return t("agents.hoursAgo", { count: hours });
    const days = Math.floor(hours / 24);
    return t("agents.daysAgo", { count: days });
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-pulse text-lg" style={{ color: "var(--text-muted)" }}>
            {t("agents.loading")}
          </div>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="p-4 md:p-8">
        <PageHeader
          title={t("agents.title")}
          subtitle={t("agents.overview", { count: agents.length })}
          icon={<Users className="w-8 h-8" />}
          helpTitle={t("help.agents.title")}
          helpDescription={t("help.agents.description")}
        />

        <div className="flex gap-2 mb-6 border-b" style={{ borderColor: "var(--border)" }}>
          {[
            { id: "cards" as const, labelKey: "agents.cards", icon: LayoutGrid },
            { id: "organigrama" as const, labelKey: "agents.organigrama", icon: GitBranch },
          ].map(({ id, labelKey, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className="flex items-center gap-2 px-4 py-2 font-medium transition-all"
              style={{
                color: activeTab === id ? "var(--accent)" : "var(--text-secondary)",
                borderBottom: activeTab === id ? "2px solid var(--accent)" : "2px solid transparent",
                borderTop: "none",
                borderLeft: "none",
                borderRight: "none",
                background: "none",
                cursor: "pointer",
                paddingBottom: "0.5rem",
              }}
            >
              <Icon className="w-4 h-4" />
              {t(labelKey)}
            </button>
          ))}
        </div>

        {activeTab === "organigrama" && (
          <div className="rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
            <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
              <h2 className="font-semibold" style={{ color: "var(--text-primary)" }}>{t("agents.hierarchy")}</h2>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>{t("agents.hierarchySubtitle")}</p>
            </div>
            <AgentOrganigrama agents={agents} />
          </div>
        )}

        {activeTab === "cards" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {agents.map((agent) => {
              const statusConfig = STATUS_CONFIG[agent.status];
              const moodConfig = agent.mood ? MOOD_CONFIG[agent.mood.mood] : null;

              return (
                <div
                  key={agent.id}
                  className="rounded-xl overflow-hidden transition-all hover:scale-[1.01]"
                  style={{
                    backgroundColor: "var(--card)",
                    border: `2px solid ${statusConfig.color}40`,
                  }}
                >
                  {/* Header */}
                  <div
                    className="px-5 py-4 flex items-center justify-between"
                    style={{
                      borderBottom: "1px solid var(--border)",
                      background: `linear-gradient(135deg, ${agent.color}15, transparent)`,
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl relative"
                        style={{
                          backgroundColor: `${agent.color}20`,
                          border: `2px solid ${agent.color}`,
                        }}
                      >
                        {agent.emoji}
                        {/* Mood indicator overlay */}
                        {agent.mood && (
                          <div
                            className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-xs"
                            style={{
                              backgroundColor: moodConfig?.color,
                              border: "2px solid var(--card)",
                            }}
                            title={`${moodConfig?.label} - Energy: ${agent.mood.energyLevel}%`}
                          >
                            {agent.mood.emoji}
                          </div>
                        )}
                      </div>
                      <div>
                        <h3
                          className="text-lg font-bold"
                          style={{
                            fontFamily: "var(--font-heading)",
                            color: "var(--text-primary)",
                          }}
                        >
                          {agent.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Circle
                            className="w-2 h-2"
                            style={{
                              fill: statusConfig.color,
                              color: statusConfig.color,
                            }}
                          />
                          <span
                            className="text-xs font-medium px-2 py-0.5 rounded"
                            style={{
                              color: statusConfig.color,
                              backgroundColor: statusConfig.bgColor,
                            }}
                          >
                            {t(`agents.status.${agent.status}`)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {agent.botToken && (
                        <div title={t("agents.telegramConnected")}>
                          <MessageSquare
                            className="w-5 h-5"
                            style={{ color: "#0088cc" }}
                          />
                        </div>
                      )}
                      {agent.activeSessions > 0 && (
                        <span
                          className="text-xs font-bold px-2 py-1 rounded-full"
                          style={{
                            backgroundColor: "var(--accent)",
                            color: "white",
                          }}
                        >
                          {agent.activeSessions} {t("agents.active")}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-3 gap-px bg-[var(--border)]">
                    <div
                      className="p-3 text-center"
                      style={{ backgroundColor: "var(--card)" }}
                    >
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <Zap className="w-3 h-3" style={{ color: agent.color }} />
                        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                          {t("agents.tokens")}
                        </span>
                      </div>
                      <div className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                        {formatTokens(agent.tokensUsed)}
                      </div>
                    </div>
                    <div
                      className="p-3 text-center"
                      style={{ backgroundColor: "var(--card)" }}
                    >
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <TrendingUp className="w-3 h-3" style={{ color: agent.color }} />
                        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                          {t("agents.sessions")}
                        </span>
                      </div>
                      <div className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                        {agent.sessionCount}
                      </div>
                    </div>
                    <div
                      className="p-3 text-center"
                      style={{ backgroundColor: "var(--card)" }}
                    >
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <Activity className="w-3 h-3" style={{ color: agent.color }} />
                        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                          {t("agents.energy")}
                        </span>
                      </div>
                      <div className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                        {agent.mood ? `${agent.mood.energyLevel}%` : "-"}
                      </div>
                    </div>
                  </div>

                  {/* Current Task (if working) */}
                  {agent.status === "working" && agent.currentTask && (
                    <div
                      className="px-5 py-3"
                      style={{ backgroundColor: "var(--card-elevated)", borderBottom: "1px solid var(--border)" }}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                        <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                          {t("agents.currentTask")}:
                        </span>
                        <span className="text-xs truncate" style={{ color: "var(--text-primary)" }}>
                          {agent.currentTask}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Details */}
                  <div className="p-4 space-y-3">
                    {/* Model */}
                    <div className="flex items-center gap-3">
                      <Bot className="w-4 h-4 shrink-0" style={{ color: agent.color }} />
                      <div className="flex-1 min-w-0">
                        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                          {t("agents.model")}:
                        </span>
                        <span className="text-xs font-mono ml-2" style={{ color: "var(--text-primary)" }}>
                          {agent.model.split("/").pop() || agent.model}
                        </span>
                      </div>
                    </div>

                    {/* Workspace */}
                    {agent.workspace && (
                      <div className="flex items-center gap-3">
                        <HardDrive className="w-4 h-4 shrink-0" style={{ color: agent.color }} />
                        <div className="flex-1 min-w-0">
                          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                            {t("agents.workspace")}:
                          </span>
                          <span
                            className="text-xs font-mono ml-2 truncate"
                            style={{ color: "var(--text-primary)" }}
                            title={agent.workspace}
                          >
                            {formatWorkspace(agent.workspace)}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* DM Policy */}
                    {agent.dmPolicy && (
                      <div className="flex items-center gap-3">
                        <Shield className="w-4 h-4 shrink-0" style={{ color: agent.color }} />
                        <div className="flex-1 min-w-0">
                          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                            {t("agents.dmPolicy")}:
                          </span>
                          <span className="text-xs font-medium ml-2" style={{ color: "var(--text-primary)" }}>
                            {agent.dmPolicy}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Skills */}
                    {agent.skills && agent.skills.length > 0 && (
                      <div className="flex items-start gap-3">
                        <Wrench className="w-4 h-4 shrink-0 mt-0.5" style={{ color: agent.color }} />
                        <div className="flex-1 min-w-0">
                          <span className="text-xs block mb-1.5" style={{ color: "var(--text-muted)" }}>
                            {t("agents.skills")}:
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {agent.skills.map((skill) => (
                              <span
                                key={skill}
                                className="text-xs px-2 py-0.5 rounded font-mono"
                                style={{
                                  backgroundColor: "var(--card-elevated)",
                                  border: "1px solid var(--border)",
                                  color: "var(--text-secondary)",
                                }}
                              >
                                {skill}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Footer - Last Activity */}
                  <div
                    className="px-5 py-3 flex items-center justify-between"
                    style={{ borderTop: "1px solid var(--border)" }}
                  >
                    <div className="flex items-center gap-2">
                      <Clock className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {t("agents.lastActivity")}: {formatLastActivity(agent.lastActivity)}
                      </span>
                    </div>
                    {agent.mood && agent.mood.streak > 0 && (
                      <div className="flex items-center gap-1">
                        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                          {t("agents.streak")}:
                        </span>
                        <span
                          className="text-xs font-bold px-1.5 py-0.5 rounded"
                          style={{
                            backgroundColor: moodConfig?.color + "20",
                            color: moodConfig?.color,
                          }}
                        >
                          🔥 {agent.mood.streak}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
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
  Network,
  RefreshCw,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { AgentOrganigrama } from "@/components/AgentOrganigrama";
import { CommunicationGraphComponent } from "@/components/CommunicationGraph";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PageHeader } from "@/components/PageHeader";
import { useI18n } from "@/i18n/provider";
import type { CommunicationGraph, MessageType } from "@/lib/communication-aggregator";

interface Agent {
  id: string;
  name: string;
  emoji: string;
  color: string;
  model: string;
  workspace: string;
  dmPolicy?: string;
  allowAgents: string[];
  allowAgentsDetails?: Array<{
    id: string;
    name: string;
    emoji: string;
    color: string;
  }>;
  botToken?: string;
  status: "online" | "offline";
  lastActivity?: string;
  activeSessions: number;
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"cards" | "organigrama" | "communication">("cards");
  const { t } = useI18n();

  const [commData, setCommData] = useState<CommunicationGraph | null>(null);
  const [commLoading, setCommLoading] = useState(false);
  const [commError, setCommError] = useState<string | null>(null);
  const [commFilters, setCommFilters] = useState<{ messageTypes: MessageType[] }>({ messageTypes: [] });

  useEffect(() => {
    fetchAgents();
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

  const fetchCommData = useCallback(async () => {
    setCommLoading(true);
    setCommError(null);
    try {
      const params = new URLSearchParams();
      if (commFilters.messageTypes.length > 0) {
        params.set("messageTypes", commFilters.messageTypes.join(","));
      }

      const res = await fetch(`/api/subagents/communications?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch communications");
      const graph = await res.json();
      setCommData(graph);
    } catch (err) {
      setCommError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setCommLoading(false);
    }
  }, [commFilters]);

  useEffect(() => {
    if (activeTab === "communication") {
      fetchCommData();
    }
  }, [fetchCommData, activeTab]);

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

  const handleCommEdgeClick = useCallback((edge: CommunicationGraph["edges"][0]) => {
    console.log("Edge clicked:", edge);
  }, []);

  const handleCommFilterChange = useCallback((newFilters: { messageTypes: MessageType[] }) => {
    setCommFilters(newFilters);
  }, []);

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
          { id: "communication" as const, labelKey: "agents.communication", icon: Network },
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

      {activeTab === "communication" && (
        <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", minHeight: "500px" }}>
          <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
            <div>
              <h2 className="font-semibold" style={{ color: "var(--text-primary)" }}>{t("agents.communicationGraph")}</h2>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>{t("agents.communicationSubtitle")}</p>
            </div>
            <button
              onClick={fetchCommData}
              disabled={commLoading}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm"
              style={{
                backgroundColor: "var(--card-elevated)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
                cursor: commLoading ? "wait" : "pointer",
                opacity: commLoading ? 0.6 : 1,
              }}
            >
              <RefreshCw size={14} className={commLoading ? "animate-spin" : ""} />
              {t("common.refresh")}
            </button>
          </div>
          <div style={{ height: "450px" }}>
            {commLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Loader2 size={32} className="animate-spin mb-3" style={{ color: "var(--accent)" }} />
                  <p style={{ color: "var(--text-muted)" }}>{t("agents.loading")}</p>
                </div>
              </div>
            ) : commError ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <AlertCircle size={32} className="mb-3" style={{ color: "var(--error)" }} />
                  <p style={{ color: "var(--error)" }}>{commError}</p>
                  <button
                    onClick={fetchCommData}
                    className="mt-3 px-4 py-2 rounded-lg"
                    style={{
                      backgroundColor: "var(--card-elevated)",
                      border: "1px solid var(--border)",
                      color: "var(--text-primary)",
                      cursor: "pointer",
                    }}
                  >
                    {t("common.retry")}
                  </button>
                </div>
              </div>
            ) : commData && commData.nodes.length > 0 ? (
              <CommunicationGraphComponent
                data={commData}
                onEdgeClick={handleCommEdgeClick}
                filters={commFilters}
                onFilterChange={handleCommFilterChange}
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Network size={64} style={{ opacity: 0.3, marginBottom: "16px", color: "var(--text-muted)" }} />
                  <p style={{ fontSize: "14px", color: "var(--text-muted)" }}>{t("agents.noCommData")}</p>
                  <p style={{ fontSize: "12px", marginTop: "8px", color: "var(--text-muted)" }}>
                    {t("agents.noCommDataHint")}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "cards" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {agents.map((agent) => (
            <div
              key={agent.id}
              className="rounded-xl overflow-hidden transition-all hover:scale-[1.02]"
              style={{
                backgroundColor: "var(--card)",
                border: "1px solid var(--border)",
              }}
            >
              <div
                className="px-5 py-4 flex items-center justify-between"
                style={{
                  borderBottom: "1px solid var(--border)",
                  background: `linear-gradient(135deg, ${agent.color}15, transparent)`,
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                    style={{
                      backgroundColor: `${agent.color}20`,
                      border: `2px solid ${agent.color}`,
                    }}
                  >
                    {agent.emoji}
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
                          fill: agent.status === "online" ? "#4ade80" : "#6b7280",
                          color: agent.status === "online" ? "#4ade80" : "#6b7280",
                        }}
                      />
                      <span
                        className="text-xs font-medium"
                        style={{
                          color:
                            agent.status === "online"
                              ? "#4ade80"
                              : "var(--text-muted)",
                        }}
                      >
                        {agent.status}
                      </span>
                    </div>
                  </div>
                </div>

                {agent.botToken && (
                  <div title={t("agents.telegramConnected")}>
                    <MessageSquare
                      className="w-5 h-5"
                      style={{ color: "#0088cc" }}
                    />
                  </div>
                )}
              </div>

              <div className="p-5 space-y-4">
                <div className="flex items-start gap-3">
                  <Bot className="w-4 h-4 mt-0.5" style={{ color: agent.color }} />
                  <div className="flex-1 min-w-0">
                    <div
                      className="text-xs font-medium mb-1"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {t("agents.model")}
                    </div>
                    <div
                      className="text-sm font-mono truncate"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {agent.model}
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <HardDrive
                    className="w-4 h-4 mt-0.5"
                    style={{ color: agent.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <div
                      className="text-xs font-medium mb-1"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {t("agents.workspace")}
                    </div>
                    <div
                      className="text-sm font-mono truncate"
                      style={{ color: "var(--text-primary)" }}
                      title={agent.workspace}
                    >
                      {agent.workspace}
                    </div>
                  </div>
                </div>

                {agent.dmPolicy && (
                  <div className="flex items-start gap-3">
                    <Shield
                      className="w-4 h-4 mt-0.5"
                      style={{ color: agent.color }}
                    />
                    <div className="flex-1">
                      <div
                        className="text-xs font-medium mb-1"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {t("agents.dmPolicy")}
                      </div>
                      <div
                        className="text-sm font-medium"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {agent.dmPolicy}
                      </div>
                    </div>
                  </div>
                )}

                {agent.allowAgents.length > 0 && (
                  <div className="flex items-start gap-3">
                    <Users
                      className="w-4 h-4 mt-0.5"
                      style={{ color: agent.color }}
                    />
                    <div className="flex-1">
                      <div
                        className="text-xs font-medium mb-2"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {t("agents.canSpawn", { count: agent.allowAgents.length })}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {agent.allowAgentsDetails && agent.allowAgentsDetails.length > 0 ? (
                          agent.allowAgentsDetails.map((subagent) => (
                            <div
                              key={subagent.id}
                              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-all hover:scale-105"
                              style={{
                                backgroundColor: `${subagent.color}15`,
                                border: `1px solid ${subagent.color}40`,
                              }}
                              title={`${subagent.name} (${subagent.id})`}
                            >
                              <span className="text-sm">{subagent.emoji}</span>
                              <span
                                style={{
                                  color: subagent.color,
                                  fontWeight: 600,
                                }}
                              >
                                {subagent.name}
                              </span>
                            </div>
                          ))
                        ) : (
                          agent.allowAgents.map((subagent) => (
                            <span
                              key={subagent}
                              className="text-xs px-2 py-1 rounded"
                              style={{
                                backgroundColor: `${agent.color}20`,
                                color: agent.color,
                                fontWeight: 500,
                              }}
                            >
                              {subagent}
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-[var(--border)]">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {t("agents.lastActivity")}: {formatLastActivity(agent.lastActivity)}
                    </span>
                  </div>
                  {agent.activeSessions > 0 && (
                    <span
                      className="text-xs font-medium px-2 py-1 rounded"
                      style={{
                        backgroundColor: "var(--success)20",
                        color: "var(--success)",
                      }}
                    >
                      {agent.activeSessions} {t("agents.active")}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      </div>
    </ErrorBoundary>
  );
}

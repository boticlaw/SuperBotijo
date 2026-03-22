"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  MessageSquare,
  Clock,
  Bot,
  RefreshCw,
  X,
  ChevronRight,
  Wrench,
  User,
  AlertTriangle,
  Search,
  Cpu,
  TrendingUp,
  Hash,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ModelDropdown } from "@/components/ModelDropdown";
import { useI18n } from "@/i18n/provider";
import type { SessionListItem, SessionMessage } from "@/operations/sessions-list-ops";

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
}

function shortModel(model: string): string {
  const m = model.replace("anthropic/", "").replace("claude-", "");
  const parts = m.split("-");
  if (parts.length >= 2) {
    const name = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
    const ver = parts.slice(1).join(".");
    return `${name} ${ver}`;
  }
  return model;
}

function typeColor(type: SessionListItem["type"]): string {
  switch (type) {
    case "main":
      return "var(--accent)";
    case "cron":
      return "#a78bfa";
    case "subagent":
      return "#60a5fa";
    case "direct":
      return "#4ade80";
    default:
      return "var(--text-muted)";
  }
}

function MessageBubble({ msg }: { msg: SessionMessage }) {
  const isUser = msg.type === "user";
  const isTool = msg.type === "tool_use";
  const isResult = msg.type === "tool_result";

  if (isTool) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "0.5rem",
          padding: "0.5rem 0.75rem",
          borderRadius: "0.5rem",
          backgroundColor: "rgba(96,165,250,0.08)",
          border: "1px solid rgba(96,165,250,0.2)",
          marginBottom: "0.5rem",
          fontSize: "0.78rem",
          fontFamily: "monospace",
        }}
      >
        <Wrench style={{ width: "13px", height: "13px", color: "#60a5fa", flexShrink: 0, marginTop: "2px" }} />
        <span style={{ color: "#60a5fa", fontWeight: 600, flexShrink: 0 }}>{msg.toolName}</span>
        <span style={{ color: "var(--text-muted)", wordBreak: "break-all" }}>
          {msg.content.replace(`${msg.toolName}(`, "").replace(/\)$/, "").slice(0, 200)}
        </span>
      </div>
    );
  }

  if (isResult) {
    return (
      <div
        style={{
          padding: "0.375rem 0.75rem",
          borderRadius: "0.375rem",
          backgroundColor: "rgba(34,197,94,0.06)",
          border: "1px solid rgba(34,197,94,0.15)",
          marginBottom: "0.5rem",
          fontSize: "0.75rem",
          color: "var(--text-muted)",
          fontFamily: "monospace",
          maxHeight: "3rem",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        ↳ {msg.content}
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        gap: "0.625rem",
        marginBottom: "0.75rem",
        alignItems: "flex-start",
        flexDirection: isUser ? "row-reverse" : "row",
      }}
    >
      <div
        style={{
          width: "24px",
          height: "24px",
          borderRadius: "12px",
          backgroundColor: isUser ? "var(--accent)" : "var(--card-elevated)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          fontSize: "11px",
        }}
      >
        {isUser ? (
          <User style={{ width: "12px", height: "12px", color: "var(--bg, #000)" }} />
        ) : (
          <Bot style={{ width: "12px", height: "12px", color: "var(--accent)" }} />
        )}
      </div>

      <div
        style={{
          maxWidth: "78%",
          padding: "0.5rem 0.75rem",
          borderRadius: isUser ? "1rem 1rem 0.25rem 1rem" : "1rem 1rem 1rem 0.25rem",
          backgroundColor: isUser ? "rgba(255,59,48,0.12)" : "var(--card-elevated)",
          border: `1px solid ${isUser ? "rgba(255,59,48,0.2)" : "var(--border)"}`,
          fontSize: "0.82rem",
          lineHeight: "1.5",
          color: "var(--text-primary)",
          wordBreak: "break-word",
          whiteSpace: "pre-wrap",
        }}
      >
        {msg.content.length > 800 ? msg.content.slice(0, 800) + "\n…(truncated)" : msg.content}
      </div>
    </div>
  );
}

function SessionDetail({
  session,
  onClose,
}: {
  session: SessionListItem;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<SessionMessage[]>([]);
  const [fetchState, setFetchState] = useState<"loading" | "error" | "success">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const prevSessionIdRef = useRef<string | null>(null);

  const hasNoSession = !session.sessionId;

  useEffect(() => {
    if (!session.sessionId) {
      return;
    }

    if (prevSessionIdRef.current === session.sessionId) {
      return;
    }
    prevSessionIdRef.current = session.sessionId;

    const controller = new AbortController();

    const timeoutId = setTimeout(() => {
      setFetchState("loading");
      setErrorMessage(null);
    }, 0);

    fetch(`/api/sessions?id=${session.sessionId}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => {
        setMessages(data.messages || []);
        if (data.error) {
          setFetchState("error");
          setErrorMessage(data.error);
        } else {
          setFetchState("success");
        }
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          setFetchState("error");
          setErrorMessage("Failed to load messages");
        }
      });

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [session.sessionId]);

  const loading = hasNoSession ? false : fetchState === "loading";
  const error = hasNoSession ? "No session file available" : errorMessage;

  const userCount = messages.filter((m) => m.type === "user").length;
  const assistantCount = messages.filter((m) => m.type === "assistant").length;
  const toolCount = messages.filter((m) => m.type === "tool_use").length;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        display: "flex",
        alignItems: "stretch",
        justifyContent: "flex-end",
        backgroundColor: "rgba(0,0,0,0.5)",
        backdropFilter: "blur(2px)",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "min(640px, 100vw)",
          height: "100%",
          backgroundColor: "var(--card)",
          borderLeft: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: "1rem 1.25rem",
            borderBottom: "1px solid var(--border)",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "1.25rem" }}>{session.typeEmoji}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    padding: "0.15rem 0.5rem",
                    borderRadius: "9999px",
                    backgroundColor: `color-mix(in srgb, ${typeColor(session.type)} 15%, transparent)`,
                    color: typeColor(session.type),
                  }}
                >
                  {session.typeLabel}
                </span>
                {session.aborted && (
                  <span
                    style={{
                      fontSize: "0.7rem",
                      padding: "0.15rem 0.5rem",
                      borderRadius: "9999px",
                      backgroundColor: "rgba(239,68,68,0.15)",
                      color: "var(--error)",
                    }}
                  >
                    ⚠ Aborted
                  </span>
                )}
              </div>
              <div
                style={{
                  fontFamily: "monospace",
                  fontSize: "0.7rem",
                  color: "var(--text-muted)",
                  marginTop: "0.2rem",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {session.key}
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                padding: "0.375rem",
                borderRadius: "0.5rem",
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--text-muted)",
                flexShrink: 0,
              }}
            >
              <X style={{ width: "16px", height: "16px" }} />
            </button>
          </div>

          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            {[
              { icon: Cpu, label: shortModel(session.model), color: "#a78bfa" },
              { icon: Hash, label: `${formatTokens(session.totalTokens)} tokens`, color: "var(--accent)" },
              {
                icon: TrendingUp,
                label: session.contextUsedPercent !== null ? `${session.contextUsedPercent}% ctx` : "ctx n/a",
                color:
                  session.contextUsedPercent !== null && session.contextUsedPercent > 80
                    ? "var(--error)"
                    : "var(--text-muted)",
              },
              {
                icon: Clock,
                label: formatDistanceToNow(new Date(session.updatedAt), { addSuffix: true }),
                color: "var(--text-muted)",
              },
            ].map(({ icon: Icon, label, color }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                <Icon style={{ width: "12px", height: "12px", color }} />
                <span style={{ fontSize: "0.75rem", color }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {messages.length > 0 && (
          <div
            style={{
              display: "flex",
              gap: "1rem",
              padding: "0.5rem 1.25rem",
              borderBottom: "1px solid var(--border)",
              backgroundColor: "var(--card-elevated)",
              flexShrink: 0,
            }}
          >
            {[
              { label: `${userCount} user`, color: "var(--accent)" },
              { label: `${assistantCount} assistant`, color: "#60a5fa" },
              { label: `${toolCount} tool calls`, color: "#4ade80" },
            ].map(({ label, color }) => (
              <span key={label} style={{ fontSize: "0.72rem", color }}>
                {label}
              </span>
            ))}
          </div>
        )}

        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "1rem 1.25rem",
          }}
        >
          {loading && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "3rem",
                color: "var(--text-muted)",
                gap: "0.5rem",
              }}
            >
              <div
                style={{
                  width: "16px",
                  height: "16px",
                  border: "2px solid var(--accent)",
                  borderTopColor: "transparent",
                  borderRadius: "50%",
                  animation: "spin 0.8s linear infinite",
                }}
              />
              Loading transcript...
            </div>
          )}

          {error && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "1rem",
                borderRadius: "0.75rem",
                backgroundColor: "rgba(239,68,68,0.1)",
                color: "var(--error)",
                fontSize: "0.875rem",
              }}
            >
              <AlertTriangle style={{ width: "16px", height: "16px" }} />
              {error}
            </div>
          )}

          {!loading && !error && messages.length === 0 && (
            <div
              style={{
                textAlign: "center",
                padding: "3rem",
                color: "var(--text-muted)",
              }}
            >
              <MessageSquare style={{ width: "40px", height: "40px", margin: "0 auto 0.75rem", opacity: 0.3 }} />
              <p>No messages in this session</p>
            </div>
          )}

          {!loading && messages.map((msg) => <MessageBubble key={msg.id} msg={msg} />)}
        </div>
      </div>
    </div>
  );
}

function SessionRow({
  session,
  onClick,
  onModelChanged,
}: {
  session: SessionListItem;
  onClick: () => void;
  onModelChanged?: (sessionId: string, newModel: string) => void;
}) {
  const color = typeColor(session.type);
  const contextBar = session.contextUsedPercent !== null ? Math.min(session.contextUsedPercent, 100) : null;

  return (
    <div
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        padding: "0.75rem 1rem",
        cursor: "pointer",
        borderBottom: "1px solid var(--border)",
        transition: "background-color 0.1s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = "var(--card-elevated)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = "transparent";
      }}
    >
      <div
        style={{
          width: "32px",
          height: "32px",
          borderRadius: "8px",
          backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)`,
          border: `1px solid color-mix(in srgb, ${color} 25%, transparent)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "16px",
          flexShrink: 0,
        }}
      >
        {session.typeEmoji}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.15rem" }}>
          <span
            style={{
              fontSize: "0.7rem",
              fontWeight: 700,
              padding: "0.1rem 0.4rem",
              borderRadius: "9999px",
              backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)`,
              color,
              flexShrink: 0,
            }}
          >
            {session.typeLabel}
          </span>
          {session.aborted && (
            <span style={{ fontSize: "0.65rem", color: "var(--error)" }}>⚠ aborted</span>
          )}
        </div>
        <div
          style={{
            fontFamily: "monospace",
            fontSize: "0.72rem",
            color: "var(--text-muted)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={session.key}
        >
          {session.key.replace("agent:main:", "")}
        </div>
      </div>

      <div
        style={{ display: "none", flexDirection: "column", alignItems: "flex-end", minWidth: "100px" }}
        className="sm-flex"
        onClick={(e) => e.stopPropagation()}
      >
        <ModelDropdown
          currentModel={session.model}
          sessionKey={session.key}
          onModelChanged={(newModel) => onModelChanged?.(session.id, newModel)}
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", minWidth: "100px" }}>
        <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-primary)" }}>
          {formatTokens(session.totalTokens)}
        </span>
        {contextBar !== null && (
          <div
            style={{
              width: "64px",
              height: "3px",
              borderRadius: "2px",
              backgroundColor: "var(--border)",
              marginTop: "0.25rem",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${contextBar}%`,
                height: "100%",
                borderRadius: "2px",
                backgroundColor:
                  contextBar > 80 ? "var(--error)" : contextBar > 60 ? "var(--warning)" : "var(--success)",
              }}
            />
          </div>
        )}
        <span style={{ fontSize: "0.65rem", color: "var(--text-muted)", marginTop: "0.1rem" }}>
          {contextBar !== null ? `${contextBar}% ctx` : ""}
        </span>
      </div>

      <div style={{ minWidth: "80px", textAlign: "right" }}>
        <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
          {formatDistanceToNow(new Date(session.updatedAt), { addSuffix: true })}
        </span>
      </div>

      <ChevronRight style={{ width: "14px", height: "14px", color: "var(--text-muted)", flexShrink: 0 }} />
    </div>
  );
}

type FilterType = "all" | "main" | "cron" | "subagent" | "direct";

export default function SessionsClient({ initialSessions }: { initialSessions: SessionListItem[] }) {
  const { t } = useI18n();
  const [sessions, setSessions] = useState<SessionListItem[]>(initialSessions);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>("all");
  const [search, setSearch] = useState("");
  const [selectedSession, setSelectedSession] = useState<SessionListItem | null>(null);

  const FILTER_TABS: Array<{ id: FilterType; labelKey: string; emoji: string }> = [
    { id: "all", labelKey: "sessions.all", emoji: "📋" },
    { id: "main", labelKey: "sessions.main", emoji: "🫙" },
    { id: "cron", labelKey: "sessions.cron", emoji: "🕐" },
    { id: "subagent", labelKey: "sessions.subagents", emoji: "🤖" },
    { id: "direct", labelKey: "sessions.chats", emoji: "💬" },
  ];

  const loadSessions = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch("/api/sessions");
      const data = await res.json();
      setSessions(data.sessions || []);
    } catch {
      setError(t("sessions.failedToLoad"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    const interval = setInterval(loadSessions, 30000);
    return () => clearInterval(interval);
  }, [loadSessions]);

  const handleModelChanged = useCallback((sessionId: string, newModel: string) => {
    setSessions((prev) => prev.map((s) => (s.id === sessionId ? { ...s, model: newModel } : s)));
  }, []);

  const filtered = sessions.filter((s) => {
    if (filter !== "all" && s.type !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!s.key.toLowerCase().includes(q) && !s.model.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const counts = sessions.reduce<Record<string, number>>((acc, s) => {
    acc[s.type] = (acc[s.type] || 0) + 1;
    acc.all = (acc.all || 0) + 1;
    return acc;
  }, {});

  const totalTokens = sessions.reduce((sum, s) => sum + s.totalTokens, 0);
  const uniqueModels = [...new Set(sessions.map((s) => s.model))];

  return (
    <>
      <div style={{ padding: "1.5rem 2rem", minHeight: "100vh" }}>
        <div style={{ marginBottom: "1.5rem" }}>
          <h1
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "1.75rem",
              fontWeight: 700,
              color: "var(--text-primary)",
              letterSpacing: "-1px",
              marginBottom: "0.25rem",
            }}
          >
            {t("sessions.title")}
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>{t("sessions.subtitle")}</p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "0.75rem",
            marginBottom: "1.5rem",
          }}
        >
          {[
            {
              labelKey: "sessions.totalSessions",
              value: sessions.length,
              icon: MessageSquare,
              color: "var(--accent)",
            },
            {
              labelKey: "sessions.totalTokens",
              value: formatTokens(totalTokens),
              icon: Hash,
              color: "#60a5fa",
            },
            {
              labelKey: "sessions.cronRuns",
              value: counts.cron || 0,
              icon: Clock,
              color: "#a78bfa",
            },
            {
              labelKey: "sessions.modelsUsed",
              value: uniqueModels.length,
              icon: Bot,
              color: "#4ade80",
            },
          ].map(({ labelKey, value, icon: Icon, color }) => (
            <div
              key={labelKey}
              style={{
                padding: "1rem",
                borderRadius: "0.75rem",
                backgroundColor: "var(--card)",
                border: "1px solid var(--border)",
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
              }}
            >
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "0.5rem",
                  backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Icon style={{ width: "18px", height: "18px", color }} />
              </div>
              <div>
                <div
                  style={{
                    fontSize: "1.25rem",
                    fontWeight: 700,
                    color: "var(--text-primary)",
                    lineHeight: 1.2,
                  }}
                >
                  {value}
                </div>
                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{t(labelKey)}</div>
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            borderRadius: "0.75rem",
            overflow: "hidden",
            backgroundColor: "var(--card)",
            border: "1px solid var(--border)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0.75rem 1rem",
              borderBottom: "1px solid var(--border)",
              gap: "0.75rem",
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap" }}>
              {FILTER_TABS.map((tab) => {
                const count = counts[tab.id] || 0;
                const isActive = filter === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setFilter(tab.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.3rem",
                      padding: "0.35rem 0.75rem",
                      borderRadius: "9999px",
                      fontSize: "0.8rem",
                      fontWeight: isActive ? 700 : 500,
                      backgroundColor: isActive ? "var(--accent)" : "var(--card-elevated)",
                      color: isActive ? "var(--bg, #000)" : "var(--text-secondary)",
                      border: "none",
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                  >
                    <span>{tab.emoji}</span>
                    <span>{t(tab.labelKey)}</span>
                    {count > 0 && (
                      <span
                        style={{
                          backgroundColor: isActive ? "rgba(0,0,0,0.2)" : "var(--border)",
                          borderRadius: "9999px",
                          padding: "0 0.4rem",
                          fontSize: "0.7rem",
                        }}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  padding: "0.375rem 0.75rem",
                  borderRadius: "0.5rem",
                  backgroundColor: "var(--card-elevated)",
                  border: "1px solid var(--border)",
                }}
              >
                <Search style={{ width: "13px", height: "13px", color: "var(--text-muted)" }} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter sessions..."
                  style={{
                    background: "none",
                    border: "none",
                    outline: "none",
                    color: "var(--text-primary)",
                    fontSize: "0.8rem",
                    width: "160px",
                  }}
                />
              </div>
              <button
                onClick={() => {
                  setLoading(true);
                  loadSessions();
                }}
                style={{
                  padding: "0.375rem",
                  borderRadius: "0.5rem",
                  background: "var(--card-elevated)",
                  border: "1px solid var(--border)",
                  cursor: "pointer",
                  color: "var(--text-muted)",
                  display: "flex",
                  alignItems: "center",
                }}
                title="Refresh"
              >
                <RefreshCw style={{ width: "14px", height: "14px" }} />
              </button>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              padding: "0.5rem 1rem",
              borderBottom: "1px solid var(--border)",
              backgroundColor: "var(--card-elevated)",
            }}
          >
            <div style={{ width: "32px", flexShrink: 0 }} />
            <div
              style={{
                flex: 1,
                fontSize: "0.7rem",
                fontWeight: 700,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Session
            </div>
            <div
              style={{
                minWidth: "100px",
                textAlign: "right",
                fontSize: "0.7rem",
                fontWeight: 700,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Tokens / ctx
            </div>
            <div
              style={{
                minWidth: "80px",
                textAlign: "right",
                fontSize: "0.7rem",
                fontWeight: 700,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Updated
            </div>
            <div style={{ width: "14px", flexShrink: 0 }} />
          </div>

          {loading && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "3rem",
                gap: "0.75rem",
                color: "var(--text-muted)",
              }}
            >
              <div
                style={{
                  width: "20px",
                  height: "20px",
                  border: "2px solid var(--accent)",
                  borderTopColor: "transparent",
                  borderRadius: "50%",
                  animation: "spin 0.8s linear infinite",
                }}
              />
              Loading sessions...
            </div>
          )}

          {!loading && error && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "1.5rem",
                color: "var(--error)",
              }}
            >
              <AlertTriangle style={{ width: "16px", height: "16px" }} />
              {error}
            </div>
          )}

          {!loading && !error && filtered.length === 0 && (
            <div
              style={{
                textAlign: "center",
                padding: "3rem",
                color: "var(--text-muted)",
              }}
            >
              <MessageSquare style={{ width: "40px", height: "40px", margin: "0 auto 0.75rem", opacity: 0.3 }} />
              <p>No sessions match your filter</p>
            </div>
          )}

          {!loading &&
            !error &&
            filtered.map((session) => (
              <SessionRow
                key={session.id}
                session={session}
                onClick={() => setSelectedSession(session)}
                onModelChanged={handleModelChanged}
              />
            ))}
        </div>
      </div>

      {selectedSession && (
        <SessionDetail session={selectedSession} onClose={() => setSelectedSession(null)} />
      )}

      <style jsx global>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </>
  );
}

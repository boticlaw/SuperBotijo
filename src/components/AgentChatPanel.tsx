"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Bot, Loader2, Plus, SendHorizonal, User } from "lucide-react";

import { useToast } from "@/components/Toast";
import { useI18n } from "@/i18n/provider";

interface AgentOption {
  id: string;
  name: string;
}

interface SessionOption {
  key: string;
  label: string;
  updatedAt: number;
}

interface MessageItem {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  timestamp: string;
}

const TECHNICAL_METADATA_PATTERN = /sender\s*\(untrusted metadata\):/i;

function isTechnicalMessage(message: MessageItem): boolean {
  if (message.role === "system" || message.role === "tool") {
    return true;
  }

  if (message.role !== "user" && TECHNICAL_METADATA_PATTERN.test(message.content)) {
    return true;
  }

  return false;
}

interface ChatSnapshot {
  readOnly: boolean;
  gateway: {
    available: boolean;
    error: string | null;
  };
  session: SessionOption | null;
  sessions: SessionOption[];
  messages: MessageItem[];
}

interface ErrorResponsePayload {
  code?: string;
  details?: string;
  message?: string;
  error?: string;
}

async function getErrorMessage(response: Response): Promise<string | null> {
  const body = (await response.text()).trim();
  if (!body) {
    return null;
  }

  try {
    const parsed = JSON.parse(body) as ErrorResponsePayload;
    const message = typeof parsed.message === "string" && parsed.message.trim().length > 0
      ? parsed.message.trim()
      : typeof parsed.error === "string" && parsed.error.trim().length > 0
        ? parsed.error.trim()
        : null;
    const diagnostics: string[] = [];

    if (typeof parsed.code === "string" && parsed.code.trim().length > 0) {
      diagnostics.push(parsed.code.trim());
    }

    if (typeof parsed.details === "string" && parsed.details.trim().length > 0) {
      diagnostics.push(parsed.details.trim());
    }

    if (message) {
      return diagnostics.length > 0 ? `${message} (${diagnostics.join(" | ")})` : message;
    }

    if (diagnostics.length > 0) {
      return diagnostics.join(" | ");
    }

    return null;
  } catch {
    if (body.startsWith("<!DOCTYPE") || body.startsWith("<html")) {
      return null;
    }
    return body.slice(0, 180);
  }
}

function mapGatewayScopeError(message: string, t: (key: string) => string): string {
  if (/missing scope:\s*operator\.write/i.test(message)) {
    return t("chat.errors.missingWriteScope");
  }

  return message;
}

function formatSessionLabel(session: SessionOption): string {
  return `${session.label} (${new Date(session.updatedAt).toLocaleString()})`;
}

export function AgentChatPanel() {
  const { t, formatDateTime } = useI18n();
  const { showError, showInfo } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [agentId, setAgentId] = useState("");
  const [sessionKey, setSessionKey] = useState("");
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [sessions, setSessions] = useState<SessionOption[]>([]);
  const [readOnly, setReadOnly] = useState(false);
  const [gatewayError, setGatewayError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [assistantDraft, setAssistantDraft] = useState("");
  const [input, setInput] = useState("");
  const appliedUrlParamsRef = useRef(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const loadAgents = async () => {
      try {
        const response = await fetch("/api/openclaw/agents");
        const data = (await response.json()) as { agents?: AgentOption[] };
        const nextAgents = data.agents ?? [];
        setAgents(nextAgents);
        setAgentId((current) => {
          if (current && nextAgents.some((agent) => agent.id === current)) {
            return current;
          }
          return nextAgents[0]?.id ?? "";
        });
      } catch {
        showError(t("chat.toasts.loadFailedTitle"), t("chat.toasts.loadAgentsFailed"));
      }
    };

    void loadAgents();
  }, [showError, t]);

  useEffect(() => {
    const rawParams = searchParams.toString();
    if (!rawParams) {
      return;
    }

    if (!appliedUrlParamsRef.current) {
      const urlAgentId = searchParams.get("agentId") ?? searchParams.get("agent");
      const urlSessionKey = searchParams.get("sessionKey");
      if (urlAgentId) {
        setAgentId(urlAgentId);
      }
      if (urlSessionKey) {
        setSessionKey(urlSessionKey);
      }
      appliedUrlParamsRef.current = true;
    }

    router.replace("/chat");
  }, [router, searchParams]);

  useEffect(() => {
    const loadSnapshot = async () => {
      if (!agentId) {
        return;
      }

      setLoading(true);
      try {
        const query = sessionKey ? `?sessionKey=${encodeURIComponent(sessionKey)}` : "";
        const response = await fetch(`/api/chat/agents/${encodeURIComponent(agentId)}${query}`);
        const data = (await response.json()) as ChatSnapshot;

        setMessages(data.messages ?? []);
        setSessions(data.sessions ?? []);
        setReadOnly(Boolean(data.readOnly));
        setGatewayError(data.gateway?.error ? mapGatewayScopeError(data.gateway.error, t) : null);

        if (data.session?.key) {
          setSessionKey(data.session.key);
        }
      } catch {
        showError(t("chat.toasts.loadFailedTitle"), t("chat.toasts.loadHistoryFailed"));
      } finally {
        setLoading(false);
      }
    };

    void loadSnapshot();
  }, [agentId, sessionKey, showError, t]);

  useEffect(() => {
    if (!listRef.current) {
      return;
    }

    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [assistantDraft, messages]);

  const canSend = useMemo(() => {
    return !readOnly && !sending && input.trim().length > 0;
  }, [input, readOnly, sending]);

  const timelineMessages = useMemo(() => {
    return messages.filter((message) => !isTechnicalMessage(message));
  }, [messages]);

  const technicalMessages = useMemo(() => {
    return messages.filter((message) => isTechnicalMessage(message));
  }, [messages]);

  const handleSend = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSend || !agentId || !sessionKey) {
      return;
    }

    const outgoing = input.trim();
    setInput("");
    setSending(true);
    setAssistantDraft("");
    setMessages((prev) => [
      ...prev,
      {
        id: `local-user-${Date.now()}`,
        role: "user",
        content: outgoing,
        timestamp: new Date().toISOString(),
      },
    ]);

    try {
      const response = await fetch(`/api/chat/agents/${encodeURIComponent(agentId)}/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({ message: outgoing, sessionKey }),
      });

      if (!response.ok) {
        const message = await getErrorMessage(response);
        throw new Error(message ?? `${t("chat.errors.sendFailed")} [HTTP ${response.status}]`);
      }

      const contentType = response.headers.get("Content-Type") ?? "";
      if (!contentType.includes("text/event-stream")) {
        const message = await getErrorMessage(response);
        throw new Error(message ?? `${t("chat.errors.unexpectedResponse")} [HTTP ${response.status}]`);
      }

      if (!response.body) {
        throw new Error(t("chat.errors.unexpectedResponse"));
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";

        for (const chunk of chunks) {
          const dataLines = chunk
            .split("\n")
            .filter((line) => line.startsWith("data:"))
            .map((line) => line.slice(5).trimStart());

          if (dataLines.length === 0) {
            continue;
          }

          let payload: {
            type: string;
            text?: string;
            message?: string;
            history?: MessageItem[];
          };

          try {
            payload = JSON.parse(dataLines.join("\n")) as {
              type: string;
              text?: string;
              message?: string;
              history?: MessageItem[];
            };
          } catch {
            throw new Error(t("chat.errors.streamFailed"));
          }

          if (payload.type === "assistant_delta") {
            setAssistantDraft((prev) => prev + (payload.text ?? ""));
          }

          if (payload.type === "assistant_final") {
            setAssistantDraft(payload.text ?? "");
          }

          if (payload.type === "error") {
            throw new Error(payload.message ?? t("chat.errors.streamFailed"));
          }

          if (payload.type === "done") {
            setMessages(payload.history ?? []);
            setAssistantDraft("");
          }
        }
      }
    } catch (error) {
      const resolvedMessage = error instanceof Error
        ? mapGatewayScopeError(error.message, t)
        : t("chat.errors.sendFailed");
      showError(
        t("chat.toasts.sendFailedTitle"),
        resolvedMessage,
      );
      setAssistantDraft("");
    } finally {
      setSending(false);
    }
  };

  const handleReadOnlyClick = () => {
    showInfo(t("chat.toasts.readOnlyTitle"), t("chat.toasts.readOnlyDescription"));
  };

  const handleNewSession = () => {
    if (!agentId) return;
    const newKey = `agent:${agentId}:dashboard:${crypto.randomUUID()}`;
    setSessionKey(newKey);
    setMessages([]);
  };

  return (
    <div className="rounded-xl border" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
      <div className="flex flex-col gap-3 border-b p-4 md:flex-row md:items-center" style={{ borderColor: "var(--border)" }}>
        <label className="flex flex-col gap-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          {t("chat.agent")}
          <select
            className="rounded-md px-3 py-2"
            style={{ backgroundColor: "var(--card-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            value={agentId}
            onChange={(event) => {
              setSessionKey("");
              setAgentId(event.target.value);
            }}
          >
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name ?? agent.id}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-1 flex-col gap-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          {t("chat.session")}
          <div className="flex gap-2">
            <select
              className="flex-1 rounded-md px-3 py-2"
              style={{ backgroundColor: "var(--card-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
              value={sessionKey}
              onChange={(event) => setSessionKey(event.target.value)}
            >
              {sessions.map((session) => (
                <option key={session.key} value={session.key}>
                  {formatSessionLabel(session)}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleNewSession}
              className="inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium transition-colors"
              style={{
                backgroundColor: "var(--card-elevated)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
              }}
              title={t("chat.newSession")}
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </label>
      </div>

      {readOnly && (
        <button
          type="button"
          onClick={handleReadOnlyClick}
          className="flex w-full items-center gap-2 border-b px-4 py-3 text-left"
          style={{
            borderColor: "var(--border)",
            backgroundColor: "rgba(245, 158, 11, 0.12)",
            color: "var(--text-primary)",
          }}
        >
          <AlertTriangle className="h-4 w-4" style={{ color: "var(--warning)" }} />
          <span className="text-sm font-medium">{t("chat.readOnlyTitle")}</span>
          {gatewayError ? (
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              {gatewayError}
            </span>
          ) : null}
        </button>
      )}

      <div ref={listRef} className="h-[52vh] overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center gap-2 px-1 text-sm" style={{ color: "var(--text-muted)" }}>
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("chat.loading")}
          </div>
        ) : (
          <>
            {timelineMessages.length === 0 ? (
              <div className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--border)", color: "var(--text-muted)", backgroundColor: "var(--card-elevated)" }}>
                {t("chat.empty")}
              </div>
            ) : null}

            {timelineMessages.map((message) => {
              const isUser = message.role === "user";
              return (
                <div key={message.id} className={`mb-4 flex ${isUser ? "justify-end" : "justify-start"}`}>
                  <div
                    className="max-w-[88%] rounded-2xl border px-3 py-2.5 text-sm leading-relaxed md:max-w-[80%]"
                    style={{
                      borderColor: "var(--border)",
                      backgroundColor: isUser ? "color-mix(in srgb, var(--accent) 22%, var(--card))" : "var(--card-elevated)",
                      color: "var(--text-primary)",
                    }}
                  >
                    <div className="mb-1.5 flex items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
                      {isUser ? <User className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
                      {isUser ? t("chat.you") : t("chat.assistant")}
                      <span aria-hidden>•</span>
                      <time>{formatDateTime(message.timestamp)}</time>
                    </div>
                    <div className="whitespace-pre-wrap break-words">{message.content}</div>
                  </div>
                </div>
              );
            })}

            {sending && !assistantDraft ? (
              <div className="mb-3 flex items-center gap-2 px-1 text-xs" style={{ color: "var(--text-muted)" }}>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {t("chat.assistantThinking")}
              </div>
            ) : null}

            {assistantDraft ? (
              <div className="mb-3 flex justify-start">
                <div
                  className="max-w-[88%] rounded-2xl border px-3 py-2.5 text-sm leading-relaxed md:max-w-[80%]"
                  style={{
                    borderColor: "var(--border)",
                    backgroundColor: "var(--card-elevated)",
                    color: "var(--text-primary)",
                  }}
                >
                  <div className="mb-1.5 flex items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
                    <Bot className="h-3 w-3" />
                    {t("chat.assistant")} · {t("chat.streaming")}
                  </div>
                  <div className="whitespace-pre-wrap break-words">{assistantDraft}</div>
                </div>
              </div>
            ) : null}

            {technicalMessages.length > 0 ? (
              <details className="mt-2 rounded-lg border px-3 py-2" style={{ borderColor: "var(--border)", backgroundColor: "var(--card-elevated)" }}>
                <summary className="cursor-pointer text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                  {t("chat.technicalSummary", { count: technicalMessages.length })}
                </summary>
                <div className="mt-2 space-y-2">
                  {technicalMessages.map((message) => (
                    <div key={`technical-${message.id}`} className="rounded-md border px-2.5 py-2 text-xs" style={{ borderColor: "var(--border)", color: "var(--text-muted)", backgroundColor: "var(--card)" }}>
                      <div className="mb-1 flex items-center gap-2">
                        <span className="font-medium" style={{ color: "var(--text-secondary)" }}>
                          {message.role === "system" ? t("chat.roles.system") : t("chat.roles.tool")}
                        </span>
                        <span aria-hidden>•</span>
                        <time>{formatDateTime(message.timestamp)}</time>
                      </div>
                      <div className="whitespace-pre-wrap break-words">{message.content}</div>
                    </div>
                  ))}
                </div>
              </details>
            ) : null}
          </>
        )}
      </div>

      <form onSubmit={handleSend} className="border-t p-4" style={{ borderColor: "var(--border)" }}>
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            className="min-h-[44px] flex-1 resize-y rounded-md px-3 py-2 text-sm"
            style={{
              backgroundColor: "var(--card-elevated)",
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
            }}
            disabled={readOnly || sending}
            placeholder={readOnly ? t("chat.readOnlyPlaceholder") : t("chat.placeholder")}
          />
          <button
            type="submit"
            disabled={!canSend}
            className="inline-flex h-11 items-center justify-center rounded-md px-4 text-sm font-semibold"
            style={{
              backgroundColor: canSend ? "var(--accent)" : "var(--card-elevated)",
              color: canSend ? "var(--text-primary)" : "var(--text-muted)",
              border: "1px solid var(--border)",
            }}
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizonal className="h-4 w-4" />}
          </button>
        </div>
      </form>
    </div>
  );
}

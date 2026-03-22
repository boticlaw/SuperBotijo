import { safeExecFile } from "@/lib/safe-exec";

const OPENCLAW_DIR = process.env.OPENCLAW_DIR || "/home/daniel/.openclaw";

interface RawSession {
  key: string;
  kind: string;
  updatedAt: number;
  ageMs: number;
  sessionId?: string;
  systemSent?: boolean;
  abortedLastRun?: boolean;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  totalTokensFresh?: boolean;
  model?: string;
  modelProvider?: string;
  contextTokens?: number;
}

export interface SessionListItem {
  id: string;
  key: string;
  type: "main" | "cron" | "subagent" | "direct" | "unknown";
  typeLabel: string;
  typeEmoji: string;
  sessionId: string | null;
  cronJobId?: string;
  subagentId?: string;
  updatedAt: number;
  ageMs: number;
  model: string;
  modelProvider: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  contextTokens: number;
  contextUsedPercent: number | null;
  aborted: boolean;
}

function parseSessionKey(key: string): {
  type: "main" | "cron" | "subagent" | "direct" | "unknown";
  typeLabel: string;
  typeEmoji: string;
  cronJobId?: string;
  subagentId?: string;
  isRunEntry: boolean;
} {
  const parts = key.split(":");

  if (parts.includes("run")) {
    return { type: "unknown", typeLabel: "Run Entry", typeEmoji: "🔁", isRunEntry: true };
  }

  if (parts[2] === "main") {
    return { type: "main", typeLabel: "Main Session", typeEmoji: "🫙", isRunEntry: false };
  }

  if (parts[2] === "cron") {
    return {
      type: "cron",
      typeLabel: "Cron Job",
      typeEmoji: "🕐",
      cronJobId: parts[3],
      isRunEntry: false,
    };
  }

  if (parts[2] === "subagent") {
    return {
      type: "subagent",
      typeLabel: "Sub-agent",
      typeEmoji: "🤖",
      subagentId: parts[3],
      isRunEntry: false,
    };
  }

  return {
    type: "direct",
    typeLabel: parts[2] ? `${parts[2].charAt(0).toUpperCase() + parts[2].slice(1)} Chat` : "Direct Chat",
    typeEmoji: "💬",
    isRunEntry: false,
  };
}

export async function getSessionsList(): Promise<SessionListItem[]> {
  try {
    const result = safeExecFile("openclaw", ["sessions", "--json"], {
      timeout: 10000,
    });

    if (result.status !== 0 || !result.stdout) {
      return [];
    }

    const data = JSON.parse(result.stdout);
    const rawSessions: RawSession[] = data.sessions || [];

    const sessions: SessionListItem[] = rawSessions.reduce<SessionListItem[]>((acc, raw) => {
      const parsed = parseSessionKey(raw.key);

      if (parsed.isRunEntry || parsed.type === "unknown") return acc;

      const totalTokens = raw.totalTokens || 0;
      const contextTokens = raw.contextTokens || 0;
      const contextUsedPercent =
        contextTokens > 0 && raw.totalTokensFresh
          ? Math.round((totalTokens / contextTokens) * 100)
          : null;

      acc.push({
        id: raw.key,
        key: raw.key,
        type: parsed.type,
        typeLabel: parsed.typeLabel,
        typeEmoji: parsed.typeEmoji,
        sessionId: raw.sessionId || null,
        cronJobId: parsed.cronJobId,
        subagentId: parsed.subagentId,
        updatedAt: raw.updatedAt,
        ageMs: raw.ageMs,
        model: raw.model || "unknown",
        modelProvider: raw.modelProvider || "anthropic",
        inputTokens: raw.inputTokens || 0,
        outputTokens: raw.outputTokens || 0,
        totalTokens,
        contextTokens,
        contextUsedPercent,
        aborted: raw.abortedLastRun || false,
      });
      return acc;
    }, []);

    sessions.sort((a, b) => b.updatedAt - a.updatedAt);

    return sessions;
  } catch (error) {
    console.error("[sessions-list-ops] Error listing sessions:", error);
    return [];
  }
}

interface JsonlLine {
  type: string;
  id?: string;
  timestamp?: string;
  message?: {
    role: string;
    content: string | Array<{ type: string; text?: string; name?: string; input?: unknown; id?: string }>;
    timestamp?: number;
  };
  provider?: string;
  modelId?: string;
  customType?: string;
  data?: unknown;
}

export interface SessionMessage {
  id: string;
  type: "user" | "assistant" | "tool_use" | "tool_result" | "model_change" | "system";
  role?: string;
  content: string;
  timestamp: string;
  model?: string;
  toolName?: string;
}

import { readFileSync, existsSync } from "fs";
import { join } from "path";

export function getSessionMessages(sessionId: string): SessionMessage[] {
  if (!/^[a-f0-9-]{36}$/.test(sessionId)) {
    return [];
  }

  const sessionsDir = join(OPENCLAW_DIR, "agents", "main", "sessions");
  const filePath = join(sessionsDir, `${sessionId}.jsonl`);

  if (!existsSync(filePath)) {
    return [];
  }

  try {
    const raw = readFileSync(filePath, "utf-8");
    const lines = raw.trim().split("\n").filter(Boolean);

    const messages: SessionMessage[] = [];
    let currentModel = "";

    for (const line of lines) {
      try {
        const obj: JsonlLine = JSON.parse(line);

        if (obj.type === "model_change" && obj.modelId) {
          currentModel = obj.modelId;
        }

        if (obj.type !== "message" || !obj.message) continue;

        const msg = obj.message;
        const role = msg.role;
        const timestamp = obj.timestamp || new Date().toISOString();

        if (typeof msg.content === "string") {
          messages.push({
            id: obj.id || Math.random().toString(),
            type: role === "user" ? "user" : "assistant",
            role,
            content: msg.content,
            timestamp,
            model: currentModel || undefined,
          });
        } else if (Array.isArray(msg.content)) {
          for (const block of msg.content) {
            if (block.type === "text" && block.text) {
              messages.push({
                id: (obj.id || "") + "-text",
                type: role === "user" ? "user" : "assistant",
                role,
                content: block.text,
                timestamp,
                model: currentModel || undefined,
              });
            } else if (block.type === "tool_use" && block.name) {
              messages.push({
                id: block.id || (obj.id || "") + "-tool",
                type: "tool_use",
                role,
                content: `${block.name}(${block.input ? JSON.stringify(block.input).slice(0, 200) : ""})`,
                timestamp,
                toolName: block.name,
                model: currentModel || undefined,
              });
            } else if (block.type === "tool_result") {
              const resultContent = Array.isArray(block.text)
                ? (block.text as Array<{ type: string; text?: string }>).map((b) => b.text || "").join("\n")
                : (block.text as string) || "";
              messages.push({
                id: (obj.id || "") + "-result",
                type: "tool_result",
                role,
                content: resultContent.slice(0, 500),
                timestamp,
                model: currentModel || undefined,
              });
            }
          }
        }
      } catch {
        // Skip malformed lines
      }
    }

    return messages;
  } catch (error) {
    console.error("[sessions-list-ops] Error reading session file:", error);
    return [];
  }
}

import "server-only";

import fs from "fs";
import path from "path";

import { OPENCLAW_DIR } from "@/lib/paths";
import type { ChatSessionEntry } from "@/lib/openclaw-chat-types";

interface RawSessionRecord {
  sessionId?: string;
  updatedAt?: number;
  label?: string;
  channel?: string;
  chatType?: string;
}

export interface ChatSessionStore {
  sessionsPath: string;
  sessionsDir: string;
  records: Record<string, RawSessionRecord>;
}

export function getAgentSessionsDir(agentId: string): string {
  return path.join(OPENCLAW_DIR, "agents", agentId, "sessions");
}

export function readAgentSessionStore(agentId: string): ChatSessionStore {
  const sessionsDir = getAgentSessionsDir(agentId);
  const sessionsPath = path.join(sessionsDir, "sessions.json");

  if (!fs.existsSync(sessionsPath)) {
    return { sessionsPath, sessionsDir, records: {} };
  }

  try {
    const raw = fs.readFileSync(sessionsPath, "utf-8");
    const parsed = JSON.parse(raw) as Record<string, RawSessionRecord>;
    return {
      sessionsPath,
      sessionsDir,
      records: parsed,
    };
  } catch (error) {
    console.error("[openclaw-chat-sessions] Failed to parse sessions.json", error);
    return { sessionsPath, sessionsDir, records: {} };
  }
}

export function listAgentSessions(agentId: string): ChatSessionEntry[] {
  const store = readAgentSessionStore(agentId);
  const baseMainKey = `agent:${agentId}:main`;
  const sessions: ChatSessionEntry[] = [];

  for (const [key, value] of Object.entries(store.records)) {
    const sessionId = typeof value.sessionId === "string" ? value.sessionId : "";
    if (!sessionId) {
      continue;
    }

    const updatedAt = typeof value.updatedAt === "number" ? value.updatedAt : 0;
    sessions.push({
      key,
      sessionId,
      updatedAt,
      label: value.label ?? key,
      channel: value.channel,
      chatType: value.chatType,
      isMain: key === baseMainKey,
    });
  }

  sessions.sort((a, b) => b.updatedAt - a.updatedAt);
  return sessions;
}

export function resolveCanonicalSession(agentId: string): ChatSessionEntry | null {
  const sessions = listAgentSessions(agentId);
  if (sessions.length === 0) {
    return null;
  }

  const mainSession = sessions.find((entry) => entry.isMain);
  if (mainSession) {
    return mainSession;
  }

  return sessions[0] ?? null;
}

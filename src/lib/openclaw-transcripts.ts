import "server-only";

import fs from "fs";
import path from "path";

import type { ChatMessageEntry, ChatRole, ChatSessionEntry } from "@/lib/openclaw-chat-types";
import { getAgentSessionsDir, readAgentSessionStore } from "@/lib/openclaw-chat-sessions";

interface TranscriptEnvelope {
  type?: string;
  id?: string;
  timestamp?: string;
  message?: {
    role?: string;
    content?: unknown;
    toolName?: string;
  };
}

function normalizeRole(input: string | undefined): ChatRole {
  if (input === "user") {
    return "user";
  }

  if (input === "assistant") {
    return "assistant";
  }

  if (input === "toolResult" || input === "toolCall") {
    return "tool";
  }

  return "system";
}

function cleanMessageContent(text: string): string {
  return text.replace(/Sender\s*\([^)]*\):[^\n]*\n*/ig, "").trim();
}

function extractBlocksText(content: unknown): string {
  if (typeof content === "string") {
    return cleanMessageContent(content);
  }

  if (!Array.isArray(content)) {
    return "";
  }

  const chunks: string[] = [];
  for (const block of content) {
    if (!block || typeof block !== "object") {
      continue;
    }

    const typedBlock = block as { type?: string; text?: unknown; name?: unknown };
    if (typeof typedBlock.text === "string") {
      chunks.push(typedBlock.text);
      continue;
    }

    if (typedBlock.type === "toolCall" && typeof typedBlock.name === "string") {
      chunks.push(`[tool:${typedBlock.name}]`);
    }
  }

  return cleanMessageContent(chunks.join("\n"));
}

function resolveSessionFile(agentId: string, session: ChatSessionEntry): string {
  const store = readAgentSessionStore(agentId);
  const record = store.records[session.key];
  const explicitPath = (record as { sessionFile?: string } | undefined)?.sessionFile;
  if (typeof explicitPath === "string" && explicitPath.length > 0) {
    return explicitPath;
  }

  return path.join(getAgentSessionsDir(agentId), `${session.sessionId}.jsonl`);
}

export function readTranscriptMessages(agentId: string, session: ChatSessionEntry): ChatMessageEntry[] {
  const filePath = resolveSessionFile(agentId, session);
  if (!fs.existsSync(filePath)) {
    return [];
  }

  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const lines = raw.split("\n");
    const messages: ChatMessageEntry[] = [];

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index]?.trim();
      if (!line) {
        continue;
      }

      let parsed: TranscriptEnvelope;
      try {
        parsed = JSON.parse(line) as TranscriptEnvelope;
      } catch {
        continue;
      }

      if (parsed.type !== "message" || !parsed.message) {
        continue;
      }

      const role = normalizeRole(parsed.message.role);
      const content = extractBlocksText(parsed.message.content);
      if (!content) {
        continue;
      }

      messages.push({
        id: parsed.id ?? `${session.sessionId}-${index}`,
        role,
        content,
        timestamp: parsed.timestamp ?? new Date(0).toISOString(),
        toolName: parsed.message.toolName,
      });
    }

    return messages;
  } catch (error) {
    console.error("[openclaw-transcripts] Failed to read transcript", error);
    return [];
  }
}

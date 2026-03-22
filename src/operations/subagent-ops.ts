/**
 * Subagents Operations
 * Server-side data fetching for subagents dashboard
 */
import { safeExecFile } from "@/lib/safe-exec";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const ACTIVITIES_DB = path.join(process.cwd(), "data", "activities.db");

export interface SubagentInfo {
  id: string;
  parentId: string;
  parentName: string;
  sessionKey: string;
  task: string;
  model: string;
  tokens: number;
  inputTokens: number;
  outputTokens: number;
  startedAt: string;
  ageMs: number;
  status: "active" | "idle" | "completed" | "failed";
  duration?: number;
}

export interface TimelineEvent {
  id: string;
  type: "spawned" | "completed" | "failed";
  timestamp: string;
  task: string;
  model: string;
  duration?: number;
}

export interface SubagentMetrics {
  total: number;
  active: number;
  idle: number;
  successRate: number;
  totalTokens: number;
  avgTokens: number;
}

export interface SubagentsData {
  subagents: SubagentInfo[];
  timeline: TimelineEvent[];
  metrics: SubagentMetrics;
  timestamp: string;
}

interface RawSession {
  key: string;
  kind: string;
  updatedAt: number;
  ageMs: number;
  sessionId?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  model?: string;
}

function parseSubagentKey(key: string): { parentId: string; subagentId: string } | null {
  const parts = key.split(":");
  if (parts.length < 4 || parts[2] !== "subagent") return null;
  return {
    parentId: parts[1],
    subagentId: parts[3],
  };
}

function getTimelineEvents(): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  if (!fs.existsSync(ACTIVITIES_DB)) {
    return events;
  }

  const db = new Database(ACTIVITIES_DB, { readonly: true });

  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const rows = db.prepare(`
      SELECT 
        id,
        type,
        description,
        status,
        timestamp,
        duration_ms,
        metadata
      FROM activities
      WHERE 
        timestamp >= ? 
        AND type = 'agent_action'
        AND description LIKE '%subagent%'
      ORDER BY timestamp DESC
      LIMIT 50
    `).all(cutoff) as Array<{
      id: string;
      type: string;
      description: string;
      status: string;
      timestamp: string;
      duration_ms: number | null;
      metadata: string | null;
    }>;

    for (const row of rows) {
      const metadata = row.metadata ? JSON.parse(row.metadata) : {};
      
      events.push({
        id: row.id,
        type: row.status === "success" ? "completed" : 
              row.status === "error" ? "failed" : "spawned",
        timestamp: row.timestamp,
        task: metadata.task || row.description.slice(0, 40),
        model: metadata.model || "unknown",
        duration: row.duration_ms || undefined,
      });
    }

    return events;
  } finally {
    db.close();
  }
}

function getMetrics(subagents: SubagentInfo[]): SubagentMetrics {
  const active = subagents.filter(s => s.status === "active").length;
  const idle = subagents.filter(s => s.status === "idle").length;
  const totalTokens = subagents.reduce((sum, s) => sum + s.tokens, 0);
  const avgTokens = subagents.length > 0 ? totalTokens / subagents.length : 0;

  let successRate = 100;
  if (fs.existsSync(ACTIVITIES_DB)) {
    const db = new Database(ACTIVITIES_DB, { readonly: true });
    try {
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const stats = db.prepare(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success
        FROM activities
        WHERE timestamp >= ? AND type = 'agent_action'
      `).get(cutoff) as { total: number; success: number };

      successRate = stats.total > 0 ? (stats.success / stats.total) * 100 : 100;
    } finally {
      db.close();
    }
  }

  return {
    total: subagents.length,
    active,
    idle,
    successRate: Math.round(successRate * 10) / 10,
    totalTokens,
    avgTokens: Math.round(avgTokens),
  };
}

export function getSubagentsData(): SubagentsData {
  try {
    const result = safeExecFile("openclaw", ["sessions", "--json"], {
      timeout: 10000,
    });

    if (result.status !== 0 || !result.stdout) {
      return {
        subagents: [],
        timeline: [],
        metrics: {
          total: 0,
          active: 0,
          idle: 0,
          successRate: 100,
          totalTokens: 0,
          avgTokens: 0,
        },
        timestamp: new Date().toISOString(),
      };
    }

    const data = JSON.parse(result.stdout);
    const rawSessions: RawSession[] = data.sessions || [];

    const subagents: SubagentInfo[] = [];

    for (const session of rawSessions) {
      const parsed = parseSubagentKey(session.key);
      if (!parsed) continue;

      const isActive = session.ageMs < 2 * 60 * 1000;
      
      const task = parsed.subagentId
        .replace(/-/g, " ")
        .replace(/\b\w/g, c => c.toUpperCase())
        .slice(0, 40);

      subagents.push({
        id: parsed.subagentId,
        parentId: parsed.parentId,
        parentName: parsed.parentId === "main" ? "SuperBotijo" : parsed.parentId,
        sessionKey: session.key,
        task: task || "Working...",
        model: session.model || "unknown",
        tokens: session.totalTokens || 0,
        inputTokens: session.inputTokens || 0,
        outputTokens: session.outputTokens || 0,
        startedAt: new Date(session.updatedAt - session.ageMs).toISOString(),
        ageMs: session.ageMs,
        status: isActive ? "active" : "idle",
      });
    }

    subagents.sort((a, b) => a.ageMs - b.ageMs);

    const timeline = getTimelineEvents();
    const metrics = getMetrics(subagents);

    return {
      subagents,
      timeline,
      metrics,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error("[subagents-ops] Error:", error);
    return {
      subagents: [],
      timeline: [],
      metrics: {
        total: 0,
        active: 0,
        idle: 0,
        successRate: 100,
        totalTokens: 0,
        avgTokens: 0,
      },
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * SQLite-backed Agent Configuration Store
 * Persists agent runtime configs (model, temperature, etc.)
 */
import "server-only";

import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_PATH = process.env.SUPERBOTIJO_CONFIG_DB_PATH || path.join(process.cwd(), "data", "agent-configs.db");

export interface AgentConfig {
  agentId: string;
  model: string;
  temperature: number;
  maxTokens: number;
  heartbeatInterval: number;
  autoStart: boolean;
  logLevel: "debug" | "info" | "warn" | "error";
  skills: string[];
  updatedAt: string;
}

export interface AgentConfigInput {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  heartbeatInterval?: number;
  autoStart?: boolean;
  logLevel?: "debug" | "info" | "warn" | "error";
  skills?: string[];
}

export const DEFAULT_CONFIG: Omit<AgentConfig, "agentId" | "updatedAt"> = {
  model: "claude-sonnet-4-20250514",
  temperature: 0.7,
  maxTokens: 4096,
  heartbeatInterval: 30,
  autoStart: true,
  logLevel: "info",
  skills: [],
};

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (_db) return _db;

  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  _db.pragma("synchronous = NORMAL");

  _db.exec(`
    CREATE TABLE IF NOT EXISTS agent_configs (
      agent_id TEXT PRIMARY KEY,
      model TEXT NOT NULL DEFAULT '${DEFAULT_CONFIG.model}',
      temperature REAL NOT NULL DEFAULT ${DEFAULT_CONFIG.temperature},
      max_tokens INTEGER NOT NULL DEFAULT ${DEFAULT_CONFIG.maxTokens},
      heartbeat_interval INTEGER NOT NULL DEFAULT ${DEFAULT_CONFIG.heartbeatInterval},
      auto_start INTEGER NOT NULL DEFAULT ${DEFAULT_CONFIG.autoStart ? 1 : 0},
      log_level TEXT NOT NULL DEFAULT '${DEFAULT_CONFIG.logLevel}',
      skills TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_agent_configs_updated ON agent_configs(updated_at);
  `);

  return _db;
}

export function getAgentConfig(agentId: string): AgentConfig | null {
  const db = getDb();
  const row = db.prepare(`
    SELECT agent_id, model, temperature, max_tokens, heartbeat_interval, auto_start, log_level, skills, updated_at
    FROM agent_configs WHERE agent_id = ?
  `).get(agentId) as {
    agent_id: string;
    model: string;
    temperature: number;
    max_tokens: number;
    heartbeat_interval: number;
    auto_start: number;
    log_level: string;
    skills: string;
    updated_at: string;
  } | undefined;

  if (!row) return null;

  return {
    agentId: row.agent_id,
    model: row.model,
    temperature: row.temperature,
    maxTokens: row.max_tokens,
    heartbeatInterval: row.heartbeat_interval,
    autoStart: row.auto_start === 1,
    logLevel: row.log_level as AgentConfig["logLevel"],
    skills: JSON.parse(row.skills),
    updatedAt: row.updated_at,
  };
}

export function getAllAgentConfigs(): AgentConfig[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT agent_id, model, temperature, max_tokens, heartbeat_interval, auto_start, log_level, skills, updated_at
    FROM agent_configs ORDER BY updated_at DESC
  `).all() as Array<{
    agent_id: string;
    model: string;
    temperature: number;
    max_tokens: number;
    heartbeat_interval: number;
    auto_start: number;
    log_level: string;
    skills: string;
    updated_at: string;
  }>;

  return rows.map((row) => ({
    agentId: row.agent_id,
    model: row.model,
    temperature: row.temperature,
    maxTokens: row.max_tokens,
    heartbeatInterval: row.heartbeat_interval,
    autoStart: row.auto_start === 1,
    logLevel: row.log_level as AgentConfig["logLevel"],
    skills: JSON.parse(row.skills),
    updatedAt: row.updated_at,
  }));
}

export function setAgentConfig(agentId: string, config: AgentConfigInput): AgentConfig {
  const db = getDb();
  const existing = getAgentConfig(agentId);
  const now = new Date().toISOString();

  const merged: AgentConfig = {
    agentId,
    model: config.model ?? existing?.model ?? DEFAULT_CONFIG.model,
    temperature: config.temperature ?? existing?.temperature ?? DEFAULT_CONFIG.temperature,
    maxTokens: config.maxTokens ?? existing?.maxTokens ?? DEFAULT_CONFIG.maxTokens,
    heartbeatInterval: config.heartbeatInterval ?? existing?.heartbeatInterval ?? DEFAULT_CONFIG.heartbeatInterval,
    autoStart: config.autoStart ?? existing?.autoStart ?? DEFAULT_CONFIG.autoStart,
    logLevel: config.logLevel ?? existing?.logLevel ?? DEFAULT_CONFIG.logLevel,
    skills: config.skills ?? existing?.skills ?? DEFAULT_CONFIG.skills,
    updatedAt: now,
  };

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO agent_configs 
      (agent_id, model, temperature, max_tokens, heartbeat_interval, auto_start, log_level, skills, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    merged.agentId,
    merged.model,
    merged.temperature,
    merged.maxTokens,
    merged.heartbeatInterval,
    merged.autoStart ? 1 : 0,
    merged.logLevel,
    JSON.stringify(merged.skills),
    merged.updatedAt
  );

  return merged;
}

export function deleteAgentConfig(agentId: string): boolean {
  const db = getDb();
  const result = db.prepare("DELETE FROM agent_configs WHERE agent_id = ?").run(agentId);
  return result.changes > 0;
}

export function resetAgentConfigToDefault(agentId: string): AgentConfig {
  return setAgentConfig(agentId, { ...DEFAULT_CONFIG });
}

export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}

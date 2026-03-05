/**
 * SQLite-backed Activity Logger
 * Stores all agent activities with 30-day retention
 */
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';

const DB_PATH = path.join(process.cwd(), 'data', 'activities.db');

export type ActivityType =
  | 'file'
  | 'search'
  | 'message'
  | 'command'
  | 'security'
  | 'build'
  | 'task'
  | 'cron'
  | 'memory'
  | 'cron_run'
  | 'file_read'
  | 'file_write'
  | 'web_search'
  | 'message_sent'
  | 'tool_call'
  | 'agent_action'
  | 'approval';

export type ActivityStatus = 'success' | 'error' | 'pending' | 'running' | 'approved' | 'rejected';

export interface Activity {
  id: string;
  timestamp: string;
  type: string;
  description: string;
  status: string;
  duration_ms: number | null;
  tokens_used: number | null;
  agent: string | null;
  metadata: Record<string, unknown> | null;
}

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (_db) return _db;

  // Ensure data dir
  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  _db = new Database(DB_PATH);

  // WAL mode for better concurrency
  _db.pragma('journal_mode = WAL');
  _db.pragma('synchronous = NORMAL');

  // Create table
  _db.exec(`
    CREATE TABLE IF NOT EXISTS activities (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      type TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'success',
      duration_ms INTEGER,
      tokens_used INTEGER,
      agent TEXT,
      metadata TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_activities_timestamp ON activities(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_activities_type ON activities(type);
    CREATE INDEX IF NOT EXISTS idx_activities_status ON activities(status);
  `);

  // Migrate from JSON if DB is empty and JSON exists
  const count = (_db.prepare('SELECT COUNT(*) as n FROM activities').get() as { n: number }).n;
  if (count === 0) {
    const jsonPath = path.join(process.cwd(), 'data', 'activities.json');
    if (fs.existsSync(jsonPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
        const insert = _db.prepare(`
          INSERT OR IGNORE INTO activities (id, timestamp, type, description, status, duration_ms, tokens_used, agent, metadata)
          VALUES (@id, @timestamp, @type, @description, @status, @duration_ms, @tokens_used, @agent, @metadata)
        `);
        const insertMany = _db.transaction((activities: Activity[]) => {
          for (const a of activities) {
            insert.run({
              ...a,
              agent: (a as Activity & { agent?: string }).agent ?? null,
              metadata: a.metadata ? JSON.stringify(a.metadata) : null,
            });
          }
        });
        insertMany(Array.isArray(data) ? data : []);
        console.log(`[activities-db] Migrated ${Array.isArray(data) ? data.length : 0} activities from JSON`);
      } catch (e) {
        console.warn('[activities-db] Migration from JSON failed:', e);
      }
    }
  }

  return _db;
}

export function logActivity(
  type: string,
  description: string,
  status: string,
  opts?: {
    duration_ms?: number | null;
    tokens_used?: number | null;
    agent?: string | null;
    metadata?: Record<string, unknown> | null;
  }
): Activity {
  const db = getDb();
  const id = randomUUID();
  const timestamp = new Date().toISOString();

  db.prepare(`
    INSERT INTO activities (id, timestamp, type, description, status, duration_ms, tokens_used, agent, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    timestamp,
    type,
    description,
    status,
    opts?.duration_ms ?? null,
    opts?.tokens_used ?? null,
    opts?.agent ?? null,
    opts?.metadata ? JSON.stringify(opts.metadata) : null,
  );

  // Prune activities older than 30 days
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare('DELETE FROM activities WHERE timestamp < ?').run(cutoff);

  return { id, timestamp, type, description, status, duration_ms: opts?.duration_ms ?? null, tokens_used: opts?.tokens_used ?? null, agent: opts?.agent ?? null, metadata: opts?.metadata ?? null };
}

export function updateActivity(
  id: string,
  status: string,
  opts?: { duration_ms?: number; tokens_used?: number }
): void {
  const db = getDb();
  db.prepare(`
    UPDATE activities SET status = ?, duration_ms = COALESCE(?, duration_ms), tokens_used = COALESCE(?, tokens_used)
    WHERE id = ?
  `).run(status, opts?.duration_ms ?? null, opts?.tokens_used ?? null, id);
}

export function getActivityById(id: string): Activity | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM activities WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  return row ? parseRow(row) : null;
}

export function updateActivityStatus(
  id: string,
  status: string,
  metadata?: Record<string, unknown>
): void {
  const db = getDb();
  if (metadata) {
    db.prepare(`
      UPDATE activities SET status = ?, metadata = ?
      WHERE id = ?
    `).run(status, JSON.stringify(metadata), id);
  } else {
    db.prepare(`
      UPDATE activities SET status = ?
      WHERE id = ?
    `).run(status, id);
  }
}

export interface GetActivitiesOptions {
  type?: string;
  status?: string;
  agent?: string;
  startDate?: string;
  endDate?: string;
  sort?: 'newest' | 'oldest';
  limit?: number;
  offset?: number;
}

export interface ActivitiesResult {
  activities: Activity[];
  total: number;
}

function parseRow(row: Record<string, unknown>): Activity {
  return {
    id: row.id as string,
    timestamp: row.timestamp as string,
    type: row.type as string,
    description: row.description as string,
    status: row.status as string,
    duration_ms: row.duration_ms as number | null,
    tokens_used: row.tokens_used as number | null,
    agent: row.agent as string | null,
    metadata: row.metadata ? JSON.parse(row.metadata as string) : null,
  };
}

export function getActivities(opts: GetActivitiesOptions = {}): ActivitiesResult {
  const db = getDb();

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (opts.type && opts.type !== 'all') {
    // Support comma-separated types
    const types = opts.type.split(',').map((t) => t.trim()).filter(Boolean);
    if (types.length === 1) {
      // Also match legacy types (cron_run → cron, file_read/file_write → file, etc.)
      const aliases: Record<string, string[]> = {
        cron: ['cron', 'cron_run'],
        file: ['file', 'file_read', 'file_write'],
        search: ['search', 'web_search'],
        message: ['message', 'message_sent'],
        task: ['task', 'tool_call', 'agent_action'],
      };
      const expanded = aliases[types[0]] ?? [types[0]];
      conditions.push(`type IN (${expanded.map(() => '?').join(',')})`);
      params.push(...expanded);
    } else {
      conditions.push(`type IN (${types.map(() => '?').join(',')})`);
      params.push(...types);
    }
  }

  if (opts.status && opts.status !== 'all') {
    conditions.push('status = ?');
    params.push(opts.status);
  }

  if (opts.agent) {
    conditions.push('agent = ?');
    params.push(opts.agent);
  }

  if (opts.startDate) {
    conditions.push('timestamp >= ?');
    params.push(opts.startDate);
  }

  if (opts.endDate) {
    // Include full end date
    conditions.push("timestamp <= datetime(?, '+1 day')");
    params.push(opts.endDate);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const order = opts.sort === 'oldest' ? 'ASC' : 'DESC';
  const limit = opts.limit ?? 20;
  const offset = opts.offset ?? 0;

  const total = (db.prepare(`SELECT COUNT(*) as n FROM activities ${where}`).get(...params) as { n: number }).n;
  const rows = db.prepare(`SELECT * FROM activities ${where} ORDER BY timestamp ${order} LIMIT ? OFFSET ?`).all(...params, limit, offset) as Record<string, unknown>[];

  return {
    activities: rows.map(parseRow),
    total,
  };
}

export interface HeatmapDay {
  day: string;
  count: number;
}

export interface TrendDay {
  day: string;
  count: number;
  success: number;
  errors: number;
}

export interface ActivityStats {
  total: number;
  today: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
  heatmap: HeatmapDay[];
  trend: TrendDay[];
}

export function getActivityStats(): ActivityStats {
  const db = getDb();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const total = (db.prepare('SELECT COUNT(*) as n FROM activities').get() as { n: number }).n;
  const today = (db.prepare("SELECT COUNT(*) as n FROM activities WHERE timestamp >= ?").get(todayStart.toISOString()) as { n: number }).n;

  const typeRows = db.prepare("SELECT type, COUNT(*) as n FROM activities GROUP BY type").all() as Array<{ type: string; n: number }>;
  const byType: Record<string, number> = {};
  for (const r of typeRows) byType[r.type] = r.n;

  const statusRows = db.prepare("SELECT status, COUNT(*) as n FROM activities GROUP BY status").all() as Array<{ status: string; n: number }>;
  const byStatus: Record<string, number> = {};
  for (const r of statusRows) byStatus[r.status] = r.n;

  // Heatmap: last 365 days
  const yearAgo = new Date();
  yearAgo.setDate(yearAgo.getDate() - 365);
  const heatmapRows = db.prepare(`
    SELECT date(timestamp) as day, COUNT(*) as count
    FROM activities
    WHERE timestamp >= ?
    GROUP BY day
    ORDER BY day
  `).all(yearAgo.toISOString()) as Array<{ day: string; count: number }>;
  const heatmap: HeatmapDay[] = heatmapRows.map((r) => ({ day: r.day, count: r.count }));

  // Trend: last 30 days with success/error breakdown
  const monthAgo = new Date();
  monthAgo.setDate(monthAgo.getDate() - 30);
  const trendRows = db.prepare(`
    SELECT
      date(timestamp) as day,
      COUNT(*) as count,
      SUM(CASE WHEN status = 'success' OR status = 'approved' THEN 1 ELSE 0 END) as success,
      SUM(CASE WHEN status = 'error' OR status = 'rejected' THEN 1 ELSE 0 END) as errors
    FROM activities
    WHERE timestamp >= ?
    GROUP BY day
    ORDER BY day DESC
  `).all(monthAgo.toISOString()) as Array<{ day: string; count: number; success: number; errors: number }>;
  const trend: TrendDay[] = trendRows.map((r) => ({
    day: r.day,
    count: r.count,
    success: r.success,
    errors: r.errors,
  }));

  return { total, today, byType, byStatus, heatmap, trend };
}

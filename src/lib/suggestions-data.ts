/**
 * Suggestions Data Collector - Gathers data from OpenClaw for the suggestions engine
 */

import fs from "fs";
import path from "path";
import { OPENCLAW_DIR, WORKSPACE_MEMORY, OPENCLAW_WORKSPACE } from "@/lib/paths";
import { getOpenClawAgents } from "@/lib/openclaw-agents";

// ============================================================================
// Data Interfaces
// ============================================================================

export interface MemoryStats {
  totalFiles: number;
  totalSize: number; // bytes
  lastMemoryDate: string | null;
  memoryAgeDays: number | null;
}

export interface FileStats {
  totalFiles: number;
  totalSize: number;
  workspaceCount: number;
  lastModified: string | null;
}

export interface KanbanStats {
  totalTasks: number;
  tasksByStatus: Record<string, number>;
  overdueTasks: number;
  unassignedTasks: number;
}

export interface AgentStats {
  totalAgents: number;
  agentsWithHeartbeat: number;
  agentsWithIdentity: number;
  agentsWithoutIdentity: number;
}

// ============================================================================
// Memory Analysis
// ============================================================================

/**
 * Get memory statistics from OpenClaw workspace
 */
export function getMemoryStats(): MemoryStats {
  const stats: MemoryStats = {
    totalFiles: 0,
    totalSize: 0,
    lastMemoryDate: null,
    memoryAgeDays: null,
  };

  try {
    const memoryDir = WORKSPACE_MEMORY;
    if (!fs.existsSync(memoryDir)) {
      return stats;
    }

    const files = fs.readdirSync(memoryDir);
    const memoryFiles = files.filter((f) => f.endsWith(".md"));

    stats.totalFiles = memoryFiles.length;

    let latestDate: Date | null = null;

    for (const file of memoryFiles) {
      const filePath = path.join(memoryDir, file);
      const stat = fs.statSync(filePath);
      stats.totalSize += stat.size;

      if (!latestDate || stat.mtime > latestDate) {
        latestDate = stat.mtime;
        stats.lastMemoryDate = stat.mtime.toISOString();
      }
    }

    if (latestDate) {
      const now = new Date();
      stats.memoryAgeDays = Math.floor(
        (now.getTime() - latestDate.getTime()) / (1000 * 60 * 60 * 24)
      );
    }
  } catch (error) {
    console.error("[suggestions-data] Error getting memory stats:", error);
  }

  return stats;
}

// ============================================================================
// File Analysis
// ============================================================================

/**
 * Get file statistics from OpenClaw workspace
 */
export function getFileStats(): FileStats {
  const stats: FileStats = {
    totalFiles: 0,
    totalSize: 0,
    workspaceCount: 0,
    lastModified: null,
  };

  try {
    const workspaceDir = OPENCLAW_WORKSPACE;
    if (!fs.existsSync(workspaceDir)) {
      return stats;
    }

    const entries = fs.readdirSync(workspaceDir);
    stats.workspaceCount = entries.length;

    let latestDate: Date | null = null;

    for (const entry of entries) {
      const entryPath = path.join(workspaceDir, entry);
      try {
        const stat = fs.statSync(entryPath);

        if (stat.isFile()) {
          stats.totalFiles++;
          stats.totalSize += stat.size;
        } else if (stat.isDirectory()) {
          // Count files in subdirectories
          const subFiles = countFilesRecursively(entryPath);
          stats.totalFiles += subFiles.count;
          stats.totalSize += subFiles.size;
        }

        if (!latestDate || stat.mtime > latestDate) {
          latestDate = stat.mtime;
          stats.lastModified = stat.mtime.toISOString();
        }
      } catch {
        // Skip inaccessible entries
      }
    }
  } catch (error) {
    console.error("[suggestions-data] Error getting file stats:", error);
  }

  return stats;
}

function countFilesRecursively(dir: string, maxDepth: number = 10, currentDepth: number = 0): { count: number; size: number } {
  // Prevent infinite recursion and stack overflow
  if (currentDepth >= maxDepth) {
    return { count: 0, size: 0 };
  }

  let count = 0;
  let size = 0;

  try {
    const entries = fs.readdirSync(dir);

    for (const entry of entries) {
      const entryPath = path.join(dir, entry);
      try {
        const stat = fs.statSync(entryPath);

        if (stat.isFile()) {
          count++;
          size += stat.size;
        } else if (stat.isDirectory() && !entry.startsWith(".")) {
          const sub = countFilesRecursively(entryPath, maxDepth, currentDepth + 1);
          count += sub.count;
          size += sub.size;
        }
      } catch {
        // Skip inaccessible entries
      }
    }
  } catch {
    // Skip inaccessible directories
  }

  return { count, size };
}

// ============================================================================
// Kanban Analysis
// ============================================================================

/**
 * Get Kanban statistics from SuperBotijo's database
 */
export function getKanbanStats(): KanbanStats {
  const stats: KanbanStats = {
    totalTasks: 0,
    tasksByStatus: {},
    overdueTasks: 0,
    unassignedTasks: 0,
  };

  try {
    // Try to read from the kanban database
    const dbPath = path.join(process.cwd(), "data", "kanban.db");

    if (!fs.existsSync(dbPath)) {
      return stats;
    }

    // Try to load better-sqlite3, but handle failure gracefully (e.g., in test environments)
    let Database: ReturnType<typeof require> | null = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      Database = require("better-sqlite3");
    } catch {
      // Module not available (e.g., in test environment)
      return stats;
    }

    if (!Database) return stats;

    const db = new Database(dbPath, { readonly: true });

    try {
      const hasKanbanTasksTable = Boolean(
        db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'kanban_tasks'").get()
      );

      if (!hasKanbanTasksTable) {
        return stats;
      }

      // Get task counts by status
      const statusCounts = db
        .prepare("SELECT status, COUNT(*) as count FROM kanban_tasks GROUP BY status")
        .all() as Array<{ status: string; count: number }>;

      for (const row of statusCounts) {
        stats.tasksByStatus[row.status] = row.count;
        stats.totalTasks += row.count;
      }

      // Get overdue tasks (past due date and not done)
      const overdueCount = db
        .prepare(
          "SELECT COUNT(*) as count FROM kanban_tasks WHERE due_date IS NOT NULL AND date(due_date) < date('now') AND status NOT IN ('done', 'completed')"
        )
        .get() as { count: number };
      stats.overdueTasks = overdueCount?.count || 0;

      // Get unassigned tasks
      const unassignedCount = db
        .prepare("SELECT COUNT(*) as count FROM kanban_tasks WHERE assignee IS NULL OR assignee = ''")
        .get() as { count: number };
      stats.unassignedTasks = unassignedCount?.count || 0;
    } finally {
      db.close();
    }
  } catch (error) {
    console.error("[suggestions-data] Error getting kanban stats:", error);
  }

  return stats;
}

// ============================================================================
// Agent Analysis
// ============================================================================

/**
 * Get agent statistics from OpenClaw configuration
 */
export function getAgentStats(): AgentStats {
  const stats: AgentStats = {
    totalAgents: 0,
    agentsWithHeartbeat: 0,
    agentsWithIdentity: 0,
    agentsWithoutIdentity: 0,
  };

  try {
    const agents = getOpenClawAgents();

    stats.totalAgents = agents.length;
    stats.agentsWithHeartbeat = agents.filter((a) => a.heartbeatInterval !== null).length;
    stats.agentsWithIdentity = agents.filter((a) => a.hasIdentity).length;
    stats.agentsWithoutIdentity = agents.filter((a) => !a.hasIdentity).length;
  } catch (error) {
    console.error("[suggestions-data] Error getting agent stats:", error);
  }

  return stats;
}

// ============================================================================
// Error Log Analysis
// ============================================================================

export interface ErrorLog {
  message: string;
  count: number;
  lastSeen: string;
}

/**
 * Get recent errors from OpenClaw logs
 * Reads from PM2 error logs and OpenClaw session logs
 */
export function getRecentErrors(): ErrorLog[] {
  const errors: Map<string, ErrorLog> = new Map();

  try {
    // Try PM2 logs directory
    const pm2LogDir = "/root/.pm2/logs";

    if (fs.existsSync(pm2LogDir)) {
      const files = fs.readdirSync(pm2LogDir);
      const errorLogFiles = files.filter((f) => f.endsWith("-error.log"));

      for (const file of errorLogFiles) {
        const filePath = path.join(pm2LogDir, file);
        try {
          const content = fs.readFileSync(filePath, "utf-8");
          const lines = content.split("\n").filter((l) => l.includes("error") || l.includes("Error") || l.includes("ERROR"));

          // Get last 50 lines for recent errors
          const recentLines = lines.slice(-50);

          for (const line of recentLines) {
            // Extract error message (usually between quotes or after colon)
            const match = line.match(/(?:Error|error|ERROR)[:\s]+(?:["']?)([^"'\n]+)/);
            if (match) {
              const message = match[1].trim().slice(0, 100);

              if (message.length > 10) {
                // Normalize similar errors
                const key = message.toLowerCase().slice(0, 50);

                if (errors.has(key)) {
                  errors.get(key)!.count++;
                  errors.get(key)!.lastSeen = new Date().toISOString();
                } else {
                  errors.set(key, {
                    message,
                    count: 1,
                    lastSeen: new Date().toISOString(),
                  });
                }
              }
            }
          }
        } catch {
          // Skip unreadable files
        }
      }
    }

    // Also try OpenClaw workspace logs
    const workspaceLogsDir = path.join(OPENCLAW_DIR, "workspace", ".logs");

    if (fs.existsSync(workspaceLogsDir)) {
      const files = fs.readdirSync(workspaceLogsDir);

      for (const file of files) {
        if (!file.endsWith(".log")) continue;

        const filePath = path.join(workspaceLogsDir, file);
        try {
          const content = fs.readFileSync(filePath, "utf-8");
          const lines = content.split("\n").filter(
            (l) => l.includes("error") || l.includes("Error") || l.includes("exception")
          );

          const recentLines = lines.slice(-30);

          for (const line of recentLines) {
            const match = line.match(/(?:exception|Exception|Error)[:\s]+([^\n]+)/);
            if (match) {
              const message = match[1].trim().slice(0, 100);

              if (message.length > 10) {
                const key = message.toLowerCase().slice(0, 50);

                if (errors.has(key)) {
                  errors.get(key)!.count++;
                  errors.get(key)!.lastSeen = new Date().toISOString();
                } else {
                  errors.set(key, {
                    message,
                    count: 1,
                    lastSeen: new Date().toISOString(),
                  });
                }
              }
            }
          }
        } catch {
          // Skip unreadable files
        }
      }
    }
  } catch (error) {
    console.error("[suggestions-data] Error getting recent errors:", error);
  }

  // Return sorted by count, top 10
  return Array.from(errors.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

// ============================================================================
// Heartbeat Configuration
// ============================================================================

/**
 * Get heartbeat frequency from OpenClaw configuration
 * Returns the minimum heartbeat interval across all agents in milliseconds
 */
export function getHeartbeatFrequency(): number {
  try {
    const configPath = path.join(OPENCLAW_DIR, "openclaw.json");

    if (!fs.existsSync(configPath)) {
      return 60000; // Default 1 minute
    }

    const configData = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    const agents = configData.agents?.list || [];

    if (agents.length === 0) {
      return 60000;
    }

    // Find the minimum heartbeat interval
    let minInterval = 0;

    for (const agent of agents) {
      if (agent.heartbeat?.every) {
        const interval = parseHeartbeatToMs(agent.heartbeat.every);
        if (interval > 0 && (minInterval === 0 || interval < minInterval)) {
          minInterval = interval;
        }
      }
    }

    return minInterval > 0 ? minInterval : 60000;
  } catch (error) {
    console.error("[suggestions-data] Error getting heartbeat frequency:", error);
    return 60000;
  }
}

/**
 * Parse heartbeat interval string to milliseconds
 */
function parseHeartbeatToMs(interval: string): number {
  const match = interval.match(/^(\d+)\s*(min|minute|minutes|h|hour|hours|s|second|seconds)$/i);

  if (!match) {
    return 60000; // Default
  }

  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();

  switch (unit) {
    case "s":
    case "second":
    case "seconds":
      return value * 1000;
    case "min":
    case "minute":
    case "minutes":
      return value * 60 * 1000;
    case "h":
    case "hour":
    case "hours":
      return value * 60 * 60 * 1000;
    default:
      return 60000;
  }
}

// ============================================================================
// Unified Data Collection
// ============================================================================

export interface SuggestionsData {
  memoryStats: MemoryStats;
  fileStats: FileStats;
  kanbanStats: KanbanStats;
  agentStats: AgentStats;
  recentErrors: ErrorLog[];
  heartbeatFrequency: number;
}

/**
 * Collect all data needed for suggestions
 */
export function collectSuggestionsData(): SuggestionsData {
  return {
    memoryStats: getMemoryStats(),
    fileStats: getFileStats(),
    kanbanStats: getKanbanStats(),
    agentStats: getAgentStats(),
    recentErrors: getRecentErrors(),
    heartbeatFrequency: getHeartbeatFrequency(),
  };
}

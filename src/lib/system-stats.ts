/**
 * System statistics collection module.
 *
 * Extracts the system stats logic from the route handler into a reusable
 * module. Collects CPU, memory, disk, service status, VPN, firewall,
 * uptime, and agent statistics.
 *
 * @module system-stats
 */

import fs from "fs";
import os from "os";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";

import { createAsyncCache } from "@/lib/cache";

const execAsync = promisify(exec);

const SYSTEMD_SERVICES = ["superbotijo", "content-vault", "classvault", "creatoros"];

interface UsageRecord {
  timestamp: string;
  agentId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
}

interface CpuStats {
  load: number;
  loadAvg1: number;
  loadAvg5: number;
  loadAvg15: number;
}

interface MemoryStats {
  total: number;
  used: number;
  free: number;
}

interface DiskStats {
  used: number;
  total: number;
}

export interface SystemStatsResponse {
  cpu: CpuStats;
  memory: MemoryStats;
  disk: DiskStats;
  activeAgents: number;
  totalAgents: number;
  tokensToday: number;
  uptime: string;
  vpnActive: boolean;
  firewallActive: boolean;
  activeServices: number;
  totalServices: number;
}

/**
 * Execute a shell command, returning stdout on success or a fallback on failure.
 * Individual command failures are isolated — they never crash the entire stats collection.
 */
async function safeExec(command: string, fallback: string = ""): Promise<string> {
  try {
    const { stdout } = await execAsync(command);
    return stdout;
  } catch {
    return fallback;
  }
}

/**
 * Collect comprehensive system statistics.
 *
 * Gathers CPU load averages, memory usage, disk usage, systemd service
 * status, VPN/firewall status, uptime, and agent activity stats from
 * the usage database.
 *
 * Shell commands are parallelized where possible — disk, VPN, firewall,
 * and systemd checks all run concurrently via Promise.all.
 *
 * @returns System statistics matching the /api/system/stats response shape
 */
export async function getSystemStats(): Promise<SystemStatsResponse> {
  // CPU - load averages (synchronous, no shell)
  const loadAvg = os.loadavg();
  const cpuCount = os.cpus().length;
  const cpuLoad = Math.min(Math.round((loadAvg[0] / cpuCount) * 100), 100);

  // Memory (synchronous, no shell)
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;

  // Uptime (synchronous, no shell)
  const uptimeSeconds = os.uptime();
  const days = Math.floor(uptimeSeconds / 86400);
  const hours = Math.floor((uptimeSeconds % 86400) / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);
  const uptime = `${days}d ${hours}h ${minutes}m`;

  // Parallelize ALL shell commands: disk, systemd services, VPN, firewall
  const [diskStdout, vpnStdout, firewallStdout, ...serviceResults] = await Promise.all([
    safeExec("df -BG / | tail -1"),
    safeExec("tailscale status 2>/dev/null || true"),
    safeExec("ufw status 2>/dev/null | head -1 || true"),
    ...SYSTEMD_SERVICES.map((name) =>
      safeExec(`systemctl is-active ${name} 2>/dev/null || true`)
    ),
  ]);

  // Parse disk stats
  let diskUsed = 0;
  let diskTotal = 100;
  if (diskStdout) {
    try {
      const parts = diskStdout.trim().split(/\s+/);
      diskTotal = parseInt(parts[1].replace("G", ""));
      diskUsed = parseInt(parts[2].replace("G", ""));
    } catch (error) {
      console.error("Failed to parse disk stats:", error);
    }
  }

  // Parse systemd service results
  let activeServices = 0;
  const totalServices = SYSTEMD_SERVICES.length;
  for (const result of serviceResults) {
    if (result.trim() === "active") activeServices++;
  }

  // Parse VPN status
  let vpnActive: boolean;
  if (vpnStdout) {
    vpnActive = vpnStdout.trim().length > 0 && !vpnStdout.includes("Tailscale is stopped");
  } else {
    vpnActive = true; // Assume active if check fails
  }

  // Parse firewall status
  const firewallActive = firewallStdout ? firewallStdout.includes("active") : true;

  // Get agent counts from activity log
  let activeAgents = 0;
  let totalAgents = 0;
  let tokensToday = 0;

  try {
    const dataDir = process.env.OPENCLAW_DIR || "/root/.openclaw";
    const usageDbPath = path.join(dataDir, "data", "usage-tracking.db");

    // Get tokens for today
    const today = new Date().toISOString().split("T")[0];
    const startOfDay = new Date(today + "T00:00:00Z").getTime();

    if (fs.existsSync(usageDbPath)) {
      // Use better-sqlite3 if available
      try {
        const Database = (await import("better-sqlite3")).default;
        const db = new Database(usageDbPath, { readonly: true });

        // Tokens today
        const tokensResult = db.prepare(`
          SELECT SUM(input_tokens + output_tokens) as total
          FROM usage
          WHERE timestamp >= ?
        `).get(startOfDay) as { total: number | null } | undefined;

        tokensToday = tokensResult?.total || 0;

        // Active agents (with activity in last hour)
        const oneHourAgo = Date.now() - 3600000;
        const activeResult = db.prepare(`
          SELECT COUNT(DISTINCT agent_id) as count
          FROM usage
          WHERE timestamp >= ?
        `).get(oneHourAgo) as { count: number } | undefined;

        activeAgents = activeResult?.count || 0;

        // Total unique agents ever
        const totalResult = db.prepare(`
          SELECT COUNT(DISTINCT agent_id) as count FROM usage
        `).get() as { count: number } | undefined;

        totalAgents = totalResult?.count || 0;

        db.close();
      } catch {
        // Fallback: read activity.json if exists
        const activityPath = path.join(dataDir, "activity.json");
        if (fs.existsSync(activityPath)) {
          const activityData = JSON.parse(fs.readFileSync(activityPath, "utf-8"));
          const activities: UsageRecord[] = Array.isArray(activityData) ? activityData : [];

          const now = Date.now();
          const oneHourAgo = now - 3600000;

          // Filter today's activities
          const todayActivities = activities.filter((a) => {
            const ts = new Date(a.timestamp).getTime();
            return ts >= startOfDay;
          });

          tokensToday = todayActivities.reduce(
            (sum, a) => sum + (a.inputTokens || 0) + (a.outputTokens || 0),
            0
          );

          // Active in last hour
          const recentActivities = activities.filter((a) => {
            const ts = new Date(a.timestamp).getTime();
            return ts >= oneHourAgo;
          });
          const recentAgentIds = new Set(recentActivities.map((a) => a.agentId));
          activeAgents = recentAgentIds.size;

          // Total agents
          const allAgentIds = new Set(activities.map((a) => a.agentId));
          totalAgents = allAgentIds.size;
        }
      }
    }
  } catch (error) {
    console.error("Failed to get agent stats:", error);
  }

  // If no agents found, try to get from config
  if (totalAgents === 0) {
    try {
      const dataDir = process.env.OPENCLAW_DIR || "/root/.openclaw";
      const configPath = path.join(dataDir, "openclaw.json");
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
        const agents = config?.agents?.defaults ? [config.agents.defaults] : [];
        const additionalAgents = config?.agents?.additional || [];
        totalAgents = agents.length + additionalAgents.length;
      }
    } catch {
      totalAgents = 1;
    }
  }

  return {
    cpu: {
      load: cpuLoad,
      loadAvg1: parseFloat(loadAvg[0].toFixed(2)),
      loadAvg5: parseFloat(loadAvg[1].toFixed(2)),
      loadAvg15: parseFloat(loadAvg[2].toFixed(2)),
    },
    memory: {
      total: parseFloat((totalMem / 1024 / 1024 / 1024).toFixed(2)),
      used: parseFloat((usedMem / 1024 / 1024 / 1024).toFixed(2)),
      free: parseFloat((freeMem / 1024 / 1024 / 1024).toFixed(2)),
    },
    disk: {
      used: diskUsed,
      total: diskTotal,
    },
    activeAgents,
    totalAgents,
    tokensToday,
    uptime,
    vpnActive,
    firewallActive,
    activeServices,
    totalServices,
  };
}

/**
 * Cached version of getSystemStats with 15-second TTL.
 *
 * Concurrent callers receive the same in-flight Promise (deduplication).
 * Failed computations are NOT cached — the next call retries fresh.
 */
export const cachedSystemStats = createAsyncCache<SystemStatsResponse>({
  ttlMs: 15_000,
  compute: getSystemStats,
});

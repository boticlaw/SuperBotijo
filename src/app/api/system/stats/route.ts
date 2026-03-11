import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import os from "os";
import fs from "fs";
import path from "path";

const execAsync = promisify(exec);

const SYSTEMD_SERVICES = ["superbotijo", "content-vault", "classvault", "creatoros"];

export const dynamic = "force-dynamic";

interface UsageRecord {
  timestamp: string;
  agentId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
}

export async function GET() {
  try {
    // CPU - load averages
    const loadAvg = os.loadavg();
    const cpuCount = os.cpus().length;
    const cpuLoad = Math.min(Math.round((loadAvg[0] / cpuCount) * 100), 100);

    // Memory
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    // Disk
    let diskUsed = 0;
    let diskTotal = 100;
    try {
      const { stdout } = await execAsync("df -BG / | tail -1");
      const parts = stdout.trim().split(/\s+/);
      diskTotal = parseInt(parts[1].replace("G", ""));
      diskUsed = parseInt(parts[2].replace("G", ""));
    } catch (error) {
      console.error("Failed to get disk stats:", error);
    }

    // Systemd Services (count active ones)
    let activeServices = 0;
    const totalServices = SYSTEMD_SERVICES.length;
    try {
      for (const name of SYSTEMD_SERVICES) {
        const { stdout } = await execAsync(`systemctl is-active ${name} 2>/dev/null || true`);
        if (stdout.trim() === "active") activeServices++;
      }
    } catch (error) {
      console.error("Failed to get systemd stats:", error);
    }

    // Tailscale VPN Status
    let vpnActive = false;
    try {
      const { stdout } = await execAsync("tailscale status 2>/dev/null || true");
      vpnActive = stdout.trim().length > 0 && !stdout.includes("Tailscale is stopped");
    } catch {
      vpnActive = true;
    }

    // Firewall Status
    let firewallActive = true;
    try {
      const { stdout } = await execAsync("ufw status 2>/dev/null | head -1 || true");
      firewallActive = stdout.includes("active");
    } catch {
      firewallActive = true;
    }

    // Uptime
    const uptimeSeconds = os.uptime();
    const days = Math.floor(uptimeSeconds / 86400);
    const hours = Math.floor((uptimeSeconds % 86400) / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const uptime = `${days}d ${hours}h ${minutes}m`;

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

    return NextResponse.json({
      // CPU with detailed load averages
      cpu: {
        load: cpuLoad,
        loadAvg1: parseFloat(loadAvg[0].toFixed(2)),
        loadAvg5: parseFloat(loadAvg[1].toFixed(2)),
        loadAvg15: parseFloat(loadAvg[2].toFixed(2)),
      },
      // Memory (renamed from ram)
      memory: {
        total: parseFloat((totalMem / 1024 / 1024 / 1024).toFixed(2)),
        used: parseFloat((usedMem / 1024 / 1024 / 1024).toFixed(2)),
        free: parseFloat((freeMem / 1024 / 1024 / 1024).toFixed(2)),
      },
      // Disk
      disk: {
        used: diskUsed,
        total: diskTotal,
      },
      // Agent stats
      activeAgents,
      totalAgents,
      tokensToday,
      // System info
      uptime,
      vpnActive,
      firewallActive,
      activeServices,
      totalServices,
    });
  } catch (error) {
    console.error("Error fetching system stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch system stats" },
      { status: 500 }
    );
  }
}

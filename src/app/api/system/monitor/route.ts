import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import os from "os";

const execAsync = promisify(exec);

export const dynamic = "force-dynamic";

// Services monitored per backend
// Auto-detect OpenClaw-related services
const SYSTEMD_SERVICES = ["openclaw-gateway", "superbotijo"];
const PM2_SERVICES: string[] = []; // No PM2 services by default
const PLACEHOLDER_SERVICES: Array<{ name: string; description: string; status: string }> = []; // No placeholders

interface ServiceEntry {
  name: string;
  status: string;
  description: string;
  backend: string;
  uptime?: number | null;
  restarts?: number;
  pid?: number | null;
  mem?: number | null;
  cpu?: number | null;
}

interface TailscaleDevice {
  hostname: string;
  ip: string;
  os: string;
  online: boolean;
}

interface FirewallRule {
  port: string;
  action: string;
  from: string;
  comment: string;
}

// Normalize PM2 status to a common set
function normalizePm2Status(status: string): string {
  switch (status) {
    case "online":
      return "active";
    case "stopped":
    case "stopping":
      return "inactive";
    case "errored":
    case "error":
      return "failed";
    case "launching":
    case "waiting restart":
      return "activating";
    default:
      return status;
  }
}

// Friendly display names for PM2 process names
const SERVICE_DESCRIPTIONS: Record<string, string> = {
  "superbotijo": "SuperBotijo – SuperBotijo Dashboard",
  classvault: "ClassVault – LMS Platform",
  "content-vault": "Content Vault – Draft Management Webapp",
  "postiz-simple": "Postiz – Social Media Scheduler",
  brain: "Brain – Internal Tools",
  creatoros: "Creatoros Platform",
};

export async function GET() {
  try {
    // ── CPU ──────────────────────────────────────────────────────────────────
    const cpuCount = os.cpus().length;
    const loadAvg = os.loadavg();
    const cpuUsage = Math.min(Math.round((loadAvg[0] / cpuCount) * 100), 100);

    // ── RAM ──────────────────────────────────────────────────────────────────
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    // ── Disk ─────────────────────────────────────────────────────────────────
    let diskTotal = 100;
    let diskUsed = 0;
    let diskFree = 100;
    try {
      const { stdout } = await execAsync("df -BG / | tail -1");
      const parts = stdout.trim().split(/\s+/);
      diskTotal = parseInt(parts[1].replace("G", ""));
      diskUsed = parseInt(parts[2].replace("G", ""));
      diskFree = parseInt(parts[3].replace("G", ""));
    } catch (error) {
      console.error("Failed to get disk stats:", error);
    }
    const diskPercent = (diskUsed / diskTotal) * 100;

    // ── Network (real stats from /proc/net/dev) ───────────────────────────────
    let network = { rx: 0, tx: 0 };
    try {
      const { readFileSync } = await import('fs');
      
      function readNetStats(): { rx: number; tx: number; ts: number } {
        const netDev = readFileSync('/proc/net/dev', 'utf-8');
        const lines = netDev.trim().split('\n').slice(2);
        let rx = 0, tx = 0;
        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          const iface = parts[0].replace(':', '');
          if (iface === 'lo') continue;
          rx += parseInt(parts[1]) || 0;
          tx += parseInt(parts[9]) || 0;
        }
        return { rx, tx, ts: Date.now() };
      }
      
      const current = readNetStats();
      
      // Use module-level cache for previous reading
      if ((global as Record<string, unknown>).__netPrev) {
        const prev = (global as Record<string, unknown>).__netPrev as { rx: number; tx: number; ts: number };
        const dtSec = (current.ts - prev.ts) / 1000;
        if (dtSec > 0) {
          network = {
            rx: parseFloat(Math.max(0, (current.rx - prev.rx) / 1024 / 1024 / dtSec).toFixed(3)),
            tx: parseFloat(Math.max(0, (current.tx - prev.tx) / 1024 / 1024 / dtSec).toFixed(3)),
          };
        }
      }
      (global as Record<string, unknown>).__netPrev = current;
    } catch (error) {
      console.error("Failed to get network stats:", error);
    }

    // ── Services ─────────────────────────────────────────────────────────────
    const services: ServiceEntry[] = [];

    // 1. Systemd services
    for (const name of SYSTEMD_SERVICES) {
      try {
        const { stdout } = await execAsync(`systemctl is-active ${name} 2>/dev/null || true`);
        const rawStatus = stdout.trim(); // "active" | "inactive" | "failed" | ...
        services.push({
          name,
          status: rawStatus,
          description: SERVICE_DESCRIPTIONS[name] ?? name,
          backend: "systemd",
        });
      } catch {
        services.push({
          name,
          status: "unknown",
          description: SERVICE_DESCRIPTIONS[name] ?? name,
          backend: "systemd",
        });
      }
    }

    // 2. PM2 services — single call, parse JSON (only if PM2 services exist)
    if (PM2_SERVICES.length > 0) {
      try {
        const { stdout: pm2Json } = await execAsync("pm2 jlist 2>/dev/null");
        const pm2List = JSON.parse(pm2Json) as Array<{
          name: string;
          pid: number | null;
          pm2_env: {
            status: string;
            pm_uptime?: number;
            restart_time?: number;
            monit?: { cpu: number; memory: number };
          };
        }>;

        const pm2Map: Record<string, (typeof pm2List)[0]> = {};
        for (const proc of pm2List) {
          pm2Map[proc.name] = proc;
        }

        for (const name of PM2_SERVICES) {
          const proc = pm2Map[name];
          if (!proc) {
            services.push({
              name,
              status: "unknown",
              description: SERVICE_DESCRIPTIONS[name] ?? name,
              backend: "pm2",
            });
            continue;
          }

          const rawStatus = proc.pm2_env?.status ?? "unknown";
          const uptime =
            rawStatus === "online" && proc.pm2_env?.pm_uptime
              ? Date.now() - proc.pm2_env.pm_uptime
              : null;

          services.push({
            name,
            status: normalizePm2Status(rawStatus),
            description: SERVICE_DESCRIPTIONS[name] ?? name,
            backend: "pm2",
            uptime,
            restarts: proc.pm2_env?.restart_time ?? 0,
            pid: proc.pid,
            cpu: proc.pm2_env?.monit?.cpu ?? null,
            mem: proc.pm2_env?.monit?.memory ?? null,
          });
        }
      } catch (err) {
        console.error("Failed to query PM2:", err);
        // Fallback: mark all PM2 services as unknown
        for (const name of PM2_SERVICES) {
          services.push({
            name,
            status: "unknown",
            description: SERVICE_DESCRIPTIONS[name] ?? name,
            backend: "pm2",
          });
        }
      }
    }

    // 3. Placeholder services (not yet deployed)
    for (const svc of PLACEHOLDER_SERVICES) {
      services.push({ ...svc, backend: "none" });
    }

    // ── Tailscale VPN ─────────────────────────────────────────────────────────
    let tailscaleActive = false;
    let tailscaleIp = "";
    const tailscaleDevices: TailscaleDevice[] = [];
    
    // Check if Tailscale is installed first
    try {
      await execAsync("which tailscale");
      
      // Tailscale is installed, get real status
      try {
        const { stdout: tsStatus } = await execAsync("tailscale status 2>/dev/null || true");
        const lines = tsStatus.trim().split("\n").filter(Boolean);
        
        if (lines.length > 0 && !tsStatus.includes("not running")) {
          tailscaleActive = true;
          for (const line of lines) {
            if (line.startsWith("#")) continue;
            const parts = line.trim().split(/\s+/);
            if (parts.length >= 3) {
              tailscaleDevices.push({
                ip: parts[0],
                hostname: parts[1],
                os: parts[3] || "",
                online: line.includes("active") || line.includes("online"),
              });
            }
          }
          if (tailscaleDevices.length > 0) {
            tailscaleIp = tailscaleDevices[0].ip;
          }
        }
      } catch (error) {
        console.error("Failed to get Tailscale status:", error);
      }
    } catch {
      // Tailscale not installed
      tailscaleActive = false;
      tailscaleIp = "";
    }

    // ── Firewall (UFW) ────────────────────────────────────────────────────────
    let firewallActive = false;
    const firewallRulesList: FirewallRule[] = [];
    
    try {
      const { stdout: ufwStatus } = await execAsync("ufw status numbered 2>/dev/null || true");
      if (ufwStatus.includes("Status: active")) {
        firewallActive = true;
        const lines = ufwStatus.split("\n");
        for (const line of lines) {
          const match = line.match(/\[\s*\d+\]\s+([\w/:]+)\s+(\w+)\s+(\S+)\s*(#?.*)$/);
          if (match) {
            firewallRulesList.push({
              port: match[1].trim(),
              action: match[2].trim(),
              from: match[3].trim(),
              comment: match[4].replace("#", "").trim(),
            });
          }
        }
      }
    } catch (error) {
      console.error("Failed to get firewall status:", error);
    }

    return NextResponse.json({
      cpu: {
        usage: cpuUsage,
        cores: os.cpus().map(() => Math.round(Math.random() * 100)),
        loadAvg,
      },
      ram: {
        total: parseFloat((totalMem / 1024 / 1024 / 1024).toFixed(2)),
        used: parseFloat((usedMem / 1024 / 1024 / 1024).toFixed(2)),
        free: parseFloat((freeMem / 1024 / 1024 / 1024).toFixed(2)),
        cached: 0,
      },
      disk: {
        total: diskTotal,
        used: diskUsed,
        free: diskFree,
        percent: diskPercent,
      },
      network,
      systemd: services, // kept field name for backwards compat with page.tsx
      tailscale: {
        active: tailscaleActive,
        ip: tailscaleIp,
        devices: tailscaleDevices,
      },
      firewall: {
        active: firewallActive,
        rules: firewallRulesList,
        ruleCount: firewallRulesList.length,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching system monitor data:", error);
    return NextResponse.json(
      { error: "Failed to fetch system monitor data" },
      { status: 500 }
    );
  }
}

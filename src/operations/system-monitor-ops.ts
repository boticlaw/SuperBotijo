/**
 * System Monitor Operations - Business logic for system monitoring
 */
import { exec } from "child_process";
import { promisify } from "util";
import { readFileSync } from "fs";
import os from "os";

const execAsync = promisify(exec);

const SYSTEMD_SERVICES = ["openclaw-gateway", "superbotijo"];
const _PM2_SERVICES: string[] = [];
const _PLACEHOLDER_SERVICES: Array<{ name: string; description: string; status: string }> = [];

export interface ServiceEntry {
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

export interface TailscaleDevice {
  hostname: string;
  ip: string;
  os: string;
  online: boolean;
}

export interface FirewallRule {
  port: string;
  action: string;
  from: string;
  comment: string;
}

export interface SystemMonitorData {
  cpu: { usage: number; cores: number[]; loadAvg: number[] };
  ram: { total: number; used: number; free: number; cached: number };
  disk: { total: number; used: number; free: number; percent: number };
  network: { rx: number; tx: number };
  systemd: ServiceEntry[];
  tailscale: { active: boolean; ip: string; devices: TailscaleDevice[] };
  firewall: { active: boolean; rules: FirewallRule[]; ruleCount: number };
  timestamp: string;
}

const SERVICE_DESCRIPTIONS: Record<string, string> = {
  "superbotijo": "SuperBotijo – SuperBotijo Dashboard",
  classvault: "ClassVault – LMS Platform",
  "content-vault": "Content Vault – Draft Management Webapp",
  "postiz-simple": "Postiz – Social Media Scheduler",
  brain: "Brain – Internal Tools",
  creatoros: "Creatoros Platform",
};

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

async function getNetworkStats(): Promise<{ rx: number; tx: number }> {
  try {
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
    
    if ((global as Record<string, unknown>).__netPrev) {
      const prev = (global as Record<string, unknown>).__netPrev as { rx: number; tx: number; ts: number };
      const dtSec = (current.ts - prev.ts) / 1000;
      if (dtSec > 0) {
        (global as Record<string, unknown>).__netPrev = current;
        return {
          rx: parseFloat(Math.max(0, (current.rx - prev.rx) / 1024 / 1024 / dtSec).toFixed(3)),
          tx: parseFloat(Math.max(0, (current.tx - prev.tx) / 1024 / 1024 / dtSec).toFixed(3)),
        };
      }
    }
    (global as Record<string, unknown>).__netPrev = current;
    return { rx: 0, tx: 0 };
  } catch {
    return { rx: 0, tx: 0 };
  }
}

export async function getSystemMonitorData(): Promise<SystemMonitorData> {
  const cpuCount = os.cpus().length;
  const loadAvg = os.loadavg();
  const cpuUsage = Math.min(Math.round((loadAvg[0] / cpuCount) * 100), 100);

  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;

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

  const network = await getNetworkStats();

  const services: ServiceEntry[] = [];

  for (const name of SYSTEMD_SERVICES) {
    try {
      const { stdout } = await execAsync(`systemctl is-active ${name} 2>/dev/null || true`);
      const rawStatus = stdout.trim();
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

  if (_PM2_SERVICES.length > 0) {
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

      for (const name of _PM2_SERVICES) {
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
      for (const name of _PM2_SERVICES) {
        services.push({
          name,
          status: "unknown",
          description: SERVICE_DESCRIPTIONS[name] ?? name,
          backend: "pm2",
        });
      }
    }
  }

  for (const svc of _PLACEHOLDER_SERVICES) {
    services.push({ ...svc, backend: "none" });
  }

  let tailscaleActive = false;
  let tailscaleIp = "";
  const tailscaleDevices: TailscaleDevice[] = [];
  
  try {
    await execAsync("which tailscale");
    
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
    tailscaleActive = false;
    tailscaleIp = "";
  }

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

  return {
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
    systemd: services,
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
  };
}

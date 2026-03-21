/**
 * Service discovery API
 * GET /api/system/services
 * Returns discovered services from systemd and PM2
 */
import { NextResponse } from "next/server";
import { safeExecFile } from "@/lib/safe-exec";

export const dynamic = "force-dynamic";

interface Service {
  name: string;
  backend: "systemd" | "pm2";
  label: string;
}

const SERVICE_DESCRIPTIONS: Record<string, string> = {
  superbotijo: "SuperBotijo – Dashboard",
  classvault: "ClassVault – LMS Platform",
  "content-vault": "Content Vault – Draft Management",
  "postiz-simple": "Postiz – Social Media Scheduler",
  brain: "Brain – Internal Tools",
  creatoros: "Creatoros Platform",
  "openclaw-gateway": "OpenClaw Gateway",
  openclaw: "OpenClaw Agent",
};

const SERVICE_PATTERNS = [
  "openclaw",
  "superbotijo",
  "brain",
  "classvault",
  "content-vault",
  "postiz",
  "gateway",
];

function isMatch(name: string): boolean {
  const lower = name.toLowerCase();
  return SERVICE_PATTERNS.some((pattern) => lower.includes(pattern));
}

function generateLabel(name: string): string {
  if (SERVICE_DESCRIPTIONS[name]) {
    return SERVICE_DESCRIPTIONS[name];
  }
  const clean = name
    .replace(/-/g, " ")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ");
  return clean
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function discoverSystemdServices(): string[] {
  const services: Set<string> = new Set();

  try {
    const result = safeExecFile("systemctl", ["list-units", "--type=service", "--state=running", "--no-pager", "-o", "json"], {});
    if (result.status === 0 && result.stdout) {
      const units = JSON.parse(result.stdout) as Array<{ unit: string }>;
      for (const svc of units) {
        const name = svc.unit.replace(".service", "");
        if (isMatch(name)) {
          services.add(name);
        }
      }
    }
  } catch {
    // Ignore
  }

  try {
    const result = safeExecFile("systemctl", ["list-unit-files", "--type=service", "--no-pager"], {});
    if (result.status === 0 && result.stdout) {
      const lines = result.stdout.split("\n");
      for (const line of lines) {
        const match = line.match(/^(\S+)\.service\s+/);
        if (match) {
          const name = match[1];
          if (isMatch(name)) {
            services.add(name);
          }
        }
      }
    }
  } catch {
    // Ignore
  }

  return [...services];
}

function discoverPm2Services(): string[] {
  const services: string[] = [];

  try {
    const whichResult = safeExecFile("which", ["pm2"], {});
    if (whichResult.status === 0) {
      const pm2Result = safeExecFile("pm2", ["jlist"], {});
      if (pm2Result.status === 0 && pm2Result.stdout) {
        const pm2List = JSON.parse(pm2Result.stdout) as Array<{ name: string }>;
        for (const proc of pm2List) {
          if (isMatch(proc.name)) {
            services.push(proc.name);
          }
        }
      }
    }
  } catch {
    // PM2 not available or no processes
  }

  return services;
}

export async function GET() {
  try {
    const systemdServices = discoverSystemdServices();
    const pm2Services = discoverPm2Services();

    const services: Service[] = [
      ...systemdServices.map((name) => ({
        name,
        backend: "systemd" as const,
        label: generateLabel(name),
      })),
      ...pm2Services.map((name) => ({
        name,
        backend: "pm2" as const,
        label: generateLabel(name),
      })),
    ];

    return NextResponse.json({ services });
  } catch (error) {
    console.error("[services API] Discovery error:", error);
    return NextResponse.json({ services: [], error: "Discovery failed" }, { status: 200 });
  }
}

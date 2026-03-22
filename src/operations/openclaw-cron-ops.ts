/**
 * OpenClaw Cron Operations - Business logic for OpenClaw cron jobs
 */
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { safeExecFile } from "@/lib/safe-exec";

const OPENCLAW_DIR = process.env.OPENCLAW_DIR || "/home/daniel/.openclaw";
const CRON_JOBS_FILE = join(OPENCLAW_DIR, "cron", "jobs.json");

export interface OpenClawCronJob {
  id: string;
  agentId: string;
  name: string;
  description: string;
  message: string;
  schedule: string;
  scheduleDisplay: string;
  timezone: string;
  enabled: boolean;
  nextRun: string | null;
  lastRun: string | null;
  sessionTarget: string;
  payload: Record<string, unknown>;
}

function fetchCronJobsFromCLI(): Record<string, unknown>[] {
  const result = safeExecFile("openclaw", ["cron", "list", "--json", "--all"], {
    timeout: 5000,
  });

  if (result.status !== 0 || !result.stdout) {
    console.error("[cron ops] CLI fallback failed");
    return [];
  }

  try {
    const parsed = JSON.parse(result.stdout);
    return (parsed.jobs as Record<string, unknown>[]) || parsed || [];
  } catch {
    console.error("[cron ops] CLI fallback JSON parse failed");
    return [];
  }
}

export async function getOpenClawCronJobs(): Promise<OpenClawCronJob[]> {
  try {
    let rawJobs: Record<string, unknown>[] = [];

    if (existsSync(CRON_JOBS_FILE)) {
      try {
        const fileContent = readFileSync(CRON_JOBS_FILE, "utf-8");
        const parsed = JSON.parse(fileContent);
        rawJobs = (parsed.jobs as Record<string, unknown>[]) || [];
      } catch (parseError) {
        console.error("[cron ops] Failed to parse cron jobs file:", parseError);
        rawJobs = fetchCronJobsFromCLI();
      }
    } else {
      console.warn("[cron ops] Cron jobs file not found, falling back to CLI");
      rawJobs = fetchCronJobsFromCLI();
    }

    const cronJobs = rawJobs.map((job) => {
      const schedule = job.schedule as Record<string, unknown> | undefined;
      let scheduleDisplay = "Custom";
      let scheduleString = "* * * * *";

      if (schedule?.kind === "every") {
        const everyMs = schedule.everyMs as number;
        if (everyMs === 1800000) scheduleDisplay = "Every 30 min";
        else if (everyMs === 3600000) scheduleDisplay = "Every hour";
        else if (everyMs === 86400000) scheduleDisplay = "Daily";
        else scheduleDisplay = `Every ${everyMs / 60000} min`;
        scheduleString = `*/${everyMs / 60000} * * * *`;
      } else if (schedule?.kind === "cron") {
        scheduleString = (schedule.expr as string) || "* * * * *";
        scheduleDisplay = scheduleString;
      }

      const state = job.state as Record<string, unknown> | undefined;

      return {
        id: job.id as string,
        agentId: (job.agentId as string) || "unknown",
        name: job.name as string,
        description: (job.description as string) || "",
        message: ((job.payload as Record<string, unknown>)?.message as string) || "",
        schedule: scheduleString,
        scheduleDisplay,
        timezone: (schedule?.tz as string) || "UTC",
        enabled: job.enabled !== false,
        nextRun: state?.nextRunAtMs ? new Date(state.nextRunAtMs as number).toISOString() : null,
        lastRun: state?.lastRunAtMs ? new Date(state.lastRunAtMs as number).toISOString() : null,
        sessionTarget: (job.sessionTarget as string) || "isolated",
        payload: (job.payload as Record<string, unknown>) || {},
      };
    });

    return cronJobs;
  } catch (error) {
    console.error("Error fetching cron jobs:", error);
    return [];
  }
}

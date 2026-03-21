import { NextResponse } from "next/server";
import { execSync } from "child_process";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

export const dynamic = "force-dynamic";

const OPENCLAW_DIR = process.env.OPENCLAW_DIR || "/home/daniel/.openclaw";

/**
 * Parse duration string like "1m", "5m", "15m", "30m", "1h" to milliseconds
 */
function parseDurationToMs(duration: string): number {
  const match = duration.match(/^(\d+)(m|h)$/);
  if (!match) return 0;

  const value = parseInt(match[1], 10);
  const unit = match[2];

  if (unit === "h") return value * 60 * 60 * 1000;
  return value * 60 * 1000;
}

export interface UnifiedTask {
  id: string;
  name: string;
  type: "cron" | "heartbeat" | "scheduled";
  agentId?: string;
  schedule: string;
  scheduleDisplay: string;
  enabled: boolean;
  nextRun: string | null;
  lastRun: string | null;
  description?: string;
  status?: "success" | "error" | "running" | "pending";
  error?: string;
}

/**
 * GET /api/tasks
 * Returns unified view of all scheduled tasks: cron jobs + heartbeat
 */
export async function GET() {
  try {
    const tasks: UnifiedTask[] = [];

    // 1. Get OpenClaw cron jobs
    try {
      const output = execSync("openclaw cron list --json --all 2>/dev/null", {
        timeout: 10000,
        encoding: "utf-8",
      });

      const parsed = JSON.parse(output);
      const cronJobs = parsed.jobs || [];

      for (const job of cronJobs) {
        const schedule = job.schedule || {};
        const state = job.state || {};

        let scheduleDisplay = "Custom";
        let scheduleString = "* * * * *";

        if (schedule.kind === "every") {
          const everyMs = schedule.everyMs;
          if (everyMs === 1800000) scheduleDisplay = "Every 30 min";
          else if (everyMs === 3600000) scheduleDisplay = "Every hour";
          else if (everyMs === 86400000) scheduleDisplay = "Daily";
          else scheduleDisplay = `Every ${everyMs / 60000} min`;
          scheduleString = `*/${everyMs / 60000} * * * *`;
        } else if (schedule.kind === "cron") {
          scheduleString = schedule.expr || "* * * * *";
          scheduleDisplay = scheduleString;
        }

        let status: "success" | "error" | "running" | "pending" = "pending";
        if (state.lastRunStatus === "success") status = "success";
        else if (state.lastRunStatus === "error") status = "error";

        tasks.push({
          id: job.id,
          name: job.name,
          type: "cron",
          agentId: job.agentId,
          schedule: scheduleString,
          scheduleDisplay,
          enabled: job.enabled !== false,
          nextRun: state.nextRunAtMs ? new Date(state.nextRunAtMs).toISOString() : null,
          lastRun: state.lastRunAtMs ? new Date(state.lastRunAtMs).toISOString() : null,
          description: job.description,
          status,
          error: state.lastError,
        });
      }
    } catch (error) {
      console.error("[tasks API] Error fetching cron jobs:", error);
    }

    // 2. Get Heartbeat configuration from agents.list
    try {
      const configPath = join(OPENCLAW_DIR, "openclaw.json");
      if (existsSync(configPath)) {
        const raw = readFileSync(configPath, "utf-8");
        const json = JSON.parse(raw);
        const agentsList = json.agents?.list || [];

        for (const agent of agentsList) {
          const hb = agent.heartbeat;
          if (hb && hb.every) {
            const everyMs = parseDurationToMs(hb.every);
            if (everyMs <= 0) continue;

            let scheduleDisplay = "Custom";
            if (everyMs === 1800000) scheduleDisplay = "Every 30 min";
            else if (everyMs === 3600000) scheduleDisplay = "Every hour";
            else if (everyMs === 60000) scheduleDisplay = "Every min";
            else if (everyMs === 300000) scheduleDisplay = "Every 5 min";
            else if (everyMs === 900000) scheduleDisplay = "Every 15 min";
            else scheduleDisplay = `Every ${everyMs / 60000} min`;

            tasks.push({
              id: `heartbeat-${agent.id}`,
              name: `Heartbeat (${agent.name || agent.id})`,
              type: "heartbeat",
              agentId: agent.id,
              schedule: `*/${everyMs / 60000} * * * *`,
              scheduleDisplay,
              enabled: true,
              nextRun: null,
              lastRun: null,
              description: `Periodic self-check for ${agent.name || agent.id}`,
            });
          }
        }
      }
    } catch (error) {
      console.error("[tasks API] Error fetching heartbeat:", error);
    }

    return NextResponse.json(tasks);
  } catch (error) {
    console.error("[tasks API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch tasks" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/tasks?jobId=<id>
 * Deletes a cron job or heartbeat configuration
 */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get("jobId");

    if (!jobId) {
      return NextResponse.json(
        { error: "jobId is required" },
        { status: 400 }
      );
    }

    // Special handling for heartbeat (stored in openclaw.json)
    if (jobId === "heartbeat") {
      try {
        const configPath = join(OPENCLAW_DIR, "openclaw.json");
        if (existsSync(configPath)) {
          const raw = readFileSync(configPath, "utf-8");
          const json = JSON.parse(raw);

          // Remove heartbeat from defaults
          if (json.agents?.defaults) {
            delete json.agents.defaults.heartbeat;
          }

          // Also check and remove from individual agents
          if (json.agents?.byId) {
            for (const agentId in json.agents.byId) {
              delete json.agents.byId[agentId].heartbeat;
            }
          }

          writeFileSync(configPath, JSON.stringify(json, null, 2));
          return NextResponse.json({ success: true, message: "Heartbeat disabled" });
        }
      } catch (error) {
        console.error("[tasks API] Error disabling heartbeat:", error);
        return NextResponse.json(
          { error: "Failed to disable heartbeat" },
          { status: 500 }
        );
      }
    }

    // For cron jobs, use CLI (timeout 5 seconds)
    try {
      execSync(`openclaw cron rm ${jobId}`, {
        timeout: 5000,
        encoding: "utf-8",
        stdio: "pipe",
      });
      return NextResponse.json({ success: true, message: `Cron job ${jobId} deleted` });
    } catch (execError) {
      console.error("[tasks API] Error deleting cron job:", execError);
      return NextResponse.json(
        { error: `Failed to delete cron job: ${jobId}` },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[tasks API] DELETE Error:", error);
    return NextResponse.json(
      { error: "Failed to delete task" },
      { status: 500 }
    );
  }
}

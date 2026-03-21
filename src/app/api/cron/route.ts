import { NextRequest, NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { isValidCron } from "@/lib/cron-parser";
import { safeExecFile, isValidId, isValidCronAction } from "@/lib/safe-exec";

export const dynamic = "force-dynamic";

const OPENCLAW_DIR = process.env.OPENCLAW_DIR || "/home/daniel/.openclaw";
const CRON_JOBS_FILE = join(OPENCLAW_DIR, "cron", "jobs.json");

interface CreateJobBody {
  name: string;
  schedule?: string;
  every?: string;
  at?: string;
  timezone?: string;
  agentId?: string;
  message?: string;
  description?: string;
  disabled?: boolean;
}

interface UpdateJobBody {
  id: string;
  name?: string;
  schedule?: string;
  every?: string;
  at?: string;
  timezone?: string;
  agentId?: string;
  message?: string;
  description?: string;
  enabled?: boolean;
}

export async function GET() {
  try {
    let rawJobs: Record<string, unknown>[] = [];

    if (existsSync(CRON_JOBS_FILE)) {
      try {
        const fileContent = readFileSync(CRON_JOBS_FILE, "utf-8");
        const parsed = JSON.parse(fileContent);
        rawJobs = (parsed.jobs as Record<string, unknown>[]) || [];
      } catch (parseError) {
        console.error("[cron API] Failed to parse cron jobs file:", parseError);
        rawJobs = fetchCronJobsFromCLI();
      }
    } else {
      console.warn("[cron API] Cron jobs file not found, falling back to CLI");
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
        id: job.id,
        agentId: job.agentId || "unknown",
        name: job.name,
        description: (job.description as string) || "",
        message: (job.payload as Record<string, unknown>)?.message as string || "",
        schedule: scheduleString,
        scheduleDisplay,
        timezone: (schedule?.tz as string) || "UTC",
        enabled: job.enabled !== false,
        nextRun: state?.nextRunAtMs ? new Date(state.nextRunAtMs as number).toISOString() : null,
        lastRun: state?.lastRunAtMs ? new Date(state.lastRunAtMs as number).toISOString() : null,
        sessionTarget: job.sessionTarget || "isolated",
        payload: job.payload || {},
      };
    });

    return NextResponse.json(cronJobs);
  } catch (error) {
    console.error("Error fetching cron jobs:", error);
    return NextResponse.json(
      { error: "Failed to fetch cron jobs from OpenClaw" },
      { status: 500 }
    );
  }
}

function fetchCronJobsFromCLI(): Record<string, unknown>[] {
  const result = safeExecFile("openclaw", ["cron", "list", "--json", "--all"], {
    timeout: 5000,
  });

  if (result.status !== 0 || !result.stdout) {
    console.error("[cron API] CLI fallback failed");
    return [];
  }

  try {
    const parsed = JSON.parse(result.stdout);
    return (parsed.jobs as Record<string, unknown>[]) || parsed || [];
  } catch {
    console.error("[cron API] CLI fallback JSON parse failed");
    return [];
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: CreateJobBody = await request.json();
    const { name, schedule, every, at, timezone, agentId, message, description, disabled } = body;

    if (!name) {
      return NextResponse.json({ error: "Job name is required" }, { status: 400 });
    }

    if (!schedule && !every && !at) {
      return NextResponse.json({ error: "Schedule (cron), every, or at is required" }, { status: 400 });
    }

    if (schedule && !isValidCron(schedule)) {
      return NextResponse.json({ error: "Invalid cron expression" }, { status: 400 });
    }

    const args: string[] = ["cron", "add", "--json", "--name", name];

    if (schedule) {
      args.push("--cron", schedule);
    }

    if (every) {
      args.push("--every", every);
    }

    if (at) {
      args.push("--at", at);
    }

    const tz = timezone || "Europe/Madrid";
    args.push("--tz", tz);

    if (agentId) {
      args.push("--agent", agentId);
    }

    if (message) {
      args.push("--message", message);
    }

    if (description) {
      args.push("--description", description);
    }

    if (disabled) {
      args.push("--disabled");
    }

    console.log("[cron API] Creating job:", `openclaw ${args.slice(0, 4).join(" ")}... (message redacted)`);

    const result = safeExecFile("openclaw", args, {
      timeout: 15000,
    });

    if (result.status !== 0) {
      return NextResponse.json(
        { error: "Failed to create cron job", details: result.stderr || result.stdout },
        { status: 500 }
      );
    }

    let jobData;
    try {
      jobData = JSON.parse(result.stdout);
    } catch {
      jobData = { rawOutput: result.stdout };
    }

    await createNotification(
      "Cron Job Created",
      `Job "${name}" has been created successfully.`,
      "success"
    );

    return NextResponse.json({ success: true, job: jobData });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create cron job";
    console.error("Error creating cron job:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body: UpdateJobBody = await request.json();
    const { id, name, schedule, every, at, timezone, agentId, message, description, enabled } = body;

    if (!id) {
      return NextResponse.json({ error: "Job ID is required" }, { status: 400 });
    }

    if (!isValidId(id)) {
      return NextResponse.json({ error: "Invalid job ID" }, { status: 400 });
    }

    if (schedule && !isValidCron(schedule)) {
      return NextResponse.json({ error: "Invalid cron expression" }, { status: 400 });
    }

    if (enabled !== undefined && !name && !schedule && !every && !at && !timezone && !agentId && !message && !description) {
      const action = enabled ? "enable" : "disable";
      if (!isValidCronAction(action)) {
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
      }

      safeExecFile("openclaw", ["cron", action, id, "--json"], {
        timeout: 10000,
      });
      return NextResponse.json({ success: true, id, enabled });
    }

    const args: string[] = ["cron", "edit", id];

    if (name) {
      args.push("--name", name);
    }

    if (schedule) {
      args.push("--cron", schedule);
    }

    if (every) {
      args.push("--every", every);
    }

    if (at) {
      args.push("--at", at);
    }

    if (timezone) {
      args.push("--tz", timezone);
    }

    if (agentId) {
      args.push("--agent", agentId);
    }

    if (message) {
      args.push("--message", message);
    }

    if (description) {
      args.push("--description", description);
    }

    if (enabled === true) {
      args.push("--enable");
    } else if (enabled === false) {
      args.push("--disable");
    }

    console.log("[cron API] Updating job:", `openclaw ${args.slice(0, 3).join(" ")}... (message redacted)`);

    const result = safeExecFile("openclaw", args, {
      timeout: 15000,
    });

    if (result.status !== 0) {
      return NextResponse.json(
        { error: "Failed to update cron job", details: result.stderr || result.stdout },
        { status: 500 }
      );
    }

    let jobData;
    try {
      jobData = JSON.parse(result.stdout);
    } catch {
      jobData = { rawOutput: result.stdout };
    }

    return NextResponse.json({ success: true, id, job: jobData });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update cron job";
    console.error("Error updating cron job:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Job ID is required" }, { status: 400 });
    }

    if (!isValidId(id)) {
      return NextResponse.json({ error: "Invalid job ID" }, { status: 400 });
    }

    safeExecFile("openclaw", ["cron", "rm", id], {
      timeout: 10000,
    });

    return NextResponse.json({ success: true, deleted: id });
  } catch (error) {
    console.error("Error deleting cron job:", error);
    return NextResponse.json(
      { error: "Failed to delete cron job" },
      { status: 500 }
    );
  }
}

async function createNotification(title: string, message: string, type: "info" | "success" | "warning" | "error" = "info") {
  try {
    await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/notifications`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, message, type }),
    });
  } catch (error) {
    console.error("Failed to create notification:", error);
  }
}

/**
 * System Cron Operations - Business logic for system cron jobs
 */
import { readdirSync, readFileSync, existsSync } from "fs";
import { join } from "path";

const CRON_DIR = "/etc/cron.d";

export interface SystemCronJob {
  id: string;
  name: string;
  description: string;
  schedule: string;
  scheduleDisplay: string;
  user: string;
  command: string;
  enabled: boolean;
  source: "system";
  logPath?: string;
}

function cronToHuman(expr: string): string {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return expr;

  const [min, hour, dom, mon, dow] = parts;

  if (min.startsWith("*/")) {
    const interval = min.slice(2);
    return `Every ${interval} minutes`;
  }

  if (hour === "*" && min !== "*") {
    return `Every hour at minute ${min.padStart(2, "0")}`;
  }

  if (min !== "*" && hour !== "*" && dom === "*" && mon === "*" && dow === "*") {
    const h = parseInt(hour);
    const period = h >= 12 ? "PM" : "AM";
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `Daily at ${h12}:${min.padStart(2, "0")} ${period}`;
  }

  if (min !== "*" && hour !== "*" && dow !== "*" && dom === "*" && mon === "*") {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const dayNum = parseInt(dow);
    if (!isNaN(dayNum) && dayNum >= 0 && dayNum <= 6) {
      const h = parseInt(hour);
      const period = h >= 12 ? "PM" : "AM";
      const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
      return `${days[dayNum]}s at ${h12}:${min.padStart(2, "0")} ${period}`;
    }
  }

  if (min.startsWith("*/") && hour === "*") {
    const interval = min.slice(2);
    return `Every ${interval} minutes`;
  }

  if (hour.startsWith("*/") && min !== "*") {
    const interval = hour.slice(2);
    return `Every ${interval} hours at minute ${min}`;
  }

  return expr;
}

function extractLogPath(command: string): string | undefined {
  const match = command.match(/>>\s*(\/[^\s]+)/);
  return match ? match[1] : undefined;
}

function parseCronFile(filename: string): SystemCronJob | null {
  const filepath = join(CRON_DIR, filename);
  if (!existsSync(filepath)) return null;

  try {
    const content = readFileSync(filepath, "utf-8");
    const lines = content.split("\n").filter((l) => l.trim() && !l.startsWith("#"));

    const commentLines = content.split("\n").filter((l) => l.trim().startsWith("#"));
    const description = commentLines[0]?.replace(/^#\s*/, "") || "";

    const cronLine = lines[0];
    if (!cronLine) return null;

    const parts = cronLine.split(/\s+/);
    if (parts.length < 7) return null;

    const [min, hour, dom, mon, dow, user, ...cmdParts] = parts;
    const schedule = `${min} ${hour} ${dom} ${mon} ${dow}`;
    const command = cmdParts.join(" ");

    return {
      id: filename,
      name: filename
        .replace(/-/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase()),
      description,
      schedule,
      scheduleDisplay: cronToHuman(schedule),
      user,
      command,
      enabled: true,
      source: "system",
      logPath: extractLogPath(command),
    };
  } catch {
    return null;
  }
}

export async function getSystemCronJobs(): Promise<SystemCronJob[]> {
  try {
    if (!existsSync(CRON_DIR)) {
      return [];
    }

    const files = readdirSync(CRON_DIR);
    const validFiles = files.filter(
      (f) =>
        !f.startsWith(".") &&
        !f.endsWith(".bak") &&
        !f.endsWith(".tmp") &&
        !f.endsWith(".dpkg-dist") &&
        f !== ".placeholder"
    );

    const jobs = validFiles
      .map(parseCronFile)
      .filter((j): j is SystemCronJob => j !== null)
      .sort((a, b) => a.name.localeCompare(b.name));

    return jobs;
  } catch (error) {
    console.error("Error reading system cron:", error);
    return [];
  }
}

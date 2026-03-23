import { NextResponse } from "next/server";
import { format, subDays } from "date-fns";
import Database from "better-sqlite3";
import path from "path";
import { promises as fs } from "fs";

export const dynamic = "force-dynamic";

const DB_PATH = path.join(process.cwd(), "data", "activities.db");

interface AnalyticsData {
  byDay: { date: string; count: number }[];
  byType: { type: string; count: number }[];
  byHour: { hour: number; day: number; count: number }[];
  successRate: number;
}

export async function GET(): Promise<NextResponse<AnalyticsData>> {
  // Try SQLite first, fallback to JSON
  let activities: Array<{ type: string; status: string; timestamp: string }> = [];

  try {
    await fs.access(DB_PATH);
    const db = new Database(DB_PATH);
    const rows = db.prepare("SELECT type, status, timestamp FROM activities ORDER BY timestamp DESC").all() as Array<{ type: string; status: string; timestamp: string }>;
    db.close();
    activities = rows;
  } catch {
    // Fallback to JSON
    try {
      const { readFileSync } = await import("fs");
      const jsonPath = path.join(process.cwd(), "data", "activities.json");
      activities = JSON.parse(readFileSync(jsonPath, "utf-8"));
    } catch {}
  }

  // Last 7 days activity count
  const today = new Date();
  const byDay: { date: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const date = subDays(today, i);
    const dateStr = format(date, "yyyy-MM-dd");
    const displayDate = format(date, "MMM d");
    const count = activities.filter((a) => {
      return a.timestamp.startsWith(dateStr);
    }).length;
    byDay.push({ date: displayDate, count });
  }

  // Activity by type
  const typeMap = new Map<string, number>();
  activities.forEach((a) => {
    const normalized = a.type === "cron_run" ? "cron" :
                       a.type === "file_read" || a.type === "file_write" ? "file" :
                       a.type === "web_search" ? "search" :
                       a.type === "message_sent" ? "message" :
                       a.type === "tool_call" || a.type === "agent_action" ? "task" : a.type;
    typeMap.set(normalized, (typeMap.get(normalized) || 0) + 1);
  });
  const byType = Array.from(typeMap.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);

  // Activity by hour/day heatmap
  const hourDayMap = new Map<string, number>();
  activities.forEach((a) => {
    try {
      const d = new Date(a.timestamp);
      const hour = d.getHours();
      const day = d.getDay();
      const key = `${hour}-${day}`;
      hourDayMap.set(key, (hourDayMap.get(key) || 0) + 1);
    } catch {}
  });

  const byHour: { hour: number; day: number; count: number }[] = [];
  hourDayMap.forEach((count, key) => {
    const [hour, day] = key.split("-").map(Number);
    byHour.push({ hour, day, count });
  });

  // Success rate
  const successCount = activities.filter((a) => a.status === "success").length;
  const successRate = activities.length > 0 ? (successCount / activities.length) * 100 : 0;

  return NextResponse.json({ byDay, byType, byHour, successRate });
}

import { NextResponse } from "next/server";
import { getActivities } from "@/lib/activities-db";

export const dynamic = "force-dynamic";

type MoodType = "productive" | "busy" | "idle" | "frustrated" | "neutral";

interface DailyMood {
  date: string;
  mood: MoodType;
  emoji: string;
  score: number;
  streak: number;
}

interface MoodResponse {
  current: {
    mood: MoodType;
    emoji: string;
    score: number;
    streak: number;
    metrics: {
      activityCount: number;
      successRate: number;
      avgTokensPerHour: number;
      errorCount: number;
      criticalErrorCount: number;
    };
  };
  history: DailyMood[];
  trend: {
    direction: "up" | "down" | "stable";
    change: number;
  };
}

function calculateMoodForDay(
  activities: Array<{ timestamp: string; status: string; type: string; tokens_used: number | null }>,
  weekActivities: Array<{ timestamp: string; status: string; type: string }>,
  date: Date
): DailyMood {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const dayActivities = activities.filter((a) => {
    const actDate = new Date(a.timestamp);
    return actDate >= startOfDay && actDate <= endOfDay;
  });

  const activityCount = dayActivities.length;
  const successCount = dayActivities.filter((a) => a.status === "success").length;
  const errorCount = dayActivities.filter((a) => a.status === "error").length;
  const criticalErrorCount = dayActivities.filter(
    (a) => a.status === "error" && (a.type === "system" || a.type === "security" || a.type === "build")
  ).length;
  const successRate = activityCount > 0 ? (successCount / activityCount) * 100 : 100;

  // Calculate streak up to this day
  let streak = 0;
  const daysChecked = new Set<string>();
  
  const sortedWeekActivities = [...weekActivities].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  for (const activity of sortedWeekActivities) {
    const actDate = new Date(activity.timestamp);
    if (actDate > endOfDay) break;
    
    const day = actDate.toDateString();
    if (daysChecked.has(day)) continue;
    daysChecked.add(day);

    const dayActivitiesForStreak = weekActivities.filter(
      (a) => new Date(a.timestamp).toDateString() === day && new Date(a.timestamp) <= endOfDay
    );
    const hasCriticalError = dayActivitiesForStreak.some(
      (a) => a.status === "error" && (a.type === "system" || a.type === "security" || a.type === "build")
    );

    if (hasCriticalError) break;
    streak++;
  }

  let mood: MoodType;
  let score: number;

  if (criticalErrorCount >= 3 || successRate < 50) {
    mood = "frustrated";
    score = Math.max(0, 30 - criticalErrorCount * 10);
  } else if (activityCount === 0) {
    mood = "idle";
    score = 40;
  } else if (activityCount > 100 && successRate > 90) {
    mood = "productive";
    score = 90 + Math.min(10, streak);
  } else if (activityCount > 50) {
    mood = "busy";
    score = 70 + (successRate - 80) / 2;
  } else {
    mood = "neutral";
    score = 60;
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    date: startOfDay.toISOString().split("T")[0],
    mood,
    emoji: mood === "productive" ? "🚀" : mood === "busy" ? "💼" : mood === "idle" ? "😴" : mood === "frustrated" ? "😤" : "🙂",
    score,
    streak,
  };
}

function calculateCurrentMood(
  activities: Array<{ timestamp: string; status: string; type: string; tokens_used: number | null }>,
  weekActivities: Array<{ timestamp: string; status: string; type: string }>
): MoodResponse["current"] {
  const activityCount = activities.length;
  const successCount = activities.filter((a) => a.status === "success").length;
  const errorCount = activities.filter((a) => a.status === "error").length;
  const criticalErrorCount = activities.filter(
    (a) => a.status === "error" && (a.type === "system" || a.type === "security" || a.type === "build")
  ).length;
  const successRate = activityCount > 0 ? (successCount / activityCount) * 100 : 100;
  const totalTokens = activities.reduce((sum, a) => sum + (a.tokens_used || 0), 0);
  const avgTokensPerHour = totalTokens / 24;

  let streak = 0;
  const daysChecked = new Set<string>();

  for (const activity of [...weekActivities].reverse()) {
    const day = new Date(activity.timestamp).toDateString();
    if (daysChecked.has(day)) continue;
    daysChecked.add(day);

    const dayActivities = weekActivities.filter(
      (a) => new Date(a.timestamp).toDateString() === day
    );
    const hasCriticalError = dayActivities.some(
      (a) => a.status === "error" && (a.type === "system" || a.type === "security" || a.type === "build")
    );

    if (hasCriticalError) break;
    streak++;
  }

  let mood: MoodType;
  let score: number;

  if (criticalErrorCount >= 3 || successRate < 50) {
    mood = "frustrated";
    score = Math.max(0, 30 - criticalErrorCount * 10);
  } else if (activityCount === 0) {
    mood = "idle";
    score = 40;
  } else if (activityCount > 100 && successRate > 90) {
    mood = "productive";
    score = 90 + Math.min(10, streak);
  } else if (activityCount > 50) {
    mood = "busy";
    score = 70 + (successRate - 80) / 2;
  } else {
    mood = "neutral";
    score = 60;
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    mood,
    emoji: mood === "productive" ? "🚀" : mood === "busy" ? "💼" : mood === "idle" ? "😴" : mood === "frustrated" ? "😤" : "🙂",
    score,
    streak,
    metrics: {
      activityCount,
      successRate: Math.round(successRate * 10) / 10,
      avgTokensPerHour: Math.round(avgTokensPerHour),
      errorCount,
      criticalErrorCount,
    },
  };
}

export async function GET() {
  try {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last8days = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);

    const recentResult = getActivities({
      startDate: last24h.toISOString(),
      limit: 1000,
      sort: "newest",
    });

    const weekResult = getActivities({
      startDate: last7days.toISOString(),
      limit: 5000,
      sort: "newest",
    });

    const fullHistoryResult = getActivities({
      startDate: last8days.toISOString(),
      limit: 10000,
      sort: "newest",
    });

    // Calculate current mood
    const current = calculateCurrentMood(
      recentResult.activities as Array<{
        timestamp: string;
        status: string;
        type: string;
        tokens_used: number | null;
      }>,
      weekResult.activities as Array<{ timestamp: string; status: string; type: string }>
    );

    // Calculate history for each of the last 7 days
    const history: DailyMood[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const dayMood = calculateMoodForDay(
        fullHistoryResult.activities as Array<{
          timestamp: string;
          status: string;
          type: string;
          tokens_used: number | null;
        }>,
        weekResult.activities as Array<{ timestamp: string; status: string; type: string }>,
        date
      );
      history.push(dayMood);
    }

    // Calculate trend (compare today vs yesterday)
    const today = history[history.length - 1];
    const yesterday = history[history.length - 2];
    let trend: MoodResponse["trend"];

    if (!yesterday || yesterday.score === 0) {
      trend = { direction: "stable", change: 0 };
    } else {
      const change = today.score - yesterday.score;
      if (change > 5) {
        trend = { direction: "up", change };
      } else if (change < -5) {
        trend = { direction: "down", change };
      } else {
        trend = { direction: "stable", change };
      }
    }

    return NextResponse.json({
      current,
      history,
      trend,
    });
  } catch (error) {
    console.error("Failed to calculate mood:", error);
    return NextResponse.json({ error: "Failed to calculate mood" }, { status: 500 });
  }
}

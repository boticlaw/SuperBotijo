"use client";

import { useEffect, useState } from "react";
import {
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import { TrendingUp, TrendingDown, Activity, AlertTriangle, Zap, ChevronDown, ChevronUp } from "lucide-react";
import { useI18n } from "@/i18n/provider";

interface DailyMood {
  date: string;
  mood: string;
  emoji: string;
  score: number;
  streak: number;
}

interface MoodData {
  current: {
    mood: string;
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

const moodColors: Record<string, string> = {
  productive: "#10b981",
  busy: "#3b82f6",
  idle: "#6b7280",
  frustrated: "#ef4444",
  neutral: "#8b5cf6",
};

// Hardcoded colors matching the theme
const CHART_COLORS = {
  border: "#2A2A2A",
  card: "#1A1A1A",
  textSecondary: "#8A8A8A",
  textPrimary: "#FFFFFF",
};

function MoodSparkline({ data, color }: { data: DailyMood[]; color: string }) {
  // Transform data for chart
  const chartData = data.map((d) => ({
    ...d,
    day: new Date(d.date).toLocaleDateString(undefined, { weekday: "short" }),
  }));

  return (
    <div className="h-24 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={chartData}
          margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
        >
          <defs>
            <linearGradient id="moodGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.4} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="day"
            stroke={CHART_COLORS.textSecondary}
            fontSize={10}
            tickLine={false}
            axisLine={false}
            dy={5}
          />
          <YAxis
            domain={[0, 100]}
            stroke={CHART_COLORS.textSecondary}
            fontSize={10}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => v}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: CHART_COLORS.card,
              border: `1px solid ${CHART_COLORS.border}`,
              borderRadius: "8px",
              fontSize: "12px",
            }}
            labelStyle={{ color: CHART_COLORS.textSecondary, marginBottom: 4 }}
            formatter={(value: number) => [`${value}/100`, "Score"]}
          />
          <Area
            type="monotone"
            dataKey="score"
            stroke={color}
            strokeWidth={2}
            fill="url(#moodGradient)"
            dot={false}
            activeDot={{
              r: 5,
              fill: color,
              stroke: CHART_COLORS.card,
              strokeWidth: 2,
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MoodWidget() {
  const [moodData, setMoodData] = useState<MoodData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const { t } = useI18n();

  useEffect(() => {
    fetchMood();
    const interval = setInterval(fetchMood, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchMood = async () => {
    try {
      const res = await fetch("/api/agents/mood");
      if (res.ok) {
        const data = await res.json();
        setMoodData(data);
      }
    } catch (error) {
      console.error("Failed to fetch mood:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div
        className="p-4 rounded-xl animate-pulse"
        style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-full" style={{ backgroundColor: "var(--card-elevated)" }} />
          <div className="flex-1">
            <div className="h-4 w-20 rounded mb-2" style={{ backgroundColor: "var(--card-elevated)" }} />
            <div className="h-3 w-32 rounded" style={{ backgroundColor: "var(--card-elevated)" }} />
          </div>
        </div>
        <div className="h-2 w-full rounded" style={{ backgroundColor: "var(--card-elevated)" }} />
      </div>
    );
  }

  if (!moodData) return null;

  const { current, history, trend } = moodData;
  const color = moodColors[current.mood] || "#6b7280";

  return (
    <div
      className="rounded-xl overflow-hidden transition-all"
      style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
    >
      <div className="p-4">
        {/* Header with emoji and mood */}
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-2xl"
            style={{ backgroundColor: `${color}20` }}
          >
            {current.emoji}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-lg capitalize" style={{ color: "var(--text-primary)" }}>
              {t(`agents.mood.${current.mood}`)}
            </p>
            <p className="text-sm truncate" style={{ color: "var(--text-secondary)" }}>
              {t(`agents.mood.descriptions.${current.mood}`)}
            </p>
          </div>
          {/* Score badge */}
          <div
            className="px-3 py-1 rounded-full text-sm font-bold"
            style={{ backgroundColor: `${color}20`, color }}
          >
            {current.score}
          </div>
        </div>

        {/* Trend indicator */}
        {trend.direction !== "stable" && (
          <div
            className="flex items-center gap-2 text-sm mb-4 px-3 py-2 rounded-lg"
            style={{
              backgroundColor: trend.direction === "up" ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)",
            }}
          >
            {trend.direction === "up" ? (
              <TrendingUp className="w-4 h-4" style={{ color: "#10b981" }} />
            ) : (
              <TrendingDown className="w-4 h-4" style={{ color: "#ef4444" }} />
            )}
            <span style={{ color: trend.direction === "up" ? "#10b981" : "#ef4444" }}>
              {trend.change > 0 ? "+" : ""}
              {trend.change} {t("agents.mood.ptsVsYesterday")}
            </span>
          </div>
        )}

        {/* Sparkline chart */}
        <div className="mb-2">
          <MoodSparkline data={history} color={color} />
        </div>

        {/* Streak badge */}
        {current.streak > 0 && (
          <div
            className="flex items-center gap-2 text-sm mb-4 px-3 py-2 rounded-lg"
            style={{ backgroundColor: "rgba(245, 158, 11, 0.1)" }}
          >
            <Zap className="w-4 h-4" style={{ color: "#f59e0b" }} />
            <span style={{ color: "var(--text-secondary)" }}>
              <strong style={{ color: "#f59e0b" }}>{current.streak}</strong> {t("agents.mood.daysWithoutErrors")}
            </span>
          </div>
        )}

        {/* Expand button */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 text-sm w-full justify-center py-2.5 rounded-lg transition-colors hover:opacity-80"
          style={{ backgroundColor: "var(--card-elevated)", color: "var(--text-muted)" }}
        >
          {expanded ? (
            <>
              <ChevronUp className="w-4 h-4" />
              {t("agents.mood.hideDetails")}
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4" />
              {t("agents.mood.showDetails")}
            </>
          )}
        </button>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="p-4 pt-0 border-t" style={{ borderColor: "var(--border)" }}>
          <div className="grid grid-cols-2 gap-3 pt-4">
            <MetricItem 
              icon={Activity} 
              label={t("agents.mood.activities24h")} 
              value={current.metrics.activityCount.toString()} 
            />
            <MetricItem
              icon={TrendingUp}
              label={t("agents.mood.successRate")}
              value={`${current.metrics.successRate}%`}
              highlight={current.metrics.successRate < 80}
            />
            <MetricItem 
              icon={Zap} 
              label={t("agents.mood.tokensPerHour")} 
              value={formatNumber(current.metrics.avgTokensPerHour)} 
            />
            <MetricItem
              icon={AlertTriangle}
              label={t("agents.mood.errors24h")}
              value={current.metrics.errorCount.toString()}
              highlight={current.metrics.errorCount > 5}
            />
          </div>
          
          {/* History table */}
          <div className="mt-4 pt-4 border-t" style={{ borderColor: "var(--border)" }}>
            <p className="text-sm font-medium mb-3" style={{ color: "var(--text-primary)" }}>
              {t("agents.mood.last7Days")}
            </p>
            <div className="space-y-2">
              {history.slice().reverse().map((day) => (
                <div 
                  key={day.date} 
                  className="flex items-center justify-between py-1.5 px-2 rounded-lg"
                  style={{ backgroundColor: "var(--card-elevated)" }}
                >
                  <span style={{ color: "var(--text-secondary)" }}>
                    {new Date(day.date).toLocaleDateString(undefined, { 
                      weekday: "short", 
                      month: "short", 
                      day: "numeric" 
                    })}
                  </span>
                  <div className="flex items-center gap-2">
                    <span style={{ color: moodColors[day.mood] }}>{day.emoji}</span>
                    <span 
                      className="font-medium"
                      style={{ color: day.score >= 80 ? "#10b981" : day.score >= 50 ? "#f59e0b" : "#ef4444" }}
                    >
                      {day.score}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricItem({
  icon: Icon,
  label,
  value,
  highlight = false,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 p-2 rounded-lg" style={{ backgroundColor: "var(--card-elevated)" }}>
      <Icon className="w-4 h-4 flex-shrink-0" style={{ color: highlight ? "#ef4444" : "var(--text-muted)" }} />
      <div className="min-w-0">
        <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
          {label}
        </p>
        <p className="text-sm font-medium" style={{ color: highlight ? "#ef4444" : "var(--text-primary)" }}>
          {value}
        </p>
      </div>
    </div>
  );
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

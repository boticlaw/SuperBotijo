"use client";

import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Minus, Info, Loader2 } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useI18n } from "@/i18n/provider";

interface EfficiencyData {
  score: number;
  grade: string;
  components: {
    successRate: number;
    taskCompletion: number;
    tokenEfficiency: number;
  };
  breakdown: {
    totalActivities: number;
    successfulActivities: number;
    failedActivities: number;
    totalTokens: number;
    usefulTokens: number;
  };
  trend: "up" | "down" | "stable";
  trendPercent: number;
  history: Array<{
    date: string;
    score: number;
    activities: number;
    successRate: number;
  }>;
  period: string;
  timestamp: string;
}

function getGradeColor(grade: string): string {
  switch (grade) {
    case "A":
      return "var(--success)";
    case "B":
      return "#84cc16";
    case "C":
      return "var(--warning)";
    case "D":
      return "#f97316";
    case "F":
      return "var(--error)";
    default:
      return "var(--text-muted)";
  }
}

function getScoreColor(score: number): string {
  if (score >= 90) return "var(--success)";
  if (score >= 80) return "#84cc16";
  if (score >= 70) return "var(--warning)";
  if (score >= 60) return "#f97316";
  return "var(--error)";
}

type PeriodType = "7" | "14" | "30";

export function EfficiencyGauge() {
  const { t } = useI18n();
  const [data, setData] = useState<EfficiencyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodType>("7");
  const [showTooltip, setShowTooltip] = useState<string | null>(null);

  const [efficiencyScoreLabel, setEfficiencyScoreLabel] = useState("Efficiency Score");

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/costs/efficiency?days=${period}`);
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch (error) {
        console.error("Failed to fetch efficiency data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [period]);

  useEffect(() => {
    setEfficiencyScoreLabel(t("efficiency.efficiencyScore"));
  }, [t, efficiencyScoreLabel]);

  if (loading) {
    return (
      <div
        className="p-6 rounded-xl"
        style={{
          backgroundColor: "var(--card)",
          border: "1px solid var(--border)",
        }}
      >
        <div className="flex items-center justify-center gap-2 py-8">
          <Loader2
            className="w-5 h-5 animate-spin"
            style={{ color: "var(--accent)" }}
          />
          <span style={{ color: "var(--text-secondary)" }}>
            {t("efficiency.calculating")}
          </span>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div
        className="p-6 rounded-xl"
        style={{
          backgroundColor: "var(--card)",
          border: "1px solid var(--border)",
        }}
      >
        <h3
          className="text-lg font-semibold mb-4"
          style={{ color: "var(--text-primary)" }}
        >
          {t("efficiency.title")}
        </h3>
        <div className="text-center py-8">
          <p style={{ color: "var(--text-muted)" }}>
            {t("efficiency.noData")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="p-6 rounded-xl"
      style={{
        backgroundColor: "var(--card)",
        border: "1px solid var(--border)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3
            className="text-lg font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            {t("efficiency.title")}
          </h3>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            {t("efficiency.description")}
          </p>
        </div>

        {/* Period selector */}
        <div
          className="flex gap-1 p-1 rounded-lg"
          style={{ backgroundColor: "var(--card-elevated)" }}
        >
          {(["7", "14", "30"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className="px-3 py-1 rounded text-xs font-medium transition-all"
              style={{
                backgroundColor: period === p ? "var(--accent)" : "transparent",
                color: period === p ? "white" : "var(--text-secondary)",
              }}
            >
              {t("efficiency.days", { days: p })}
            </button>
          ))}
        </div>
      </div>

      {/* Main Score Display */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Gauge */}
        <div className="flex flex-col items-center justify-center">
          <div className="relative w-48 h-48">
            {/* Background circle */}
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="96"
                cy="96"
                r="88"
                fill="none"
                stroke="var(--card-elevated)"
                strokeWidth="12"
              />
              {/* Progress arc */}
              <circle
                cx="96"
                cy="96"
                r="88"
                fill="none"
                stroke={getScoreColor(data.score)}
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={`${(data.score / 100) * 553} 553`}
                style={{ transition: "stroke-dasharray 0.5s ease" }}
              />
            </svg>
            {/* Score text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div
                className="text-5xl font-bold"
                style={{ color: getScoreColor(data.score) }}
              >
                {data.score.toFixed(0)}
              </div>
              <div
                className="text-2xl font-bold mt-1"
                style={{ color: getGradeColor(data.grade) }}
              >
                {data.grade}
              </div>
            </div>
          </div>

          {/* Trend */}
          <div className="flex items-center gap-2 mt-4">
            {data.trend === "up" && (
              <>
                <TrendingUp className="w-4 h-4" style={{ color: "var(--success)" }} />
                <span style={{ color: "var(--success)" }}>
                  {t("efficiency.vsPrevious", { percent: data.trendPercent })}
                </span>
              </>
            )}
            {data.trend === "down" && (
              <>
                <TrendingDown className="w-4 h-4" style={{ color: "var(--error)" }} />
                <span style={{ color: "var(--error)" }}>
                  {t("efficiency.vsPrevious", { percent: data.trendPercent })}
                </span>
              </>
            )}
            {data.trend === "stable" && (
              <>
                <Minus className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
                <span style={{ color: "var(--text-muted)" }}>{t("efficiency.stable")}</span>
              </>
            )}
          </div>
        </div>

        {/* Components */}
        <div className="lg:col-span-2 space-y-4">
          <h4
            className="text-sm font-semibold uppercase tracking-wide"
            style={{ color: "var(--text-secondary)" }}
          >
            {t("efficiency.scoreComponents")}
          </h4>

          {/* Success Rate */}
          <div
            className="relative"
            onMouseEnter={() => setShowTooltip("successRate")}
            onMouseLeave={() => setShowTooltip(null)}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span style={{ color: "var(--text-primary)" }}>
                  {t("efficiency.successRate")}
                </span>
                <Info
                  className="w-3 h-3 cursor-help"
                  style={{ color: "var(--text-muted)" }}
                />
              </div>
              <span
                className="font-semibold"
                style={{ color: getScoreColor(data.components.successRate) }}
              >
                {data.components.successRate.toFixed(1)}%
              </span>
            </div>
            <div
              className="h-2 rounded-full overflow-hidden"
              style={{ backgroundColor: "var(--card-elevated)" }}
            >
              <div
                className="h-full transition-all duration-500"
                style={{
                  width: `${data.components.successRate}%`,
                  backgroundColor: getScoreColor(data.components.successRate),
                }}
              />
            </div>
            {showTooltip === "successRate" && (
              <div
                className="absolute z-10 p-2 rounded text-xs mt-1"
                style={{
                  backgroundColor: "var(--card-elevated)",
                  border: "1px solid var(--border)",
                  color: "var(--text-secondary)",
                }}
              >
                {t("efficiency.successRateTooltip")}
              </div>
            )}
          </div>

          {/* Task Completion */}
          <div
            className="relative"
            onMouseEnter={() => setShowTooltip("taskCompletion")}
            onMouseLeave={() => setShowTooltip(null)}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span style={{ color: "var(--text-primary)" }}>
                  {t("efficiency.taskCompletion")}
                </span>
                <Info
                  className="w-3 h-3 cursor-help"
                  style={{ color: "var(--text-muted)" }}
                />
              </div>
              <span
                className="font-semibold"
                style={{ color: getScoreColor(data.components.taskCompletion) }}
              >
                {data.components.taskCompletion.toFixed(1)}%
              </span>
            </div>
            <div
              className="h-2 rounded-full overflow-hidden"
              style={{ backgroundColor: "var(--card-elevated)" }}
            >
              <div
                className="h-full transition-all duration-500"
                style={{
                  width: `${data.components.taskCompletion}%`,
                  backgroundColor: getScoreColor(data.components.taskCompletion),
                }}
              />
            </div>
            {showTooltip === "taskCompletion" && (
              <div
                className="absolute z-10 p-2 rounded text-xs mt-1"
                style={{
                  backgroundColor: "var(--card-elevated)",
                  border: "1px solid var(--border)",
                  color: "var(--text-secondary)",
                }}
              >
                {t("efficiency.taskCompletionTooltip")}
              </div>
            )}
          </div>

          {/* Token Efficiency */}
          <div
            className="relative"
            onMouseEnter={() => setShowTooltip("tokenEfficiency")}
            onMouseLeave={() => setShowTooltip(null)}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span style={{ color: "var(--text-primary)" }}>
                  {t("efficiency.tokenEfficiency")}
                </span>
                <Info
                  className="w-3 h-3 cursor-help"
                  style={{ color: "var(--text-muted)" }}
                />
              </div>
              <span
                className="font-semibold"
                style={{ color: getScoreColor(data.components.tokenEfficiency) }}
              >
                {data.components.tokenEfficiency.toFixed(1)}%
              </span>
            </div>
            <div
              className="h-2 rounded-full overflow-hidden"
              style={{ backgroundColor: "var(--card-elevated)" }}
            >
              <div
                className="h-full transition-all duration-500"
                style={{
                  width: `${data.components.tokenEfficiency}%`,
                  backgroundColor: getScoreColor(data.components.tokenEfficiency),
                }}
              />
            </div>
            {showTooltip === "tokenEfficiency" && (
              <div
                className="absolute z-10 p-2 rounded text-xs mt-1"
                style={{
                  backgroundColor: "var(--card-elevated)",
                  border: "1px solid var(--border)",
                  color: "var(--text-secondary)",
                }}
              >
                {t("efficiency.tokenEfficiencyTooltip")}
              </div>
            )}
          </div>

          {/* Breakdown */}
          <div className="mt-4 pt-4 grid grid-cols-2 gap-4" style={{ borderTop: "1px solid var(--border)" }}>
            <div>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {t("efficiency.totalActivities")}
              </p>
              <p
                className="text-lg font-semibold"
                style={{ color: "var(--text-primary)" }}
              >
                {data.breakdown.totalActivities.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {t("efficiency.successFailed")}
              </p>
              <p
                className="text-lg font-semibold"
                style={{ color: "var(--text-primary)" }}
              >
                <span style={{ color: "var(--success)" }}>
                  {data.breakdown.successfulActivities}
                </span>
                {" / "}
                <span style={{ color: "var(--error)" }}>
                  {data.breakdown.failedActivities}
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* History Chart */}
      {data.history && data.history.length > 0 && (
        <div>
          <h4
            className="text-sm font-semibold uppercase tracking-wide mb-4"
            style={{ color: "var(--text-secondary)" }}
          >
            {t("efficiency.trendHistory", { days: period })}
          </h4>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data.history}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="date"
                stroke="var(--text-muted)"
                style={{ fontSize: "12px" }}
              />
              <YAxis
                stroke="var(--text-muted)"
                style={{ fontSize: "12px" }}
                domain={[0, 100]}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--card-elevated)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                }}
              />
              <Line
                type="monotone"
                dataKey="score"
                stroke="var(--accent)"
                strokeWidth={2}
                dot={{ fill: "var(--accent)", r: 4 }}
                name={efficiencyScoreLabel}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Formula explanation */}
      <div
        className="mt-4 pt-4 text-xs"
        style={{ borderTop: "1px solid var(--border)", color: "var(--text-muted)" }}
      >
        <p>
          <strong>{t("efficiency.formula")}</strong> {t("efficiency.formulaText")}
        </p>
      </div>
    </div>
  );
}

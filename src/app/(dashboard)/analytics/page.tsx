"use client";

import { useCallback, useEffect, useState } from "react";
import { ActivityLineChart } from "@/components/charts/ActivityLineChart";
import { ActivityPieChart } from "@/components/charts/ActivityPieChart";
import { HourlyHeatmap } from "@/components/charts/HourlyHeatmap";
import { SuccessRateGauge } from "@/components/charts/SuccessRateGauge";
import { TopTasksList } from "@/components/TopTasksList";
import { EfficiencyGauge } from "@/components/EfficiencyGauge";
import { ScheduledTasksManager } from "@/components/ScheduledTasksManager";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useI18n } from "@/i18n/provider";
import { BarChart3, TrendingUp, Clock, Target, DollarSign, RefreshCw, Loader2, AlertCircle, TrendingDown, AlertTriangle, Pencil, Check, X } from "lucide-react";
import { LineChart, Line, BarChart, Bar, PieChart as RePieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { MODEL_PRICING } from "@/lib/pricing-types";

// Helper to get model name (client-side)
function getModelName(modelId: string): string {
  const pricing = MODEL_PRICING.find((p) => p.id === modelId || p.alias === modelId);
  return pricing?.name || modelId;
}

interface AnalyticsData {
  byDay: { date: string; count: number }[];
  byType: { type: string; count: number }[];
  byHour: { hour: number; day: number; count: number }[];
  successRate: number;
}

interface CostData {
  today: number;
  yesterday: number;
  thisMonth: number;
  lastMonth: number;
  projected: number;
  budget: number;
  byAgent: Array<{ agent: string; cost: number; tokens: number }>;
  byModel: Array<{ model: string; cost: number; tokens: number }>;
  daily: Array<{ date: string; cost: number; input: number; output: number }>;
  hourly: Array<{ hour: string; cost: number }>;
}

const COLORS = ['#FF3B30', '#FF9500', '#FFCC00', '#34C759', '#00C7BE', '#30B0C7', '#32ADE6', '#007AFF', '#5856D6', '#AF52DE', '#FF2D55'];

type Tab = "overview" | "costs";

export default function AnalyticsPage() {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const [costData, setCostData] = useState<CostData | null>(null);
  const [costLoading, setCostLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<"7d" | "30d" | "90d">("30d");
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState("");
  const [savingBudget, setSavingBudget] = useState(false);

  useEffect(() => {
    fetch("/api/analytics")
      .then((r) => r.json())
      .then((data) => {
        setData(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const fetchCostData = useCallback(async () => {
    setCostLoading(true);
    try {
      const res = await fetch(`/api/costs?timeframe=${timeframe}`);
      if (res.ok) {
        const cData = await res.json();
        setCostData(cData);
      }
    } catch (error) {
      console.error("Failed to fetch cost data:", error);
    } finally {
      setCostLoading(false);
    }
  }, [timeframe]);

  // Fetch cost data when timeframe changes or when switching to costs tab
  useEffect(() => {
    if (activeTab === "costs") {
      fetchCostData();
    }
  }, [activeTab, timeframe, fetchCostData]);

  const saveBudget = useCallback(async () => {
    const newBudget = parseFloat(budgetInput);
    if (isNaN(newBudget) || newBudget <= 0) return;

    setSavingBudget(true);
    try {
      const res = await fetch("/api/costs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ budget: newBudget }),
      });
      if (res.ok) {
        const data = await res.json();
        if (costData) {
          setCostData({ ...costData, budget: data.budget });
        }
        setEditingBudget(false);
      }
    } catch (error) {
      console.error("Failed to save budget:", error);
    } finally {
      setSavingBudget(false);
    }
  }, [budgetInput, costData]);

  const tabs: Array<{ id: Tab; label: string; icon: typeof BarChart3 }> = [
    { id: "overview", label: t("analytics.overview"), icon: BarChart3 },
    { id: "costs", label: t("analytics.costs"), icon: DollarSign },
  ];

  return (
    <ErrorBoundary>
      <div className="p-4 md:p-8" style={{ backgroundColor: "var(--background)", minHeight: "100vh" }}>
        <div className="mb-4 md:mb-6">
        <h1
          className="text-2xl md:text-3xl font-bold mb-2"
          style={{ color: "var(--text-primary)", fontFamily: "var(--font-heading)" }}
        >
          {t("analytics.title")}
        </h1>
        <p className="text-sm md:text-base" style={{ color: "var(--text-secondary)" }}>
          {t("analytics.subtitle")}
        </p>
      </div>

      <div className="flex gap-2 mb-6 border-b" style={{ borderColor: "var(--border)" }}>
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className="flex items-center gap-2 px-4 py-2 font-medium transition-all"
            style={{
              color: activeTab === id ? "var(--accent)" : "var(--text-secondary)",
              borderBottom: activeTab === id ? "2px solid var(--accent)" : "2px solid transparent",
              borderLeft: "none",
              borderRight: "none",
              borderTop: "none",
              background: "none",
              cursor: "pointer",
              paddingBottom: "0.5rem",
            }}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <>
          {loading ? (
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="flex flex-col items-center gap-4">
                <div
                  className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
                  style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }}
                />
                <span style={{ color: "var(--text-secondary)" }}>{t("analytics.loading")}</span>
              </div>
            </div>
          ) : !data ? (
            <div className="p-4">
              <p style={{ color: "var(--error)" }}>{t("analytics.loadError")}</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-4 md:mb-6">
                <div
                  className="rounded-xl p-3 md:p-4"
                  style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
                >
                  <p className="text-xs md:text-sm mb-1" style={{ color: "var(--text-secondary)" }}>{t("analytics.totalThisWeek")}</p>
                  <p className="text-xl md:text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
                    {data.byDay.reduce((sum, d) => sum + d.count, 0)}
                  </p>
                </div>
                <div
                  className="rounded-xl p-3 md:p-4"
                  style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
                >
                  <p className="text-xs md:text-sm mb-1" style={{ color: "var(--text-secondary)" }}>{t("analytics.mostActiveDay")}</p>
                  <p className="text-xl md:text-2xl font-bold" style={{ color: "var(--accent)" }}>
                    {data.byDay.reduce((max, d) => (d.count > max.count ? d : max), data.byDay[0])?.date || "-"}
                  </p>
                </div>
                <div
                  className="rounded-xl p-3 md:p-4"
                  style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
                >
                  <p className="text-xs md:text-sm mb-1" style={{ color: "var(--text-secondary)" }}>{t("analytics.topActivityType")}</p>
                  <p className="text-xl md:text-2xl font-bold capitalize" style={{ color: "var(--info)" }}>
                    {data.byType[0]?.type || "-"}
                  </p>
                </div>
                <div
                  className="rounded-xl p-3 md:p-4"
                  style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
                >
                  <p className="text-xs md:text-sm mb-1" style={{ color: "var(--text-secondary)" }}>{t("analytics.successRate")}</p>
                  <p className="text-xl md:text-2xl font-bold" style={{ color: "var(--success)" }}>
                    {data.successRate.toFixed(0)}%
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                <div
                  className="rounded-xl p-4 md:p-6"
                  style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
                >
                  <div className="flex items-center gap-2 md:gap-3 mb-4 md:mb-6">
                    <TrendingUp className="w-4 h-4 md:w-5 md:h-5" style={{ color: "var(--accent)" }} />
                    <h2
                      className="text-lg md:text-xl font-bold"
                      style={{ color: "var(--text-primary)", fontFamily: "var(--font-heading)" }}
                    >
                      {t("analytics.activityOverTime")}
                    </h2>
                  </div>
                  <ActivityLineChart data={data.byDay} />
                </div>

                <div
                  className="rounded-xl p-4 md:p-6"
                  style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
                >
                  <div className="flex items-center gap-2 md:gap-3 mb-4 md:mb-6">
                    <BarChart3 className="w-4 h-4 md:w-5 md:h-5" style={{ color: "var(--accent)" }} />
                    <h2
                      className="text-lg md:text-xl font-bold"
                      style={{ color: "var(--text-primary)", fontFamily: "var(--font-heading)" }}
                    >
                      {t("analytics.activityByType")}
                    </h2>
                  </div>
                  <ActivityPieChart data={data.byType} />
                </div>

                <div
                  className="rounded-xl p-4 md:p-6"
                  style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
                >
                  <div className="flex items-center gap-2 md:gap-3 mb-4 md:mb-6">
                    <Clock className="w-4 h-4 md:w-5 md:h-5" style={{ color: "var(--accent)" }} />
                    <h2
                      className="text-lg md:text-xl font-bold"
                      style={{ color: "var(--text-primary)", fontFamily: "var(--font-heading)" }}
                    >
                      {t("analytics.activityByHour")}
                    </h2>
                  </div>
                  <HourlyHeatmap data={data.byHour} />
                </div>

                <div
                  className="rounded-xl p-4 md:p-6"
                  style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
                >
                  <div className="flex items-center gap-2 md:gap-3 mb-4 md:mb-6">
                    <Target className="w-4 h-4 md:w-5 md:h-5" style={{ color: "var(--accent)" }} />
                    <h2
                      className="text-lg md:text-xl font-bold"
                      style={{ color: "var(--text-primary)", fontFamily: "var(--font-heading)" }}
                    >
                      {t("analytics.successRate")}
                    </h2>
                  </div>
                  <SuccessRateGauge rate={data.successRate} />
                </div>
              </div>
            </>
          )}

          {/* Scheduled Tasks Manager - visible in overview */}
          {activeTab === "overview" && (
            <div className="mt-6">
              <ScheduledTasksManager />
            </div>
          )}
        </>
      )}

      {activeTab === "costs" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex gap-2 p-1 rounded-lg" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
              {(["7d", "30d", "90d"] as const).map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className="px-4 py-2 rounded-md text-sm font-medium transition-all"
                  style={{
                    backgroundColor: timeframe === tf ? "var(--accent)" : "transparent",
                    color: timeframe === tf ? "white" : "var(--text-secondary)",
                  }}
                >
                  {tf === "7d" ? t("analytics.days7") : tf === "30d" ? t("analytics.days30") : t("analytics.days90")}
                </button>
              ))}
            </div>
            <button
              onClick={fetchCostData}
              disabled={costLoading}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm"
              style={{
                backgroundColor: "var(--card)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
                cursor: costLoading ? "wait" : "pointer",
              }}
            >
              <RefreshCw size={14} className={costLoading ? "animate-spin" : ""} />
            </button>
          </div>

          {costLoading && !costData ? (
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: "var(--accent)" }}></div>
                <p style={{ color: "var(--text-secondary)" }}>{t("analytics.loadingCosts")}</p>
              </div>
            </div>
          ) : !costData ? (
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="text-center">
                <DollarSign className="w-16 h-16 mx-auto mb-4" style={{ color: "var(--text-muted)" }} />
                <p style={{ color: "var(--text-secondary)" }}>{t("analytics.loadCostsError")}</p>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-6 rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{t("analytics.costToday")}</span>
                    {costData.yesterday > 0 && (
                      <div className="flex items-center gap-1">
                        {((costData.today - costData.yesterday) / costData.yesterday) * 100 > 0 ? (
                          <TrendingUp className="w-3 h-3" style={{ color: "var(--error)" }} />
                        ) : (
                          <TrendingDown className="w-3 h-3" style={{ color: "var(--success)" }} />
                        )}
                      </div>
                    )}
                  </div>
                  <div className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>
                    ${costData.today.toFixed(2)}
                  </div>
                  <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                    {t("analytics.vsYesterday", { amount: costData.yesterday.toFixed(2) })}
                  </p>
                </div>

                <div className="p-6 rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
                  <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{t("analytics.costThisMonth")}</span>
                  <div className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>
                    ${costData.thisMonth.toFixed(2)}
                  </div>
                  <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                    {t("analytics.vsLastMonth", { amount: costData.lastMonth.toFixed(2) })}
                  </p>
                </div>

                <div className="p-6 rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
                  <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{t("analytics.projectedEom")}</span>
                  <div className="text-3xl font-bold" style={{ color: "var(--warning)" }}>
                    ${costData.projected.toFixed(2)}
                  </div>
                  <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                    {t("analytics.basedOnPace")}
                  </p>
                </div>

                <div className="p-6 rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{t("analytics.budget")}</span>
                    <div className="flex items-center gap-2">
                      {(costData.thisMonth / costData.budget) * 100 > 80 && (
                        <AlertTriangle className="w-4 h-4" style={{ color: "var(--error)" }} />
                      )}
                      {!editingBudget && (
                        <button
                          onClick={() => {
                            setBudgetInput(costData.budget.toString());
                            setEditingBudget(true);
                          }}
                          className="p-1 rounded hover:bg-white/10 transition-colors"
                          title={t("analytics.editBudget")}
                        >
                          <Pencil className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="text-3xl font-bold" style={{ color: (costData.thisMonth / costData.budget) * 100 < 60 ? "var(--success)" : (costData.thisMonth / costData.budget) * 100 < 85 ? "var(--warning)" : "var(--error)" }}>
                    {((costData.thisMonth / costData.budget) * 100).toFixed(0)}%
                  </div>
                  <div className="mt-2 h-2 rounded-full overflow-hidden" style={{ backgroundColor: "var(--card-elevated)" }}>
                    <div
                      className="h-full transition-all duration-500"
                      style={{ width: `${Math.min((costData.thisMonth / costData.budget) * 100, 100)}%`, backgroundColor: (costData.thisMonth / costData.budget) * 100 < 60 ? "var(--success)" : (costData.thisMonth / costData.budget) * 100 < 85 ? "var(--warning)" : "var(--error)" }}
                    />
                  </div>
                  {editingBudget ? (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>$</span>
                      <input
                        type="number"
                        value={budgetInput}
                        onChange={(e) => setBudgetInput(e.target.value)}
                        className="flex-1 px-2 py-1 text-sm rounded"
                        style={{
                          backgroundColor: "var(--card-elevated)",
                          border: "1px solid var(--accent)",
                          color: "var(--text-primary)",
                        }}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveBudget();
                          if (e.key === "Escape") setEditingBudget(false);
                        }}
                      />
                      <button
                        onClick={saveBudget}
                        disabled={savingBudget}
                        className="p-1 rounded hover:bg-green-500/20 transition-colors"
                        title="Save"
                      >
                        {savingBudget ? (
                          <Loader2 className="w-3 h-3 animate-spin" style={{ color: "var(--success)" }} />
                        ) : (
                          <Check className="w-3 h-3" style={{ color: "var(--success)" }} />
                        )}
                      </button>
                      <button
                        onClick={() => setEditingBudget(false)}
                        className="p-1 rounded hover:bg-red-500/20 transition-colors"
                        title="Cancel"
                      >
                        <X className="w-3 h-3" style={{ color: "var(--error)" }} />
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                      ${costData.thisMonth.toFixed(2)} / ${costData.budget.toFixed(2)}
                    </p>
                  )}
                </div>
              </div>

              <EfficiencyGauge />

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="p-6 rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
                  <h3 className="text-lg font-semibold mb-4" style={{ color: "var(--text-primary)" }}>
                    {t("analytics.dailyCostTrend")}
                  </h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={costData.daily}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="date" stroke="var(--text-muted)" style={{ fontSize: "12px" }} />
                      <YAxis stroke="var(--text-muted)" style={{ fontSize: "12px" }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--card-elevated)",
                          border: "1px solid var(--border)",
                          borderRadius: "8px",
                        }}
                      />
                      <Legend />
                      <Line type="monotone" dataKey="cost" stroke="var(--accent)" strokeWidth={2} name="Cost ($)" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="p-6 rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
                  <h3 className="text-lg font-semibold mb-4" style={{ color: "var(--text-primary)" }}>
                    {t("analytics.costByAgent")}
                  </h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={costData.byAgent}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="agent" stroke="var(--text-muted)" style={{ fontSize: "12px" }} />
                      <YAxis stroke="var(--text-muted)" style={{ fontSize: "12px" }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--card-elevated)",
                          border: "1px solid var(--border)",
                          borderRadius: "8px",
                        }}
                      />
                      <Bar dataKey="cost" fill="var(--accent)" name="Cost ($)" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="p-6 rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
                  <h3 className="text-lg font-semibold mb-4" style={{ color: "var(--text-primary)" }}>
                    {t("analytics.costByModel")}
                  </h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <RePieChart>
                      <Pie
                        data={costData.byModel.map((m) => ({ ...m, friendlyName: getModelName(m.model) }))}
                        dataKey="cost"
                        nameKey="friendlyName"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label={(entry) => `${entry.friendlyName}: $${entry.cost.toFixed(2)}`}
                      >
                        {costData.byModel.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--card-elevated)",
                          border: "1px solid var(--border)",
                          borderRadius: "8px",
                        }}
                      />
                    </RePieChart>
                  </ResponsiveContainer>
                </div>

                <div className="p-6 rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
                  <h3 className="text-lg font-semibold mb-4" style={{ color: "var(--text-primary)" }}>
                    {t("analytics.tokenUsageDaily")}
                  </h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={costData.daily}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="date" stroke="var(--text-muted)" style={{ fontSize: "12px" }} />
                      <YAxis stroke="var(--text-muted)" style={{ fontSize: "12px" }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--card-elevated)",
                          border: "1px solid var(--border)",
                          borderRadius: "8px",
                        }}
                      />
                      <Legend />
                      <Bar dataKey="input" stackId="a" fill="#60A5FA" name="Input Tokens" />
                      <Bar dataKey="output" stackId="a" fill="#F59E0B" name="Output Tokens" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <TopTasksList />

              <div className="p-6 rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
                <h3 className="text-lg font-semibold mb-4" style={{ color: "var(--text-primary)" }}>
                  {t("analytics.modelPricing")}
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--border)" }}>
                        <th className="text-left py-3 px-4 text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Model</th>
                        <th className="text-right py-3 px-4 text-sm font-medium" style={{ color: "var(--text-secondary)" }}>{t("analytics.input")}</th>
                        <th className="text-right py-3 px-4 text-sm font-medium" style={{ color: "var(--text-secondary)" }}>{t("analytics.output")}</th>
                        <th className="text-right py-3 px-4 text-sm font-medium" style={{ color: "var(--text-secondary)" }}>{t("analytics.cacheRead")}</th>
                        <th className="text-right py-3 px-4 text-sm font-medium" style={{ color: "var(--text-secondary)" }}>{t("analytics.cacheWrite")}</th>
                        <th className="text-right py-3 px-4 text-sm font-medium" style={{ color: "var(--text-secondary)" }}>{t("analytics.context")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {MODEL_PRICING.map((model) => (
                        <tr key={model.id} style={{ borderBottom: "1px solid var(--border)" }}>
                          <td className="py-3 px-4">
                            <span className="font-medium" style={{ color: "var(--text-primary)" }}>{model.name}</span>
                          </td>
                          <td className="py-3 px-4 text-right" style={{ color: "var(--text-primary)" }}>${model.inputPricePerMillion}</td>
                          <td className="py-3 px-4 text-right" style={{ color: "var(--text-primary)" }}>${model.outputPricePerMillion}</td>
                          <td className="py-3 px-4 text-right" style={{ color: "var(--text-secondary)" }}>
                            {model.cacheReadPricePerMillion ? `$${model.cacheReadPricePerMillion}` : "-"}
                          </td>
                          <td className="py-3 px-4 text-right" style={{ color: "var(--text-secondary)" }}>
                            {model.cacheWritePricePerMillion ? `$${model.cacheWritePricePerMillion}` : "-"}
                          </td>
                          <td className="py-3 px-4 text-right" style={{ color: "var(--text-muted)" }}>{(model.contextWindow / 1000).toFixed(0)}k</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="p-6 rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
                <h3 className="text-lg font-semibold mb-4" style={{ color: "var(--text-primary)" }}>
                  {t("analytics.detailedBreakdown")}
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--border)" }}>
                        <th className="text-left py-3 px-4 text-sm font-medium" style={{ color: "var(--text-secondary)" }}>{t("analytics.agent")}</th>
                        <th className="text-right py-3 px-4 text-sm font-medium" style={{ color: "var(--text-secondary)" }}>{t("analytics.tokensCol")}</th>
                        <th className="text-right py-3 px-4 text-sm font-medium" style={{ color: "var(--text-secondary)" }}>{t("analytics.cost")}</th>
                        <th className="text-right py-3 px-4 text-sm font-medium" style={{ color: "var(--text-secondary)" }}>{t("analytics.percentOfTotal")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {costData.byAgent.map((agent) => {
                        const percent = (agent.cost / costData.thisMonth) * 100;
                        return (
                          <tr key={agent.agent} style={{ borderBottom: "1px solid var(--border)" }}>
                            <td className="py-3 px-4">
                              <span className="font-medium" style={{ color: "var(--text-primary)" }}>{agent.agent}</span>
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-sm" style={{ color: "var(--text-secondary)" }}>
                              {agent.tokens.toLocaleString()}
                            </td>
                            <td className="py-3 px-4 text-right font-semibold" style={{ color: "var(--text-primary)" }}>
                              ${agent.cost.toFixed(2)}
                            </td>
                            <td className="py-3 px-4 text-right" style={{ color: "var(--text-secondary)" }}>
                              {percent.toFixed(1)}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}
      </div>
    </ErrorBoundary>
  );
}

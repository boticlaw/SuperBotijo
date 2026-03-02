"use client";

import { useCallback, useEffect, useState } from "react";
import { ActivityLineChart } from "@/components/charts/ActivityLineChart";
import { ActivityPieChart } from "@/components/charts/ActivityPieChart";
import { HourlyHeatmap } from "@/components/charts/HourlyHeatmap";
import { SuccessRateGauge } from "@/components/charts/SuccessRateGauge";
import { TopTasksList } from "@/components/TopTasksList";
import { EfficiencyGauge } from "@/components/EfficiencyGauge";
import { TokenFlowSankey, TaskFlowSankey, TimeFlowSankey } from "@/components/sankey/SankeyDiagrams";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { BarChart3, TrendingUp, Clock, Target, GitBranch, DollarSign, RefreshCw, Loader2, AlertCircle, TrendingDown, AlertTriangle, Pencil, Check, X } from "lucide-react";
import { LineChart, Line, BarChart, Bar, PieChart as RePieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { MODEL_PRICING, getModelName } from "@/lib/pricing";

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

interface SankeyData {
  nodes: Array<{ name: string }>;
  links: Array<{ source: number; target: number; value: number }>;
}

const COLORS = ['#FF3B30', '#FF9500', '#FFCC00', '#34C759', '#00C7BE', '#30B0C7', '#32ADE6', '#007AFF', '#5856D6', '#AF52DE', '#FF2D55'];

type Tab = "overview" | "flows" | "costs";
type FlowType = "token" | "task" | "time";
type Period = "day" | "week" | "month";

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const [costData, setCostData] = useState<CostData | null>(null);
  const [costLoading, setCostLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<"7d" | "30d" | "90d">("30d");
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState("");
  const [savingBudget, setSavingBudget] = useState(false);

  const [flowType, setFlowType] = useState<FlowType>("token");
  const [period, setPeriod] = useState<Period>("week");
  const [flowData, setFlowData] = useState<SankeyData | null>(null);
  const [flowLoading, setFlowLoading] = useState(true);
  const [flowError, setFlowError] = useState<string | null>(null);

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

  useEffect(() => {
    fetchCostData();
  }, [fetchCostData]);

  const fetchFlowData = useCallback(async () => {
    setFlowLoading(true);
    setFlowError(null);
    try {
      const res = await fetch(`/api/analytics/${flowType}-flow?period=${period}`);
      if (!res.ok) throw new Error("Failed to load data");
      const fData = await res.json();
      setFlowData(fData);
    } catch (err) {
      setFlowError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setFlowLoading(false);
    }
  }, [flowType, period]);

  useEffect(() => {
    if (activeTab === "flows") {
      fetchFlowData();
    }
  }, [fetchFlowData, activeTab]);

  const tabs: Array<{ id: Tab; label: string; icon: typeof BarChart3 }> = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "flows", label: "Flows", icon: GitBranch },
    { id: "costs", label: "Costs", icon: DollarSign },
  ];

  const flowTabs: Array<{ id: FlowType; label: string; icon: string }> = [
    { id: "token", label: "Token Flow", icon: "📊" },
    { id: "task", label: "Task Flow", icon: "✅" },
    { id: "time", label: "Time Flow", icon: "⏰" },
  ];

  return (
    <ErrorBoundary>
      <div className="p-4 md:p-8" style={{ backgroundColor: "var(--background)", minHeight: "100vh" }}>
        <div className="mb-4 md:mb-6">
        <h1
          className="text-2xl md:text-3xl font-bold mb-2"
          style={{ color: "var(--text-primary)", fontFamily: "var(--font-heading)" }}
        >
          📊 Analytics
        </h1>
        <p className="text-sm md:text-base" style={{ color: "var(--text-secondary)" }}>
          Insights, trends, and costs from agent activity
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
              background: "none",
              border: "none",
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
                <span style={{ color: "var(--text-secondary)" }}>Loading analytics...</span>
              </div>
            </div>
          ) : !data ? (
            <div className="p-4">
              <p style={{ color: "var(--error)" }}>Failed to load analytics data</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-4 md:mb-6">
                <div
                  className="rounded-xl p-3 md:p-4"
                  style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
                >
                  <p className="text-xs md:text-sm mb-1" style={{ color: "var(--text-secondary)" }}>Total This Week</p>
                  <p className="text-xl md:text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
                    {data.byDay.reduce((sum, d) => sum + d.count, 0)}
                  </p>
                </div>
                <div
                  className="rounded-xl p-3 md:p-4"
                  style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
                >
                  <p className="text-xs md:text-sm mb-1" style={{ color: "var(--text-secondary)" }}>Most Active Day</p>
                  <p className="text-xl md:text-2xl font-bold" style={{ color: "var(--accent)" }}>
                    {data.byDay.reduce((max, d) => (d.count > max.count ? d : max), data.byDay[0])?.date || "-"}
                  </p>
                </div>
                <div
                  className="rounded-xl p-3 md:p-4"
                  style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
                >
                  <p className="text-xs md:text-sm mb-1" style={{ color: "var(--text-secondary)" }}>Top Activity Type</p>
                  <p className="text-xl md:text-2xl font-bold capitalize" style={{ color: "var(--info)" }}>
                    {data.byType[0]?.type || "-"}
                  </p>
                </div>
                <div
                  className="rounded-xl p-3 md:p-4"
                  style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
                >
                  <p className="text-xs md:text-sm mb-1" style={{ color: "var(--text-secondary)" }}>Success Rate</p>
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
                      Activity Over Time
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
                      Activity by Type
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
                      Activity by Hour
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
                      Success Rate
                    </h2>
                  </div>
                  <SuccessRateGauge rate={data.successRate} />
                </div>
              </div>
            </>
          )}
        </>
      )}

      {activeTab === "flows" && (
        <div>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div className="flex gap-2 p-1 rounded-lg" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
              {flowTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setFlowType(tab.id)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-all"
                  style={{
                    backgroundColor: flowType === tab.id ? "var(--accent)" : "transparent",
                    color: flowType === tab.id ? "var(--bg)" : "var(--text-secondary)",
                  }}
                >
                  <span>{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value as Period)}
                className="px-3 py-2 rounded-lg text-sm"
                style={{
                  backgroundColor: "var(--card)",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                }}
              >
                <option value="day">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
              </select>
              <button
                onClick={fetchFlowData}
                disabled={flowLoading}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm"
                style={{
                  backgroundColor: "var(--card)",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                  cursor: flowLoading ? "wait" : "pointer",
                }}
              >
                <RefreshCw size={14} className={flowLoading ? "animate-spin" : ""} />
              </button>
            </div>
          </div>

          <div
            className="rounded-xl p-6 min-h-[400px]"
            style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
          >
            {flowLoading ? (
              <div className="flex items-center justify-center h-[300px]">
                <div className="text-center">
                  <Loader2 size={32} className="animate-spin mb-3" style={{ color: "var(--accent)" }} />
                  <p style={{ color: "var(--text-muted)" }}>Loading flow data...</p>
                </div>
              </div>
            ) : flowError ? (
              <div className="flex items-center justify-center h-[300px]">
                <div className="text-center">
                  <AlertCircle size={32} className="mb-3" style={{ color: "var(--error)" }} />
                  <p style={{ color: "var(--error)" }}>{flowError}</p>
                </div>
              </div>
            ) : flowData ? (
              <>
                {flowType === "token" && <TokenFlowSankey data={flowData} />}
                {flowType === "task" && <TaskFlowSankey data={flowData} />}
                {flowType === "time" && <TimeFlowSankey data={flowData} />}
              </>
            ) : null}
          </div>
        </div>
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
                  {tf === "7d" ? "7 days" : tf === "30d" ? "30 days" : "90 days"}
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
                <p style={{ color: "var(--text-secondary)" }}>Loading cost data...</p>
              </div>
            </div>
          ) : !costData ? (
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="text-center">
                <DollarSign className="w-16 h-16 mx-auto mb-4" style={{ color: "var(--text-muted)" }} />
                <p style={{ color: "var(--text-secondary)" }}>Failed to load cost data</p>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-6 rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Today</span>
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
                    vs ${costData.yesterday.toFixed(2)} yesterday
                  </p>
                </div>

                <div className="p-6 rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
                  <span className="text-sm" style={{ color: "var(--text-secondary)" }}>This Month</span>
                  <div className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>
                    ${costData.thisMonth.toFixed(2)}
                  </div>
                  <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                    vs ${costData.lastMonth.toFixed(2)} last month
                  </p>
                </div>

                <div className="p-6 rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
                  <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Projected (EOM)</span>
                  <div className="text-3xl font-bold" style={{ color: "var(--warning)" }}>
                    ${costData.projected.toFixed(2)}
                  </div>
                  <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                    Based on current pace
                  </p>
                </div>

                <div className="p-6 rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Budget</span>
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
                          title="Edit budget"
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
                    Daily Cost Trend
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
                    Cost by Agent
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
                    Cost by Model
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
                    Token Usage (Daily)
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
                  Model Pricing (per 1M tokens)
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--border)" }}>
                        <th className="text-left py-3 px-4 text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Model</th>
                        <th className="text-right py-3 px-4 text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Input</th>
                        <th className="text-right py-3 px-4 text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Output</th>
                        <th className="text-right py-3 px-4 text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Cache Read</th>
                        <th className="text-right py-3 px-4 text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Cache Write</th>
                        <th className="text-right py-3 px-4 text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Context</th>
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
                  Detailed Breakdown by Agent
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--border)" }}>
                        <th className="text-left py-3 px-4 text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Agent</th>
                        <th className="text-right py-3 px-4 text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Tokens</th>
                        <th className="text-right py-3 px-4 text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Cost</th>
                        <th className="text-right py-3 px-4 text-sm font-medium" style={{ color: "var(--text-secondary)" }}>% of Total</th>
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

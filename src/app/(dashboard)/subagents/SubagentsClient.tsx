"use client";

import { useEffect, useState } from "react";
import { SubAgentCard } from "@/components/SubAgentCard";
import { SubAgentTimeline } from "@/components/SubAgentTimeline";
import {
  Bot,
  Activity,
  Clock,
  Zap,
  CheckCircle,
  Loader2,
  Filter,
} from "lucide-react";
import type { SubagentInfo, TimelineEvent, SubagentMetrics } from "@/operations/subagent-ops";

export interface SubagentsInitialData {
  subagents: SubagentInfo[];
  timeline: TimelineEvent[];
  metrics: SubagentMetrics;
  timestamp: string;
}

type StatusFilter = "all" | "active" | "idle" | "completed" | "failed";

export default function SubagentsClient({ initialData }: { initialData: SubagentsInitialData }) {
  const [data, setData] = useState<SubagentsInitialData>(initialData);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [modelFilter, setModelFilter] = useState<string>("all");

  useEffect(() => {
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/subagents");
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (error) {
      console.error("Failed to fetch subagents:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2
            className="w-12 h-12 animate-spin mx-auto mb-4"
            style={{ color: "var(--accent)" }}
          />
          <p style={{ color: "var(--text-secondary)" }}>
            Loading sub-agents...
          </p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Bot
            className="w-16 h-16 mx-auto mb-4"
            style={{ color: "var(--text-muted)" }}
          />
          <p style={{ color: "var(--text-secondary)" }}>
            Failed to load sub-agent data
          </p>
        </div>
      </div>
    );
  }

  const models = Array.from(new Set(data.subagents.map(s => s.model)));

  const filteredSubagents = data.subagents.filter(s => {
    if (statusFilter !== "all" && s.status !== statusFilter) return false;
    if (modelFilter !== "all" && s.model !== modelFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1
          className="text-3xl font-bold mb-2"
          style={{
            fontFamily: "var(--font-heading)",
            color: "var(--text-primary)",
          }}
        >
          Sub-Agent Dashboard
        </h1>
        <p style={{ color: "var(--text-secondary)" }}>
          Real-time monitoring of active sub-agents and their tasks
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div
          className="p-4 rounded-xl"
          style={{
            backgroundColor: "var(--card)",
            border: "1px solid var(--border)",
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Total
            </span>
            <Bot className="w-4 h-4" style={{ color: "var(--accent)" }} />
          </div>
          <div
            className="text-2xl font-bold"
            style={{ color: "var(--text-primary)" }}
          >
            {data.metrics.total}
          </div>
        </div>

        <div
          className="p-4 rounded-xl"
          style={{
            backgroundColor: "var(--card)",
            border: "1px solid var(--border)",
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Active
            </span>
            <Activity className="w-4 h-4" style={{ color: "var(--success)" }} />
          </div>
          <div
            className="text-2xl font-bold"
            style={{ color: "var(--success)" }}
          >
            {data.metrics.active}
          </div>
        </div>

        <div
          className="p-4 rounded-xl"
          style={{
            backgroundColor: "var(--card)",
            border: "1px solid var(--border)",
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Idle
            </span>
            <Clock className="w-4 h-4" style={{ color: "var(--warning)" }} />
          </div>
          <div
            className="text-2xl font-bold"
            style={{ color: "var(--warning)" }}
          >
            {data.metrics.idle}
          </div>
        </div>

        <div
          className="p-4 rounded-xl"
          style={{
            backgroundColor: "var(--card)",
            border: "1px solid var(--border)",
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Success Rate
            </span>
            <CheckCircle className="w-4 h-4" style={{ color: "var(--success)" }} />
          </div>
          <div
            className="text-2xl font-bold"
            style={{ color: "var(--text-primary)" }}
          >
            {data.metrics.successRate.toFixed(1)}%
          </div>
        </div>

        <div
          className="p-4 rounded-xl"
          style={{
            backgroundColor: "var(--card)",
            border: "1px solid var(--border)",
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Total Tokens
            </span>
            <Zap className="w-4 h-4" style={{ color: "var(--warning)" }} />
          </div>
          <div
            className="text-2xl font-bold"
            style={{ color: "var(--text-primary)" }}
          >
            {data.metrics.totalTokens.toLocaleString()}
          </div>
        </div>
      </div>

      <div
        className="flex gap-4 p-4 rounded-xl"
        style={{
          backgroundColor: "var(--card)",
          border: "1px solid var(--border)",
        }}
      >
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
          <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Filters:
          </span>
        </div>

        <div
          className="flex gap-1 p-1 rounded-lg"
          style={{ backgroundColor: "var(--card-elevated)" }}
        >
          {(["all", "active", "idle"] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className="px-3 py-1 rounded text-xs font-medium transition-all capitalize"
              style={{
                backgroundColor:
                  statusFilter === status ? "var(--accent)" : "transparent",
                color:
                  statusFilter === status ? "white" : "var(--text-secondary)",
              }}
            >
              {status}
            </button>
          ))}
        </div>

        {models.length > 1 && (
          <div
            className="flex gap-1 p-1 rounded-lg"
            style={{ backgroundColor: "var(--card-elevated)" }}
          >
            <button
              onClick={() => setModelFilter("all")}
              className="px-3 py-1 rounded text-xs font-medium transition-all"
              style={{
                backgroundColor:
                  modelFilter === "all" ? "var(--accent)" : "transparent",
                color:
                  modelFilter === "all" ? "white" : "var(--text-secondary)",
              }}
            >
              All Models
            </button>
            {models.map((model) => (
              <button
                key={model}
                onClick={() => setModelFilter(model)}
                className="px-3 py-1 rounded text-xs font-medium transition-all"
                style={{
                  backgroundColor:
                    modelFilter === model ? "var(--accent)" : "transparent",
                  color:
                    modelFilter === model ? "white" : "var(--text-secondary)",
                }}
              >
                {model}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
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
              Active Sub-Agents ({filteredSubagents.length})
            </h3>

            {filteredSubagents.length === 0 ? (
              <div className="text-center py-8">
                <Bot
                  className="w-12 h-12 mx-auto mb-3"
                  style={{ color: "var(--text-muted)" }}
                />
                <p style={{ color: "var(--text-secondary)" }}>
                  No sub-agents match the current filters
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredSubagents.map((subagent) => (
                  <SubAgentCard key={subagent.id} subagent={subagent} />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-1">
          <SubAgentTimeline events={data.timeline} />
        </div>
      </div>

      <div
        className="text-xs text-center"
        style={{ color: "var(--text-muted)" }}
      >
        Last updated: {new Date(data.timestamp).toLocaleString()}
        {" • "}
        Auto-refresh every 5 seconds
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { StatsCard } from "@/components/StatsCard";
import { ActivityFeed } from "@/components/ActivityFeed";
import { WeatherWidget } from "@/components/WeatherWidget";
import { Notepad } from "@/components/Notepad";
import { MoodWidget } from "@/components/MoodWidget";
import { SuggestionsPanel } from "@/components/SuggestionsPanel";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import {
  Activity,
  CheckCircle,
  XCircle,
  Calendar,
  Circle,
  Bot,
  MessageSquare,
  Users,
  Gamepad2,
  Brain,
  Puzzle,
  Zap,
  Server,
  Terminal,
} from "lucide-react";
import Link from "next/link";

interface Stats {
  total: number;
  today: number;
  success: number;
  error: number;
  byType: Record<string, number>;
}

interface Agent {
  id: string;
  name: string;
  emoji: string;
  color: string;
  model: string;
  status: "online" | "offline";
  lastActivity?: string;
  botToken?: string;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({ total: 0, today: 0, success: 0, error: 0, byType: {} });
  const [agents, setAgents] = useState<Agent[]>([]);

  useEffect(() => {
    Promise.all([
      fetch("/api/activities/stats").then(r => r.json()),
      fetch("/api/agents").then(r => r.json()),
    ]).then(([actStats, agentsData]) => {
      setStats({
        total: actStats.total || 0,
        today: actStats.today || 0,
        success: actStats.byStatus?.success || 0,
        error: actStats.byStatus?.error || 0,
        byType: actStats.byType || {},
      });
      setAgents(agentsData.agents || []);
    }).catch(console.error);
  }, []);

  return (
    <ErrorBoundary>
      <div className="p-4 md:p-8">
        {/* Header */}
      <div className="mb-4 md:mb-6">
        <div className="flex items-center gap-3 mb-1">
          <img 
            src="/logo.png" 
            alt="SuperBotijo" 
            style={{ width: "40px", height: "40px", objectFit: "contain" }}
          />
          <h1 
            className="text-2xl md:text-3xl font-bold"
            style={{ 
              fontFamily: 'var(--font-heading)',
              color: 'var(--text-primary)',
              letterSpacing: '-1.5px'
            }}
          >
            SuperBotijo
          </h1>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          Overview of agent activity
        </p>
      </div>

      {/* Stats Grid + Weather */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-4 md:mb-6">
        {/* Stats */}
        <div className="lg:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatsCard
            title="Total Activities"
            value={stats.total.toLocaleString()}
            icon={<Activity className="w-5 h-5" />}
            iconColor="var(--info)"
          />
          <StatsCard
            title="Today"
            value={stats.today.toLocaleString()}
            icon={<Zap className="w-5 h-5" />}
            iconColor="var(--accent)"
          />
          <StatsCard
            title="Successful"
            value={stats.success.toLocaleString()}
            icon={<CheckCircle className="w-5 h-5" />}
            iconColor="var(--success)"
          />
          <StatsCard
            title="Errors"
            value={stats.error.toLocaleString()}
            icon={<XCircle className="w-5 h-5" />}
            iconColor="var(--error)"
          />
        </div>

        {/* Weather Widget */}
        <div className="lg:col-span-1">
          <WeatherWidget />
        </div>
      </div>

      {/* Multi-Agent Status */}
      <div 
        className="mb-6 rounded-xl overflow-hidden"
        style={{
          backgroundColor: 'var(--card)',
          border: '1px solid var(--border)',
        }}
      >
        <div 
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-3">
            <div className="accent-line" />
            <h2 
              className="text-base font-semibold"
              style={{ 
                fontFamily: 'var(--font-heading)',
                color: 'var(--text-primary)'
              }}
            >
              <Users className="inline-block w-5 h-5 mr-2 mb-1" />
              Multi-Agent System
            </h2>
          </div>
          <div className="flex gap-2">
            <Link
              href="/office"
              className="text-sm font-medium px-3 py-1.5 rounded-lg transition-all"
              style={{ 
                backgroundColor: 'var(--accent)',
                color: 'var(--text-primary)',
              }}
            >
              <Gamepad2 className="inline-block w-4 h-4 mr-1 mb-0.5" />
              Open Office
            </Link>
            <Link
              href="/agents"
              className="text-sm font-medium"
              style={{ color: 'var(--accent)' }}
            >
              View all →
            </Link>
          </div>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {agents.map((agent) => (
              <div
                key={agent.id}
                className="p-3 rounded-lg transition-all hover:scale-105"
                style={{
                  backgroundColor: 'var(--card-elevated)',
                  border: `2px solid ${agent.color}`,
                  cursor: 'pointer',
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="text-2xl">{agent.emoji}</div>
                  <Circle
                    className="w-2 h-2"
                    style={{
                      fill: agent.status === "online" ? "#4ade80" : "#6b7280",
                      color: agent.status === "online" ? "#4ade80" : "#6b7280",
                    }}
                  />
                </div>
                <div 
                  className="text-sm font-bold mb-1"
                  style={{ 
                    fontFamily: 'var(--font-heading)',
                    color: 'var(--text-primary)',
                  }}
                >
                  {agent.name}
                </div>
                <div 
                  className="text-xs truncate mb-1"
                  style={{ color: 'var(--text-muted)' }}
                  title={agent.model}
                >
                  <Bot className="inline-block w-3 h-3 mr-1" />
                  {agent.model.split('/').pop()}
                </div>
                {agent.botToken && (
                  <div 
                    className="text-xs mt-1 flex items-center gap-1"
                    style={{ color: '#0088cc' }}
                  >
                    <MessageSquare className="w-3 h-3" />
                    Connected
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Activity Feed */}
        <div 
          className="lg:col-span-2 rounded-xl overflow-hidden"
          style={{
            backgroundColor: 'var(--card)',
            border: '1px solid var(--border)',
          }}
        >
          <div 
            className="flex items-center justify-between px-5 py-4"
            style={{ borderBottom: '1px solid var(--border)' }}
          >
            <div className="flex items-center gap-3">
              <div className="accent-line" />
              <h2 
                className="text-base font-semibold"
                style={{ 
                  fontFamily: 'var(--font-heading)',
                  color: 'var(--text-primary)'
                }}
              >
                Recent Activity
              </h2>
            </div>
            <a
              href="/activity"
              className="text-sm font-medium"
              style={{ color: 'var(--accent)' }}
            >
              View all →
            </a>
          </div>
          <div className="p-0">
            <ActivityFeed limit={5} />
          </div>
        </div>

        {/* Quick Links */}
        <div 
          className="rounded-xl overflow-hidden"
          style={{
            backgroundColor: 'var(--card)',
            border: '1px solid var(--border)',
          }}
        >
          <div 
            className="flex items-center justify-between px-5 py-4"
            style={{ borderBottom: '1px solid var(--border)' }}
          >
            <div className="flex items-center gap-3">
              <div className="accent-line" />
              <h2 
                className="text-base font-semibold"
                style={{ 
                  fontFamily: 'var(--font-heading)',
                  color: 'var(--text-primary)'
                }}
              >
                Quick Links
              </h2>
            </div>
          </div>
          <div className="p-4 grid grid-cols-2 gap-2">
            {[
              { href: "/cron", icon: Calendar, label: "Cron Jobs", color: "#a78bfa" },
              { href: "/workflows", icon: Zap, label: "Workflows", color: "var(--accent)" },
              { href: "/system", icon: Server, label: "System", color: "var(--success)" },
              { href: "/logs", icon: Terminal, label: "Live Logs", color: "#60a5fa" },
              { href: "/memory", icon: Brain, label: "Memory", color: "#f59e0b" },
              { href: "/skills", icon: Puzzle, label: "Skills", color: "#4ade80" },
            ].map(({ href, icon: Icon, label, color }) => (
              <Link
                key={href}
                href={href}
                className="p-3 rounded-lg transition-all hover:scale-[1.02]"
                style={{ backgroundColor: 'var(--card-elevated)', border: '1px solid var(--border)' }}
              >
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4" style={{ color }} />
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{label}</span>
                </div>
              </Link>
            ))}
          </div>

          {/* Mood Widget */}
          <div style={{ margin: "1rem", marginTop: "0.5rem" }}>
            <MoodWidget />
          </div>

          {/* Smart Suggestions */}
          <div style={{ margin: "1rem", marginTop: "0.5rem" }}>
            <div
              className="p-4 rounded-lg"
              style={{ backgroundColor: 'var(--card-elevated)', border: '1px solid var(--border)' }}
            >
              <h3
                className="text-sm font-semibold mb-3"
                style={{ color: 'var(--text-secondary)' }}
              >
                💡 Smart Suggestions
              </h3>
              <SuggestionsPanel compact maxItems={3} />
            </div>
          </div>

          {/* Notepad */}
          <div style={{ margin: "1rem", marginTop: "0.5rem" }}>
            <Notepad />
          </div>
        </div>
      </div>
      </div>
    </ErrorBoundary>
  );
}

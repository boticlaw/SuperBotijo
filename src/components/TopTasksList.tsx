"use client";

import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Minus, ExternalLink, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/provider";

interface TopTask {
  type: string;
  tokens: number;
  count: number;
  avgTokens: number;
  percentOfTotal: number;
  trend: 'up' | 'down' | 'stable';
  trendPercent: number;
  previousTokens: number;
}

interface TopTasksData {
  tasks: TopTask[];
  period: string;
  totalTokens: number;
  previousTotalTokens: number;
  timestamp: string;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}
function getTypeEmoji(type: string): string {
  const emojis: Record<string, string> = {
    web_search: '🔍',
    search: '🔍',
    file: '📁',
    file_read: '📖',
    file_write: '✏️',
    command: '⚡',
    build: '🔨',
    task: '📋',
    tool_call: '🔧',
    agent_action: '🤖',
    message: '💬',
    message_sent: '📤',
    cron: '⏰',
    cron_run: '⏰',
    memory: '🧠',
    security: '🔒',
  };
  return emojis[type] || '📌';
}
function getTypeColor(type: string): string {
  const colors: Record<string, string> = {
    web_search: '#3b82f6',
    search: '#3b82f6',
    file: '#f59e0b',
    file_read: '#f59e0b',
    file_write: '#ef4444',
    command: '#8b5cf6',
    build: '#10b981',
    task: '#6366f1',
    tool_call: '#ec4899',
    agent_action: '#14b8a6',
    message: '#22c55e',
    message_sent: '#22c55e',
    cron: '#f97316',
    cron_run: '#f97316',
    memory: '#a855f7',
    security: '#ef4444',
  };
  return colors[type] || '#6b7280';
}
type PeriodType = 'day' | 'week' | 'month';

export function TopTasksList() {
  const router = useRouter();
  const { t } = useI18n();
  const [data, setData] = useState<TopTasksData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodType>('month');
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/costs/top-tasks?period=${period}`);
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch (error) {
        console.error('Failed to fetch top tasks:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [period]);
  const handleTaskClick = (type: string) => {
    router.push(`/activities?type=${type}`);
  };
  if (loading) {
    return (
      <div className="p-6 rounded-xl" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-center gap-2 py-8">
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--accent)' }} />
          <span style={{ color: 'var(--text-secondary)' }}>{t("topTasks.loading")}</span>
        </div>
      </div>
    );
  }
  if (!data || data.tasks.length === 0) {
    return (
      <div className="p-6 rounded-xl" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
        <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
          {t("topTasks.title")}
        </h3>
        <div className="text-center py-8">
          <p style={{ color: 'var(--text-muted)' }}>{t("topTasks.noData")}</p>
        </div>
      </div>
    );
  }
  const totalChange = data.previousTotalTokens > 0
    ? ((data.totalTokens - data.previousTotalTokens) / data.previousTotalTokens) * 100
    : 0;
  return (
    <div className="p-6 rounded-xl" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            {t("topTasks.title")}
          </h3>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {t("topTasks.totalTokens", { tokens: formatTokens(data.totalTokens) })}
            {totalChange !== 0 && (
              <span
                style={{
                  color: totalChange > 0 ? 'var(--error)' : 'var(--success)',
                  marginLeft: '0.5rem',
                }}
              >
                {t("topTasks.vsPrevious", { percent: `${totalChange > 0 ? '+' : ''}${totalChange.toFixed(1)}` })}
              </span>
            )}
          </p>
        </div>
        {/* Period selector */}
        <div className="flex gap-1 p-1 rounded-lg" style={{ backgroundColor: 'var(--card-elevated)' }}>
          {(['day', 'week', 'month'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className="px-3 py-1 rounded text-xs font-medium transition-all"
              style={{
                backgroundColor: period === p ? 'var(--accent)' : 'transparent',
                color: period === p ? 'white' : 'var(--text-secondary)',
              }}
            >
              {t(`topTasks.period${p.charAt(0).toUpperCase() + p.slice(1)}`)}
            </button>
          ))}
        </div>
      </div>
      {/* Task list */}
      <div className="space-y-3">
        {data.tasks.map((task, index) => (
          <div
            key={task.type}
            onClick={() => handleTaskClick(task.type)}
            className="flex items-center gap-4 p-3 rounded-lg cursor-pointer transition-all hover:scale-[1.01]"
            style={{ backgroundColor: 'var(--card-elevated)' }}
          >
            {/* Rank */}
            <div
              className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm"
              style={{
                backgroundColor: index === 0 ? 'rgba(255,215,0,0.2)' : 'var(--card)',
                color: index === 0 ? '#FFD700' : 'var(--text-primary)',
              }}
            >
              {index + 1}
            </div>
            {/* Type info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-lg">{getTypeEmoji(task.type)}</span>
                <span
                  className="font-medium capitalize"
                  style={{ color: getTypeColor(task.type) }}
                >
                  {task.type.replace(/_/g, ' ')}
                </span>
                <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--card)', color: 'var(--text-muted)' }}>
                  {t("topTasks.tasks", { count: task.count })}
                </span>
              </div>
              
              {/* Progress bar */}
              <div className="mt-2 h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--card)' }}>
                <div
                  className="h-full transition-all duration-500"
                  style={{
                    width: `${task.percentOfTotal}%`,
                    backgroundColor: getTypeColor(task.type),
                  }}
                />
              </div>
            </div>
            {/* Tokens & Trend */}
            <div className="text-right flex-shrink-0">
              <div className="font-mono font-bold" style={{ color: 'var(--text-primary)' }}>
                {formatTokens(task.tokens)}
              </div>
              <div className="flex items-center justify-end gap-1 text-xs">
                {task.trend === 'up' && (
                  <>
                    <TrendingUp className="w-3 h-3" style={{ color: 'var(--error)' }} />
                    <span style={{ color: 'var(--error)' }}>+{task.trendPercent.toFixed(0)}%</span>
                  </>
                )}
                {task.trend === 'down' && (
                  <>
                    <TrendingDown className="w-3 h-3" style={{ color: 'var(--success)' }} />
                    <span style={{ color: 'var(--success)' }}>-{task.trendPercent.toFixed(0)}%</span>
                  </>
                )}
                {task.trend === 'stable' && (
                  <>
                    <Minus className="w-3 h-3" style={{ color: 'var(--text-muted)' }} />
                    <span style={{ color: 'var(--text-muted)' }}>{t("topTasks.stable")}</span>
                  </>
                )}
              </div>
            </div>
            {/* External link */}
            <ExternalLink className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
          </div>
        ))}
      </div>
      {/* Summary */}
      <div className="mt-4 pt-4 flex items-center justify-between text-xs" style={{ borderTop: '1px solid var(--border)' }}>
        <span style={{ color: 'var(--text-muted)' }}>
          {t("topTasks.averagePerType", { tokens: formatTokens(Math.round(data.totalTokens / data.tasks.length)) })}
        </span>
        <button
          onClick={() => router.push('/activities')}
          className="flex items-center gap-1 hover:underline"
          style={{ color: 'var(--accent)' }}
        >
          {t("topTasks.viewAllActivities")}
          <ExternalLink className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

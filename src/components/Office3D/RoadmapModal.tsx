'use client';

import { useState, useEffect } from 'react';
import { X, LayoutGrid, CheckCircle, Circle, Clock } from 'lucide-react';

interface RoadmapModalProps {
  onClose: () => void;
}

interface KanbanStats {
  total: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  byAssignee: Array<{ assignee: string | null; count: number }>;
  columns: Array<{
    id: string;
    name: string;
    taskCount: number;
    limit: number | null;
  }>;
}

export function RoadmapModal({ onClose }: RoadmapModalProps) {
  const [stats, setStats] = useState<KanbanStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/kanban/stats');
        const data = await res.json();
        setStats(data.stats);
      } catch (error) {
        console.error('Failed to fetch kanban stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'done': return 'text-success';
      case 'in_progress': return 'text-warning';
      case 'todo': return 'text-neutral-400';
      case 'backlog': return 'text-neutral-500';
      default: return 'text-neutral-400';
    }
  };

  const getPriorityIcon = (priority: string): string => {
    switch (priority) {
      case 'urgent': return '🔴';
      case 'high': return '🟠';
      case 'medium': return '🟡';
      case 'low': return '🟢';
      default: return '⚪';
    }
  };

  return (
    <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-neutral-900 border border-warning rounded-lg p-6 max-w-lg w-full mx-4 shadow-2xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-warning flex items-center gap-2">
            <LayoutGrid className="w-5 h-5" />
            Roadmap & Planning
          </h2>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {loading ? (
          <div className="text-center py-8 text-neutral-400">Loading...</div>
        ) : (
          <div className="space-y-4">
            {/* Kanban Overview */}
            <div className="bg-neutral-800 p-4 rounded-lg border border-neutral-700">
              <h3 className="text-sm font-semibold text-neutral-300 flex items-center gap-2 mb-3">
                <CheckCircle className="w-4 h-4" />
                Kanban Overview
              </h3>
              
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="text-center">
                  <p className="text-2xl font-bold text-warning">{stats?.total || 0}</p>
                  <p className="text-xs text-neutral-400">Total Tasks</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-info">
                    {stats?.byAssignee?.filter(a => a.assignee).length || 0}
                  </p>
                  <p className="text-xs text-neutral-400">Assignees</p>
                </div>
              </div>

              {/* Status breakdown */}
              <div className="flex flex-wrap gap-2 mt-2">
                {stats?.byStatus && Object.entries(stats.byStatus).map(([status, count]) => (
                  <span 
                    key={status}
                    className={`px-2 py-1 rounded text-xs ${getStatusColor(status)}`}
                  >
                    {status}: {count}
                  </span>
                ))}
              </div>
            </div>

            {/* Columns */}
            <div className="bg-neutral-800 p-4 rounded-lg border border-neutral-700">
              <h3 className="text-sm font-semibold text-neutral-300 flex items-center gap-2 mb-3">
                <Circle className="w-4 h-4" />
                Columns
              </h3>
              
              <div className="space-y-2">
                {stats?.columns?.map((col) => (
                  <div key={col.id} className="flex items-center justify-between text-sm">
                    <span className="text-neutral-300">{col.name}</span>
                    <span className="text-neutral-400">
                      {col.taskCount} tasks
                      {col.limit && ` / ${col.limit} limit`}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Priority Distribution */}
            {stats?.byPriority && Object.keys(stats.byPriority).length > 0 && (
              <div className="bg-neutral-800 p-4 rounded-lg border border-neutral-700">
                <h3 className="text-sm font-semibold text-neutral-300 flex items-center gap-2 mb-3">
                  <Clock className="w-4 h-4" />
                  Priority Distribution
                </h3>
                
                <div className="flex flex-wrap gap-2">
                  {Object.entries(stats.byPriority).map(([priority, count]) => (
                    <span 
                      key={priority}
                      className="px-2 py-1 bg-neutral-700 rounded text-sm text-neutral-300"
                    >
                      {getPriorityIcon(priority)} {priority}: {count}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Link */}
            <div className="pt-2">
              <a 
                href="/kanban"
                className="text-warning hover:underline text-sm flex items-center gap-1"
              >
                <LayoutGrid className="w-4 h-4" />
                Open Kanban Board →
              </a>
            </div>
          </div>
        )}

        <button
          onClick={onClose}
          className="mt-4 w-full bg-warning hover:bg-warning/90 text-black font-bold py-2 rounded transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}

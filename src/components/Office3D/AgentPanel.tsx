'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { AgentConfig, AgentState, Activity } from './agentsConfig';

interface AgentPanelProps {
  agent: AgentConfig;
  state: AgentState;
  onClose: () => void;
}

export default function AgentPanel({ agent, state, onClose }: AgentPanelProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);

  // Fetch activities when panel opens
  useEffect(() => {
    const fetchActivities = async () => {
      setLoadingActivities(true);
      try {
        const res = await fetch(`/api/agents/${agent.id}/activities`);
        const data = await res.json();
        setActivities(data.activities || []);
      } catch (error) {
        console.error('Failed to load activities:', error);
        setActivities([]);
      } finally {
        setLoadingActivities(false);
      }
    };

    fetchActivities();
  }, [agent.id]);

  const getStatusColor = () => {
    switch (state.status) {
      case 'working': return 'text-success';
      case 'online': return 'text-success';
      case 'thinking': return 'text-info animate-pulse';
      case 'error': return 'text-error';
      case 'idle': return 'text-warning';
      case 'offline':
      default: return 'text-neutral-500';
    }
  };

  const getStatusBgColor = () => {
    switch (state.status) {
      case 'working': return 'bg-success/20';
      case 'online': return 'bg-success/20';
      case 'thinking': return 'bg-info/20';
      case 'error': return 'bg-error/20';
      case 'idle': return 'bg-warning/20';
      case 'offline':
      default: return 'bg-neutral-500/20';
    }
  };

  const formatLastActivity = (timestamp?: string): string => {
    if (!timestamp) return 'Never';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  };

  // Format model name (extract model name from full path)
  const formatModel = (model?: string): string => {
    if (!model || model === 'unknown') return 'N/A';
    // Extract just the model name from paths like "anthropic/claude-sonnet-4-20250514"
    const parts = model.split('/');
    return parts[parts.length - 1] || model;
  };

  return (
    <div className="absolute right-0 top-0 h-full w-96 bg-black/90 backdrop-blur-md text-white p-6 shadow-2xl border-l border-white/10 overflow-y-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <span className="text-4xl">{agent.emoji}</span>
            {agent.name}
          </h2>
          <p className="text-sm text-neutral-400 mt-1">{agent.role}</p>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      {/* Status badge */}
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-4 ${getStatusBgColor()}`}>
        <div className={`w-2 h-2 rounded-full ${state.status === 'thinking' ? 'animate-pulse' : ''}`} style={{ backgroundColor: agent.color }}></div>
        <span className={`text-sm font-medium ${getStatusColor()}`}>
          {state.status.toUpperCase()}
        </span>
      </div>

      {/* Last Activity */}
      {state.lastActivity && (
        <div className="mb-4 text-sm">
          <span className="text-neutral-400">Last activity: </span>
          <span className="text-white font-medium">{formatLastActivity(state.lastActivity)}</span>
        </div>
      )}

      {/* Current task */}
      {state.currentTask && (
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-neutral-400 mb-1">Current Task</h3>
          <p className="text-sm bg-white/5 p-2 rounded">{state.currentTask}</p>
        </div>
      )}

      {/* Stats */}
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-neutral-400 mb-2">Stats</h3>
        
        <div className="grid grid-cols-2 gap-2">
          {/* Model */}
          <div className="bg-white/5 p-2 rounded-lg">
            <p className="text-xs text-neutral-400">Model</p>
            <p className="text-sm font-bold truncate" title={state.model}>{formatModel(state.model)}</p>
          </div>

          {/* Tokens used */}
          <div className="bg-white/5 p-2 rounded-lg">
            <p className="text-xs text-neutral-400">Tokens</p>
            <p className="text-sm font-bold">{state.tokensUsed?.toLocaleString() || '0'}</p>
          </div>

          {/* Sessions */}
          <div className="bg-white/5 p-2 rounded-lg">
            <p className="text-xs text-neutral-400">Sessions</p>
            <p className="text-sm font-bold">{state.sessionCount || 0}</p>
          </div>

          {/* Mood */}
          {state.mood && (
            <div className="bg-white/5 p-2 rounded-lg">
              <p className="text-xs text-neutral-400">Mood</p>
              <p className="text-sm font-bold">{state.mood.emoji} {state.mood.mood}</p>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions - moved up */}
      <div className="mb-4 pb-4 border-b border-white/10">
        <h3 className="text-sm font-semibold text-neutral-400 mb-2">Quick Actions</h3>
        <div className="grid grid-cols-2 gap-2">
          <a 
            href={`/memory?agent=${agent.id}`}
            className="px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition-colors text-center"
          >
            View Memory
          </a>
          <a 
            href={`/sessions?agent=${agent.id}`}
            className="px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition-colors text-center"
          >
            View History
          </a>
        </div>
      </div>

      {/* Activity Feed - Real data */}
      <div>
        <h3 className="text-sm font-semibold text-neutral-400 mb-2">Recent Activity</h3>
        
        {loadingActivities ? (
          <div className="text-neutral-400 text-sm py-4 text-center">
            Loading...
          </div>
        ) : activities.length > 0 ? (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {activities.slice(0, 5).map((activity) => (
              <div key={activity.id} className="bg-white/5 p-2 rounded-lg text-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-neutral-400">{formatLastActivity(activity.timestamp)}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    activity.status === 'success' ? 'bg-success/20 text-success' :
                    activity.status === 'error' ? 'bg-error/20 text-error' :
                    'bg-neutral-500/20 text-neutral-400'
                  }`}>
                    {activity.type}
                  </span>
                </div>
                <p className="text-neutral-200 line-clamp-2">{activity.description}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-neutral-500 text-sm py-4 text-center">
            No recent activity
          </div>
        )}
      </div>
    </div>
  );
}

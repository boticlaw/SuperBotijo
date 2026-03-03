'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Types
interface AgentInfo {
  id: string;
  name: string;
  status: 'working' | 'idle' | 'error' | 'paused';
  model: string;
  currentTask?: string;
  lastActivity?: string;
  tokensUsed: number;
  sessionCount: number;
  uptime?: number;
}

interface AgentActivity {
  id: string;
  type: string;
  description: string;
  timestamp: string;
  status: string;
  duration?: number;
  tokens_used?: number;
}

interface AgentLog {
  id: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  timestamp: string;
  source?: string;
}

interface AgentMetrics {
  totalActivities: number;
  successRate: number;
  avgResponseTime: number;
  tokensPerDay: number;
  errorsLast24h: number;
  topTasks: { task: string; count: number }[];
}

interface AgentIdentity {
  id: string;
  name: string;
  role: string;
  personality: string | null;
  avatar: string | null;
  mission: string | null;
  createdAt: string;
  updatedAt: string;
}

type TabId = 'overview' | 'activity' | 'logs' | 'config' | 'identity' | 'metrics';

interface AgentInspectPanelProps {
  agentId: string;
  isOpen: boolean;
  onClose: () => void;
  onAction?: (action: string, agentId: string) => void;
}

// Tab configuration
const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'overview', label: 'Overview', icon: '📊' },
  { id: 'activity', label: 'Activity', icon: '⚡' },
  { id: 'logs', label: 'Logs', icon: '📝' },
  { id: 'config', label: 'Config', icon: '⚙️' },
  { id: 'identity', label: 'Identity', icon: '🎭' },
  { id: 'metrics', label: 'Metrics', icon: '📈' },
];

export function AgentInspectPanel({ agentId, isOpen, onClose, onAction }: AgentInspectPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [agent, setAgent] = useState<AgentInfo | null>(null);
  const [activities, setActivities] = useState<AgentActivity[]>([]);
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [metrics, setMetrics] = useState<AgentMetrics | null>(null);
  const [config, setConfig] = useState<Record<string, unknown>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [logFilter, setLogFilter] = useState<'all' | 'info' | 'warn' | 'error'>('all');
  const [identity, setIdentity] = useState<AgentIdentity | null>(null);
  const [identityForm, setIdentityForm] = useState({
    name: '',
    role: '',
    personality: '',
    avatar: '',
    mission: '',
  });
  const [identitySaving, setIdentitySaving] = useState(false);
  const [identitySaveSuccess, setIdentitySaveSuccess] = useState(false);
  const [identityError, setIdentityError] = useState<string | null>(null);

  // Fetch agent data
  const fetchAgentData = useCallback(async () => {
    if (!agentId || !isOpen) return;

    setIsLoading(true);
    try {
      // Fetch agent info
      const agentRes = await fetch(`/api/agents/${agentId}`);
      if (agentRes.ok) {
        const data = await agentRes.json();
        setAgent(data.agent);
      }

      // Fetch activities
      const activityRes = await fetch(`/api/activities?agentId=${agentId}&limit=20`);
      if (activityRes.ok) {
        const data = await activityRes.json();
        setActivities(data.activities || []);
      }

      // Fetch logs (simulated)
      setLogs([
        { id: '1', level: 'info', message: 'Agent started', timestamp: new Date().toISOString(), source: 'system' },
        { id: '2', level: 'info', message: 'Connected to gateway', timestamp: new Date().toISOString(), source: 'gateway' },
        { id: '3', level: 'debug', message: 'Heartbeat sent', timestamp: new Date().toISOString(), source: 'heartbeat' },
      ]);

      // Fetch metrics
      const metricsRes = await fetch(`/api/agents/${agentId}/metrics`);
      if (metricsRes.ok) {
        const data = await metricsRes.json();
        setMetrics(data.metrics);
      } else {
        // Default metrics
        setMetrics({
          totalActivities: activities.length,
          successRate: 95,
          avgResponseTime: 1.2,
          tokensPerDay: 50000,
          errorsLast24h: 2,
          topTasks: [
            { task: 'code_review', count: 15 },
            { task: 'documentation', count: 8 },
            { task: 'testing', count: 5 },
          ],
        });
      }

      // Fetch config
      const configRes = await fetch(`/api/agents/${agentId}/config`);
      if (configRes.ok) {
        const data = await configRes.json();
        setConfig(data.config || {});
      } else {
        setConfig({
          model: agent?.model || 'claude-sonnet-4-20250514',
          temperature: 0.7,
          maxTokens: 4096,
          heartbeatInterval: 30,
        });
      }

      // Fetch identity
      const identityRes = await fetch(`/api/agents/${agentId}/identity`);
      if (identityRes.ok) {
        const data = await identityRes.json();
        setIdentity(data.identity);
        setIdentityForm({
          name: data.identity.name || '',
          role: data.identity.role || '',
          personality: data.identity.personality || '',
          avatar: data.identity.avatar || '',
          mission: data.identity.mission || '',
        });
      }
    } catch (error) {
      console.error('Failed to fetch agent data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [agentId, isOpen, agent?.model, activities.length]);

  useEffect(() => {
    if (isOpen) {
      fetchAgentData();
    }
  }, [isOpen, fetchAgentData]);

  // Handle context menu actions
  const handleAction = (action: string) => {
    onAction?.(action, agentId);
  };

  // Handle identity save
  const handleSaveIdentity = async () => {
    setIdentitySaving(true);
    setIdentityError(null);
    setIdentitySaveSuccess(false);

    try {
      const res = await fetch(`/api/agents/${agentId}/identity`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: identityForm.name,
          role: identityForm.role,
          personality: identityForm.personality || null,
          avatar: identityForm.avatar || null,
          mission: identityForm.mission || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save identity');
      }

      const data = await res.json();
      setIdentity(data.identity);
      setIdentitySaveSuccess(true);
      setTimeout(() => setIdentitySaveSuccess(false), 2000);
    } catch (error) {
      setIdentityError(error instanceof Error ? error.message : 'Failed to save identity');
    } finally {
      setIdentitySaving(false);
    }
  };

  // Format relative time
  const formatRelativeTime = (timestamp: string) => {
    const diff = Date.now() - new Date(timestamp).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'working': return 'text-success bg-success-soft dark:bg-success-soft';
      case 'idle': return 'text-neutral-500 bg-neutral-100 dark:bg-neutral-800';
      case 'error': return 'text-error bg-error-soft dark:bg-error-soft';
      case 'paused': return 'text-warning bg-warning-soft dark:bg-warning-soft';
      default: return 'text-neutral-500 bg-neutral-100';
    }
  };

  // Get log level color
  const getLogLevelColor = (level: string) => {
    switch (level) {
      case 'error': return 'text-error';
      case 'warn': return 'text-warning';
      case 'debug': return 'text-neutral-400';
      default: return 'text-neutral-600 dark:text-neutral-400';
    }
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed right-0 top-0 h-full w-96 bg-white dark:bg-neutral-900 shadow-2xl z-50 flex flex-col border-l border-neutral-200 dark:border-neutral-700"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Show identity avatar if exists, otherwise status dot */}
          {identity?.avatar ? (
            <div className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-lg overflow-hidden">
              {identity.avatar.startsWith('http') || identity.avatar.startsWith('/') ? (
                <img src={identity.avatar} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span>{identity.avatar}</span>
              )}
            </div>
          ) : (
            <div className={`w-3 h-3 rounded-full ${
              agent?.status === 'working' ? 'bg-success animate-pulse' :
              agent?.status === 'error' ? 'bg-error' :
              agent?.status === 'paused' ? 'bg-warning' :
              'bg-neutral-400'
            }`} />
          )}
          <h2 className="font-semibold text-neutral-900 dark:text-white">
            {identity?.name || agent?.name || agentId}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {/* Context menu */}
          <div className="relative group">
            <button className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </button>
            <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-neutral-800 rounded-lg shadow-lg border border-neutral-200 dark:border-neutral-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
              <button
                onClick={() => handleAction('pause')}
                className="w-full px-4 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center gap-2"
              >
                <span>⏸️</span> Pause
              </button>
              <button
                onClick={() => handleAction('resume')}
                className="w-full px-4 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center gap-2"
              >
                <span>▶️</span> Resume
              </button>
              <button
                onClick={() => handleAction('restart')}
                className="w-full px-4 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center gap-2"
              >
                <span>🔄</span> Restart
              </button>
              <hr className="my-1 border-neutral-200 dark:border-neutral-700" />
              <button
                onClick={() => handleAction('view_logs')}
                className="w-full px-4 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center gap-2"
              >
                <span>📋</span> View Full Logs
              </button>
              <button
                onClick={() => handleAction('export')}
                className="w-full px-4 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center gap-2"
              >
                <span>📤</span> Export Data
              </button>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-neutral-200 dark:border-neutral-700 overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-info text-info dark:text-info'
                : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
            }`}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-8 h-8 border-2 border-info border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <motion.div
                key="overview"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                {/* Status card */}
                <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-neutral-500 dark:text-neutral-400">Status</span>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(agent?.status || 'idle')}`}>
                      {agent?.status || 'unknown'}
                    </span>
                  </div>
                  {agent?.currentTask && (
                    <div className="text-sm">
                      <span className="text-neutral-500 dark:text-neutral-400">Current task: </span>
                      <span className="text-neutral-900 dark:text-white">{agent.currentTask}</span>
                    </div>
                  )}
                </div>

                {/* Quick stats */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-3">
                    <div className="text-2xl font-bold text-neutral-900 dark:text-white">
                      {agent?.tokensUsed?.toLocaleString() || 0}
                    </div>
                    <div className="text-xs text-neutral-500 dark:text-neutral-400">Tokens Used</div>
                  </div>
                  <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-3">
                    <div className="text-2xl font-bold text-neutral-900 dark:text-white">
                      {agent?.sessionCount || 0}
                    </div>
                    <div className="text-xs text-neutral-500 dark:text-neutral-400">Sessions</div>
                  </div>
                  <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-3">
                    <div className="text-sm font-medium text-neutral-900 dark:text-white">
                      {agent?.model?.split('-')[0] || 'N/A'}
                    </div>
                    <div className="text-xs text-neutral-500 dark:text-neutral-400">Model</div>
                  </div>
                  <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-3">
                    <div className="text-sm font-medium text-neutral-900 dark:text-white">
                      {agent?.uptime ? `${Math.floor(agent.uptime / 3600)}h` : 'N/A'}
                    </div>
                    <div className="text-xs text-neutral-500 dark:text-neutral-400">Uptime</div>
                  </div>
                </div>

                {/* Last activity */}
                {agent?.lastActivity && (
                  <div className="text-sm text-neutral-500 dark:text-neutral-400">
                    Last activity: {formatRelativeTime(agent.lastActivity)}
                  </div>
                )}
              </motion.div>
            )}

            {/* Activity Tab */}
            {activeTab === 'activity' && (
              <motion.div
                key="activity"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-2"
              >
                {activities.length === 0 ? (
                  <div className="text-center text-neutral-500 dark:text-neutral-400 py-8">
                    No recent activity
                  </div>
                ) : (
                  activities.map(activity => (
                    <div
                      key={activity.id}
                      className="p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-sm font-medium text-neutral-900 dark:text-white">
                            {activity.type}
                          </div>
                          <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                            {activity.description}
                          </div>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          activity.status === 'success' ? 'bg-success-soft text-success dark:bg-success-soft dark:text-success' :
                          activity.status === 'error' ? 'bg-error-soft text-error dark:bg-error-soft dark:text-error' :
                          'bg-neutral-100 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-300'
                        }`}>
                          {activity.status}
                        </span>
                      </div>
                      <div className="text-xs text-neutral-400 mt-2">
                        {formatRelativeTime(activity.timestamp)}
                        {activity.duration && ` • ${activity.duration}ms`}
                        {activity.tokens_used && ` • ${activity.tokens_used} tokens`}
                      </div>
                    </div>
                  ))
                )}
              </motion.div>
            )}

            {/* Logs Tab */}
            {activeTab === 'logs' && (
              <motion.div
                key="logs"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-2"
              >
                {/* Log filter */}
                <div className="flex gap-2 mb-3">
                  {(['all', 'info', 'warn', 'error'] as const).map(level => (
                    <button
                      key={level}
                      onClick={() => setLogFilter(level)}
                      className={`px-2 py-1 text-xs rounded ${
                        logFilter === level
                          ? 'bg-info-soft text-info dark:bg-info-soft dark:text-info'
                          : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'
                      }`}
                    >
                      {level.charAt(0).toUpperCase() + level.slice(1)}
                    </button>
                  ))}
                </div>

                {logs.filter(l => logFilter === 'all' || l.level === logFilter).length === 0 ? (
                  <div className="text-center text-neutral-500 dark:text-neutral-400 py-8">
                    No logs to display
                  </div>
                ) : (
                  logs
                    .filter(l => logFilter === 'all' || l.level === logFilter)
                    .map(log => (
                      <div key={log.id} className="p-2 font-mono text-xs border-l-2 border-neutral-200 dark:border-neutral-700 pl-3">
                        <div className="flex items-center gap-2">
                          <span className={`uppercase font-medium ${getLogLevelColor(log.level)}`}>
                            [{log.level}]
                          </span>
                          <span className="text-neutral-400">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <div className="text-neutral-700 dark:text-neutral-300 mt-1">
                          {log.message}
                        </div>
                      </div>
                    ))
                )}
              </motion.div>
            )}

            {/* Config Tab */}
            {activeTab === 'config' && (
              <motion.div
                key="config"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-3"
              >
                {Object.entries(config).map(([key, value]) => (
                  <div key={key} className="flex justify-between items-center py-2 border-b border-neutral-100 dark:border-neutral-800">
                    <span className="text-sm text-neutral-500 dark:text-neutral-400">{key}</span>
                    <span className="text-sm font-medium text-neutral-900 dark:text-white">
                      {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                    </span>
                  </div>
                ))}
              </motion.div>
            )}

            {/* Identity Tab */}
            {activeTab === 'identity' && (
              <motion.div
                key="identity"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                {/* Avatar preview */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-2xl overflow-hidden">
                    {identityForm.avatar ? (
                      identityForm.avatar.startsWith('http') || identityForm.avatar.startsWith('/') ? (
                        <img src={identityForm.avatar} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        <span>{identityForm.avatar}</span>
                      )
                    ) : (
                      <span>🎭</span>
                    )}
                  </div>
                  <div>
                    <div className="font-medium text-neutral-900 dark:text-white">
                      {identityForm.name || agentId}
                    </div>
                    <div className="text-sm text-neutral-500 dark:text-neutral-400">
                      {identityForm.role || 'Agent'}
                    </div>
                  </div>
                </div>

                {/* Form fields */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                      Display Name
                    </label>
                    <input
                      type="text"
                      value={identityForm.name}
                      onChange={(e) => setIdentityForm({ ...identityForm, name: e.target.value })}
                      className="w-full px-3 py-2 text-sm bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-info"
                      placeholder="Agent display name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                      Role
                    </label>
                    <input
                      type="text"
                      value={identityForm.role}
                      onChange={(e) => setIdentityForm({ ...identityForm, role: e.target.value })}
                      className="w-full px-3 py-2 text-sm bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-info"
                      placeholder="Agent role"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                      Avatar (emoji or URL)
                    </label>
                    <input
                      type="text"
                      value={identityForm.avatar}
                      onChange={(e) => setIdentityForm({ ...identityForm, avatar: e.target.value })}
                      className="w-full px-3 py-2 text-sm bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-info"
                      placeholder="🤖 or https://..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                      Personality
                    </label>
                    <textarea
                      value={identityForm.personality}
                      onChange={(e) => setIdentityForm({ ...identityForm, personality: e.target.value })}
                      className="w-full px-3 py-2 text-sm bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-info resize-none"
                      rows={3}
                      placeholder="Describe the agent's personality traits..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                      Mission
                    </label>
                    <textarea
                      value={identityForm.mission}
                      onChange={(e) => setIdentityForm({ ...identityForm, mission: e.target.value })}
                      className="w-full px-3 py-2 text-sm bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-info resize-none"
                      rows={3}
                      placeholder="Agent's personal mission statement..."
                    />
                  </div>
                </div>

                {/* Status messages */}
                {identityError && (
                  <div className="text-sm text-error bg-error-soft dark:bg-error-soft px-3 py-2 rounded-lg">
                    {identityError}
                  </div>
                )}
                {identitySaveSuccess && (
                  <div className="text-sm text-success bg-success-soft dark:bg-success-soft px-3 py-2 rounded-lg">
                    Identity saved successfully!
                  </div>
                )}

                {/* Save button */}
                <button
                  onClick={handleSaveIdentity}
                  disabled={identitySaving}
                  className="w-full px-4 py-2 text-sm bg-info hover:bg-info/90 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {identitySaving ? 'Saving...' : 'Save Identity'}
                </button>
              </motion.div>
            )}

            {/* Metrics Tab */}
            {activeTab === 'metrics' && metrics && (
              <motion.div
                key="metrics"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                {/* Key metrics */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-3">
                    <div className="text-2xl font-bold text-neutral-900 dark:text-white">
                      {metrics.successRate}%
                    </div>
                    <div className="text-xs text-neutral-500 dark:text-neutral-400">Success Rate</div>
                  </div>
                  <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-3">
                    <div className="text-2xl font-bold text-neutral-900 dark:text-white">
                      {metrics.avgResponseTime}s
                    </div>
                    <div className="text-xs text-neutral-500 dark:text-neutral-400">Avg Response</div>
                  </div>
                  <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-3">
                    <div className="text-2xl font-bold text-neutral-900 dark:text-white">
                      {metrics.tokensPerDay.toLocaleString()}
                    </div>
                    <div className="text-xs text-neutral-500 dark:text-neutral-400">Tokens/Day</div>
                  </div>
                  <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-3">
                    <div className={`text-2xl font-bold ${metrics.errorsLast24h > 0 ? 'text-error' : 'text-success'}`}>
                      {metrics.errorsLast24h}
                    </div>
                    <div className="text-xs text-neutral-500 dark:text-neutral-400">Errors (24h)</div>
                  </div>
                </div>

                {/* Top tasks */}
                {metrics.topTasks.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                      Top Tasks
                    </h3>
                    <div className="space-y-2">
                      {metrics.topTasks.map((task, i) => (
                        <div key={task.task} className="flex items-center gap-3">
                          <span className="text-xs text-neutral-400 w-4">{i + 1}.</span>
                          <div className="flex-1">
                            <div className="h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-info rounded-full"
                                style={{ width: `${(task.count / metrics.topTasks[0].count) * 100}%` }}
                              />
                            </div>
                          </div>
                          <span className="text-xs text-neutral-500 dark:text-neutral-400 w-12 text-right">
                            {task.count}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>

      {/* Footer with actions */}
      <div className="p-4 border-t border-neutral-200 dark:border-neutral-700">
        <div className="flex gap-2">
          <button
            onClick={() => handleAction('refresh')}
            className="flex-1 px-3 py-2 text-sm bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors"
          >
            🔄 Refresh
          </button>
          <button
            onClick={() => handleAction('view_full')}
            className="flex-1 px-3 py-2 text-sm bg-info hover:bg-info text-white rounded-lg transition-colors"
          >
            Open Full View
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export default AgentInspectPanel;

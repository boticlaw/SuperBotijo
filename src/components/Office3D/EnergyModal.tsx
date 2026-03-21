'use client';

import { useState, useEffect } from 'react';
import { Zap, Activity, Cpu, HardDrive, Clock, Users } from 'lucide-react';

interface EnergyModalProps {
  onClose: () => void;
}

interface SystemStats {
  cpu: {
    load: number;
    loadAvg1: number;
    loadAvg5: number;
    loadAvg15: number;
  };
  memory: {
    total: number;
    used: number;
    free: number;
  };
  disk: {
    total: number;
    used: number;
  };
  uptime: string;
  activeAgents: number;
  totalAgents: number;
  tokensToday: number;
}

export function EnergyModal({ onClose }: EnergyModalProps) {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/system/stats');
        const data = await res.json();
        setStats(data);
      } catch (error) {
        console.error('Failed to fetch system stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);



  const getLoadColor = (load: number): string => {
    if (load < 50) return 'text-success';
    if (load < 80) return 'text-warning';
    return 'text-error';
  };

  const getMemoryPercent = (): number => {
    if (!stats?.memory) return 0;
    return Math.round((stats.memory.used / stats.memory.total) * 100);
  };

  const getDiskPercent = (): number => {
    if (!stats?.disk) return 0;
    return Math.round((stats.disk.used / stats.disk.total) * 100);
  };

  return (
    <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-neutral-900 border border-warning rounded-lg p-6 max-w-lg w-full mx-4 shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-warning flex items-center gap-2">
            <Zap className="w-6 h-6" />
            Agent Energy Dashboard
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
            {/* Agent Status */}
            <div className="bg-neutral-800 p-4 rounded-lg border border-neutral-700">
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-5 h-5 text-info" />
                <h3 className="text-sm font-semibold text-neutral-300">Agents</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <p className="text-3xl font-bold text-success">
                    {stats?.activeAgents || 0}
                  </p>
                  <p className="text-xs text-neutral-400">Active</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-neutral-400">
                    {stats?.totalAgents || 1}
                  </p>
                  <p className="text-xs text-neutral-400">Total</p>
                </div>
              </div>
            </div>

            {/* System Resources */}
            <div className="grid grid-cols-3 gap-3">
              {/* CPU */}
              <div className="bg-neutral-800 p-3 rounded-lg border border-neutral-700 text-center">
                <Cpu className="w-5 h-5 mx-auto mb-2 text-info" />
                <p className={`text-2xl font-bold ${getLoadColor(stats?.cpu?.load || 0)}`}>
                  {stats?.cpu?.load?.toFixed(1) || 0}%
                </p>
                <p className="text-xs text-neutral-400">CPU</p>
              </div>

              {/* Memory */}
              <div className="bg-neutral-800 p-3 rounded-lg border border-neutral-700 text-center">
                <Activity className="w-5 h-5 mx-auto mb-2 text-warning" />
                <p className={`text-2xl font-bold ${getMemoryPercent() > 80 ? 'text-error' : getMemoryPercent() > 50 ? 'text-warning' : 'text-success'}`}>
                  {getMemoryPercent()}%
                </p>
                <p className="text-xs text-neutral-400">RAM</p>
              </div>

              {/* Disk */}
              <div className="bg-neutral-800 p-3 rounded-lg border border-neutral-700 text-center">
                <HardDrive className="w-5 h-5 mx-auto mb-2 text-neutral-400" />
                <p className={`text-2xl font-bold ${getDiskPercent() > 80 ? 'text-error' : getDiskPercent() > 50 ? 'text-warning' : 'text-success'}`}>
                  {getDiskPercent()}%
                </p>
                <p className="text-xs text-neutral-400">Disk</p>
              </div>
            </div>

            {/* Tokens Today */}
            <div className="bg-neutral-800 p-4 rounded-lg border border-neutral-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-neutral-400">Tokens consumed today</p>
                  <p className="text-2xl font-bold text-warning">
                    {stats?.tokensToday?.toLocaleString() || 0}
                  </p>
                </div>
                <Clock className="w-8 h-8 text-neutral-600" />
              </div>
            </div>

            {/* Uptime */}
            <div className="bg-neutral-800 p-4 rounded-lg border border-neutral-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-neutral-400">System Uptime</p>
                  <p className="text-xl font-bold text-info">
                    {stats?.uptime || '0h 0m'}
                  </p>
                </div>
                <Clock className="w-8 h-8 text-neutral-600" />
              </div>
            </div>
          </div>
        )}

        <button
          onClick={onClose}
          className="mt-6 w-full bg-warning hover:bg-warning/90 text-black font-bold py-2 rounded transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}

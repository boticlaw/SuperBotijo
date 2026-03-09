"use client";

import { useState } from "react";
import { 
  MessageCircle, 
  Twitter, 
  Mail, 
  Key,
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  RefreshCw, 
  Play, 
  RotateCcw,
  Bot, 
  Cpu, 
  FileText, 
  Globe, 
  Brain, 
  Zap,
  X,
  Settings,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useI18n } from "@/i18n/provider";

interface Integration {
  id: string;
  name: string;
  status: "connected" | "disconnected" | "configured" | "not_configured";
  icon: string;
  lastActivity: string | null;
  detail?: string | null;
  type?: "channel" | "plugin" | "api_key";
}

interface IntegrationStatusProps {
  integrations: Integration[] | null;
  onRefresh?: () => void;
}

interface ActivityStats {
  lastActivity: string | null;
  lastActivityRelative: string | null;
  usage24h: number;
  usage7d: number;
  usage30d: number;
}

interface TestResult {
  success: boolean;
  message: string;
  details?: string;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  MessageCircle,
  twitter: Twitter,
  Mail,
  Key,
  bot: Bot,
  cpu: Cpu,
  filetext: FileText,
  globe: Globe,
  brain: Brain,
  zap: Zap,
  telegram: MessageCircle,
  discord: MessageCircle,
  slack: MessageCircle,
  openai: Brain,
  anthropic: Cpu,
  brave: Globe,
  tavily: Globe,
  gemini: Zap,
  skill: FileText,
  key: Key,
};

const statusConfig = {
  connected: {
    icon: CheckCircle,
    color: "text-success",
    bg: "bg-success/10",
    border: "border-success/30",
    label: "Connected",
  },
  disconnected: {
    icon: XCircle,
    color: "text-error",
    bg: "bg-error/10",
    border: "border-error/30",
    label: "Disconnected",
  },
  configured: {
    icon: CheckCircle,
    color: "text-info",
    bg: "bg-info/10",
    border: "border-info/30",
    label: "Configured",
  },
  not_configured: {
    icon: AlertCircle,
    color: "text-warning",
    bg: "bg-warning/10",
    border: "border-warning/30",
    label: "Not Configured",
  },
};

// Modal Component
function IntegrationDetailModal({
  integration,
  onClose,
  onRefresh,
}: {
  integration: Integration;
  onClose: () => void;
  onRefresh?: () => void;
}) {
  const { t } = useI18n();
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [toggling, setToggling] = useState(false);
  const [enabled, setEnabled] = useState(integration.status !== "not_configured");
  const [loadingStats, setLoadingStats] = useState(false);
  const [stats, setStats] = useState<ActivityStats | null>(null);

  const Icon = iconMap[integration.icon] || MessageCircle;
  const status = statusConfig[integration.status];
  const StatusIcon = status.icon;

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`/api/integrations/${integration.id}/test`, {
        method: "POST",
      });
      const result = await res.json();
      setTestResult(result);
    } catch {
      setTestResult({ success: false, message: "Test failed" });
    } finally {
      setTesting(false);
    }
  };

  const handleToggle = async () => {
    if (!confirm(`${enabled ? "Disable" : "Enable"} ${integration.name}? Changes will be saved to openclaw.json.`)) {
      return;
    }

    setToggling(true);
    try {
      const res = await fetch(`/api/integrations/${integration.id}/toggle`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !enabled }),
      });

      if (res.ok) {
        setEnabled(!enabled);
        onRefresh?.();
      } else {
        alert("Failed to toggle integration");
      }
    } catch (error) {
      console.error("Failed to toggle:", error);
      alert("Failed to toggle integration");
    } finally {
      setToggling(false);
    }
  };

  const loadStats = async () => {
    setLoadingStats(true);
    try {
      const res = await fetch(`/api/integrations/${integration.id}/last-activity`);
      const data = await res.json();
      setStats(data);
    } catch {
      console.error("Failed to load stats");
    } finally {
      setLoadingStats(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.8)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl overflow-hidden"
        style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between p-4"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="p-2 rounded-lg"
              style={{ backgroundColor: "var(--surface-elevated)" }}
            >
              <Icon className="w-5 h-5 text-secondary" />
            </div>
            <div>
              <h2
                className="font-semibold"
                style={{ color: "var(--text-primary)", fontFamily: "var(--font-heading)" }}
              >
                {integration.name}
              </h2>
              <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
                <span>ID: {integration.id}</span>
                {integration.type && <span>• {integration.type}</span>}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" style={{ color: "var(--text-muted)" }} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          {/* Status */}
          <div className="flex items-center justify-between">
            <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Status</span>
            <div className={`flex items-center gap-1.5 ${status.color}`}>
              <StatusIcon className="w-4 h-4" />
              <span className="text-sm font-medium">{status.label}</span>
            </div>
          </div>

          {/* Detail */}
          {integration.detail && (
            <div className="flex items-center justify-between">
              <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Detail</span>
              <span className="text-sm" style={{ color: "var(--text-muted)" }}>{integration.detail}</span>
            </div>
          )}

          {/* Toggle (only for plugins/channels) */}
          {integration.type !== "api_key" && (
            <div className="flex items-center justify-between">
              <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Enabled</span>
              <button
                onClick={handleToggle}
                disabled={toggling}
                className="relative w-12 h-6 rounded-full transition-colors disabled:opacity-50"
                style={{
                  backgroundColor: enabled ? "var(--accent)" : "var(--text-muted)",
                }}
              >
                <div
                  className="absolute top-1 w-4 h-4 rounded-full bg-white transition-all"
                  style={{
                    left: enabled ? "26px" : "4px",
                  }}
                />
              </button>
            </div>
          )}

          {/* Test Button */}
          <button
            onClick={handleTest}
            disabled={testing}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors"
            style={{
              backgroundColor: "var(--surface-elevated)",
              color: "var(--text-secondary)",
              border: "1px solid var(--border)",
            }}
          >
            {testing ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            Test Connection
          </button>

          {/* Test Result */}
          {testResult && (
            <div
              className={`p-3 rounded-lg text-sm ${
                testResult.success
                  ? "bg-success/10 border border-success/30"
                  : "bg-error/10 border border-error/30"
              }`}
              style={{
                color: testResult.success ? "var(--success)" : "var(--error)",
              }}
            >
              <div className="font-medium">{testResult.message}</div>
              {testResult.details && (
                <div className="text-xs mt-1" style={{ opacity: 0.8 }}>{testResult.details}</div>
              )}
            </div>
          )}

          {/* Usage Stats */}
          <div>
            <button
              onClick={loadStats}
              disabled={loadingStats}
              className="flex items-center gap-2 text-sm mb-2"
              style={{ color: "var(--text-secondary)" }}
            >
              {loadingStats ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Activity className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
              )}
              Usage Statistics
            </button>
            {stats && (
              <div
                className="grid grid-cols-3 gap-2 p-3 rounded-lg"
                style={{ backgroundColor: "var(--surface-elevated)" }}
              >
                <div className="text-center">
                  <div className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
                    {stats.usage24h}
                  </div>
                  <div className="text-xs" style={{ color: "var(--text-muted)" }}>Today</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
                    {stats.usage7d}
                  </div>
                  <div className="text-xs" style={{ color: "var(--text-muted)" }}>This Week</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
                    {stats.usage30d}
                  </div>
                  <div className="text-xs" style={{ color: "var(--text-muted)" }}>This Month</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex justify-end gap-2 p-4"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{
              backgroundColor: "var(--surface-elevated)",
              color: "var(--text-secondary)",
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// Add ActivityStats icon import
import { Activity } from "lucide-react";

export function IntegrationStatus({ integrations, onRefresh }: IntegrationStatusProps) {
  const { t } = useI18n();
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);

  if (!integrations) {
    return (
      <div className="rounded-xl p-6 animate-pulse" style={{ backgroundColor: "var(--card)" }}>
        <div className="h-6 rounded w-1/3 mb-4" style={{ backgroundColor: "var(--surface-elevated)" }}></div>
        <div className="h-16 rounded"></div>
        <div className="h-16 rounded"></div>
      </div>
    );
  }

  if (integrations.length === 0) {
    return (
      <div className="rounded-xl p-6" style={{ backgroundColor: "var(--card)" }}>
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
          <MessageCircle className="w-5 h-5" style={{ color: "var(--success)" }} />
          {t("integrations.title")}
        </h2>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          {t("integrations.noIntegrations")}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl p-6" style={{ backgroundColor: "var(--card)" }}>
      <h2 className="text-xl font-semibold mb-4 flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
        <MessageCircle className="w-5 h-5" style={{ color: "var(--success)" }} />
        {t("integrations.title")}
      </h2>

      <div className="space-y-2">
        {integrations.map((integration) => {
          const Icon = iconMap[integration.icon] || MessageCircle;
          const status = statusConfig[integration.status];
          const StatusIcon = status.icon;

          return (
            <div
              key={integration.id}
              onClick={() => setSelectedIntegration(integration)}
              className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all hover:border-accent/50"
              style={{
                backgroundColor: "var(--surface-elevated)",
                borderColor: "var(--border)",
              }}
            >
              <div className="p-2 rounded-lg" style={{ backgroundColor: "var(--card)" }}>
                <Icon className="w-5 h-5 text-secondary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium" style={{ color: "var(--text-primary)" }}>
                  {integration.name}
                </div>
                <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
                  {integration.type && <span>{integration.type}</span>}
                  {integration.detail && <span>• {integration.detail}</span>}
                </div>
              </div>
              <div className={`flex items-center gap-1.5 ${status.color}`}>
                <StatusIcon className="w-4 h-4" />
                <span className="text-sm font-medium">{status.label}</span>
              </div>
              <Settings className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
            </div>
          );
        })}
      </div>

      {/* Modal */}
      {selectedIntegration && (
        <IntegrationDetailModal
          integration={selectedIntegration}
          onClose={() => setSelectedIntegration(null)}
          onRefresh={onRefresh}
        />
      )}
    </div>
  );
}

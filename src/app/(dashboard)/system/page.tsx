"use client";

import { useEffect, useState } from "react";
import { QueueStatus } from "@/components/QueueStatus";
import { useI18n } from "@/i18n/provider";
import { Cpu, HardDrive, MemoryStick, Activity, Network, Server, ShieldCheck, RotateCw, Wifi, Monitor, Play, Square, X, Loader2, Terminal, ArrowDown, ArrowUp } from "lucide-react";

interface SystemdService {
  name: string;
  status: string;
  description: string;
  backend?: string;
  uptime?: number | null;
  restarts?: number;
  pid?: number | null;
  mem?: number | null;
  cpu?: number | null;
}

interface TailscaleDevice {
  ip: string;
  hostname: string;
  os: string;
  online: boolean;
}

interface FirewallRule {
  port: string;
  action: string;
  from: string;
  comment: string;
}

interface SystemData {
  cpu: { usage: number; cores: number[]; loadAvg: number[] };
  ram: { total: number; used: number; free: number; cached: number };
  disk: { total: number; used: number; free: number; percent: number };
  network: { rx: number; tx: number };
  systemd: SystemdService[];
  tailscale: { active: boolean; ip: string; devices: TailscaleDevice[] };
  firewall: { active: boolean; rules: FirewallRule[]; ruleCount: number };
}

interface LogsModal {
  name: string;
  backend: string;
  content: string;
  loading: boolean;
}

function formatUptime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function SystemMonitorPage() {
  const [systemData, setSystemData] = useState<SystemData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [selectedTab, setSelectedTab] = useState<"hardware" | "services">("hardware");
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [logsModal, setLogsModal] = useState<LogsModal | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const { t } = useI18n();

  useEffect(() => {
    const fetchSystemData = async () => {
      try {
        const res = await fetch("/api/system/monitor");
        if (res.ok) {
          const data = await res.json();
          setSystemData(data);
          setLastUpdated(new Date());
        }
      } catch (error) {
        console.error("Failed to fetch system data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSystemData();
    const interval = setInterval(fetchSystemData, 5000);
    return () => clearInterval(interval);
  }, []);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleServiceAction = async (svc: SystemdService, action: "restart" | "stop" | "start" | "logs") => {
    const key = `${svc.name}-${action}`;
    setActionLoading((prev) => ({ ...prev, [key]: true }));

    try {
      if (action === "logs") {
        setLogsModal({ name: svc.name, backend: svc.backend || "pm2", content: "", loading: true });
      }

      const res = await fetch("/api/system/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: svc.name, backend: svc.backend || "pm2", action }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Action failed");

      if (action === "logs") {
        setLogsModal({ name: svc.name, backend: svc.backend || "pm2", content: data.output, loading: false });
      } else {
        showToast(`✅ ${svc.name}: ${action} ${t("system.actionSuccessful")}`);
        // Refresh data after action
        setTimeout(async () => {
          const r = await fetch("/api/system/monitor");
          if (r.ok) setSystemData(await r.json());
        }, 2000);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("system.actionFailed");
      if (action === "logs") {
        setLogsModal({ name: svc.name, backend: svc.backend || "pm2", content: `Error: ${msg}`, loading: false });
      } else {
        showToast(`❌ ${svc.name}: ${msg}`, "error");
      }
    } finally {
      setActionLoading((prev) => ({ ...prev, [key]: false }));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: "var(--accent)" }}></div>
          <p style={{ color: "var(--text-secondary)" }}>{t("system.loading")}</p>
        </div>
      </div>
    );
  }

  if (!systemData) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Server className="w-16 h-16 mx-auto mb-4" style={{ color: "var(--text-muted)" }} />
          <p style={{ color: "var(--text-secondary)" }}>{t("system.failed")}</p>
        </div>
      </div>
    );
  }

  const cpuColor = systemData.cpu.usage < 60 ? "var(--success)" : systemData.cpu.usage < 85 ? "var(--warning)" : "var(--error)";
  const ramPercent = (systemData.ram.used / systemData.ram.total) * 100;
  const ramColor = ramPercent < 60 ? "var(--success)" : ramPercent < 85 ? "var(--warning)" : "var(--error)";
  const diskColor = systemData.disk.percent < 60 ? "var(--success)" : systemData.disk.percent < 85 ? "var(--warning)" : "var(--error)";

  const activeServices = systemData.systemd.filter((s) => s.status === "active").length;

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: "1rem", right: "1rem", zIndex: 1000,
          padding: "0.75rem 1.25rem", borderRadius: "0.75rem",
          backgroundColor: toast.type === "success" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
          border: `1px solid ${toast.type === "success" ? "var(--success)" : "var(--error)"}`,
          color: toast.type === "success" ? "var(--success)" : "var(--error)",
          fontSize: "0.9rem", fontWeight: 500,
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: "var(--font-heading)", color: "var(--text-primary)" }}>
            {t("system.title")}
          </h1>
          <p style={{ color: "var(--text-secondary)" }}>{t("system.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: "rgba(34,197,94,0.12)", color: "var(--success)" }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: "var(--success)" }} />
            {t("system.live")}
          </span>
          {lastUpdated && (
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>{lastUpdated.toLocaleTimeString()}</span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b" style={{ borderColor: "var(--border)" }}>
        {[{ id: "hardware", labelKey: "system.hardware", icon: Cpu }, { id: "services", labelKey: "system.services", icon: Server }].map((tab) => {
          const Icon = tab.icon;
          const isActive = selectedTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setSelectedTab(tab.id as "hardware" | "services")}
              className="flex items-center gap-2 px-4 py-2 font-medium transition-all"
              style={{ color: isActive ? "var(--accent)" : "var(--text-secondary)", borderBottom: isActive ? "2px solid var(--accent)" : "2px solid transparent" }}
            >
              <Icon className="w-4 h-4" />
              {t(tab.labelKey)}
            </button>
          );
        })}
      </div>

      {/* Hardware Tab */}
      {selectedTab === "hardware" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* CPU */}
          <div className="p-6 rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg" style={{ backgroundColor: "var(--card-elevated)" }}>
                  <Cpu className="w-5 h-5" style={{ color: cpuColor }} />
                </div>
                <div>
                  <h3 className="font-semibold" style={{ color: "var(--text-primary)" }}>{t("system.cpu")}</h3>
                  <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{t("system.cores", { count: systemData.cpu.cores.length })}</p>
                </div>
              </div>
              <span className="text-2xl font-bold" style={{ color: cpuColor }}>{systemData.cpu.usage}%</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden mb-3" style={{ backgroundColor: "var(--card-elevated)" }}>
              <div className="h-full transition-all duration-500" style={{ width: `${systemData.cpu.usage}%`, backgroundColor: cpuColor }} />
            </div>
            <div className="flex justify-between text-sm" style={{ color: "var(--text-secondary)" }}>
              <span>{t("system.loadAverage")}</span>
              <span>{systemData.cpu.loadAvg[0].toFixed(2)} / {systemData.cpu.loadAvg[1].toFixed(2)} / {systemData.cpu.loadAvg[2].toFixed(2)}</span>
            </div>
          </div>

          {/* RAM */}
          <div className="p-6 rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg" style={{ backgroundColor: "var(--card-elevated)" }}>
                  <MemoryStick className="w-5 h-5" style={{ color: ramColor }} />
                </div>
                <div>
                  <h3 className="font-semibold" style={{ color: "var(--text-primary)" }}>{t("system.ram")}</h3>
                  <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{systemData.ram.used.toFixed(1)}GB / {systemData.ram.total.toFixed(1)}GB</p>
                </div>
              </div>
              <span className="text-2xl font-bold" style={{ color: ramColor }}>{ramPercent.toFixed(0)}%</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: "var(--card-elevated)" }}>
              <div className="h-full transition-all duration-500" style={{ width: `${ramPercent}%`, backgroundColor: ramColor }} />
            </div>
          </div>

          {/* Disk */}
          <div className="p-6 rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg" style={{ backgroundColor: "var(--card-elevated)" }}>
                  <HardDrive className="w-5 h-5" style={{ color: diskColor }} />
                </div>
                <div>
                  <h3 className="font-semibold" style={{ color: "var(--text-primary)" }}>{t("system.disk")}</h3>
                  <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{systemData.disk.used.toFixed(1)}GB / {systemData.disk.total.toFixed(1)}GB</p>
                </div>
              </div>
              <span className="text-2xl font-bold" style={{ color: diskColor }}>{systemData.disk.percent.toFixed(0)}%</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: "var(--card-elevated)" }}>
              <div className="h-full transition-all duration-500" style={{ width: `${systemData.disk.percent}%`, backgroundColor: diskColor }} />
            </div>
          </div>

          {/* Network */}
          <div className="p-6 rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg" style={{ backgroundColor: "var(--card-elevated)" }}>
                <Network className="w-5 h-5" style={{ color: "var(--info, #3b82f6)" }} />
              </div>
              <div>
                <h3 className="font-semibold" style={{ color: "var(--text-primary)" }}>{t("system.network")}</h3>
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{t("system.liveIO")}</p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                  <ArrowDown className="w-4 h-4" style={{ color: "var(--success)" }} />
                  <span>{t("system.rxIn")}</span>
                </div>
                <span className="font-mono text-sm" style={{ color: "var(--text-primary)" }}>{systemData.network.rx.toFixed(2)} MB/s</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                  <ArrowUp className="w-4 h-4" style={{ color: "var(--accent)" }} />
                  <span>{t("system.txOut")}</span>
                </div>
                <span className="font-mono text-sm" style={{ color: "var(--text-primary)" }}>{systemData.network.tx.toFixed(2)} MB/s</span>
              </div>
              {/* Mini bar viz */}
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>RX</div>
                  <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: "var(--card-elevated)" }}>
                    <div className="h-full" style={{ width: `${Math.min(systemData.network.rx * 10, 100)}%`, backgroundColor: "var(--success)" }} />
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>TX</div>
                  <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: "var(--card-elevated)" }}>
                    <div className="h-full" style={{ width: `${Math.min(systemData.network.tx * 10, 100)}%`, backgroundColor: "var(--accent)" }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
          </div>
          <QueueStatus />
        </div>
      )}

      {/* Services Tab */}
      {selectedTab === "services" && (
        <div className="space-y-6">
          {/* Systemd + PM2 Services */}
          <div className="p-6 rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
              <Server className="w-5 h-5" style={{ color: "var(--accent)" }} />
              Services ({activeServices}/{systemData.systemd.length} active)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    <th className="text-left py-2 px-3 text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Service</th>
                    <th className="text-left py-2 px-3 text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Description</th>
                    <th className="text-left py-2 px-3 text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Status</th>
                    <th className="text-right py-2 px-3 text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {systemData.systemd.map((svc) => {
                    const isActionable = svc.backend === "pm2" || svc.backend === "systemd";
                    const restartKey = `${svc.name}-restart`;
                    const stopKey = `${svc.name}-stop`;
                    const logsKey = `${svc.name}-logs`;

                    return (
                      <tr key={svc.name} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td className="py-3 px-3">
                          <span className="font-mono font-medium" style={{ color: "var(--text-primary)" }}>{svc.name}</span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{svc.description || "—"}</span>
                            {svc.uptime != null && svc.status === "active" && (
                              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                                up {formatUptime(svc.uptime)}
                                {svc.restarts != null && svc.restarts > 0 && ` · ${svc.restarts} restarts`}
                                {svc.mem != null && ` · ${formatBytes(svc.mem)}`}
                                {svc.cpu != null && ` · ${svc.cpu.toFixed(1)}% CPU`}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <div
                              className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{
                                backgroundColor:
                                  svc.status === "active" ? "var(--success)" :
                                  svc.status === "not_deployed" ? "var(--info, #3b82f6)" :
                                  svc.status === "failed" ? "var(--error)" : "var(--text-muted)",
                              }}
                            />
                            <span
                              className="px-2 py-1 rounded text-xs font-medium"
                              style={{
                                backgroundColor:
                                  svc.status === "active" ? "var(--success-bg)" :
                                  svc.status === "not_deployed" ? "rgba(59,130,246,0.12)" :
                                  svc.status === "failed" ? "var(--error-bg)" : "var(--card-elevated)",
                                color:
                                  svc.status === "active" ? "var(--success)" :
                                  svc.status === "not_deployed" ? "#60a5fa" :
                                  svc.status === "failed" ? "var(--error)" : "var(--text-muted)",
                              }}
                            >
                              {svc.status === "not_deployed" ? "not deployed" : svc.status}
                            </span>
                            {svc.backend && svc.backend !== "none" && (
                              <span
                                className="px-1.5 py-0.5 rounded text-xs"
                                style={{ backgroundColor: "var(--card-elevated)", color: "var(--text-muted)", fontSize: "10px" }}
                              >
                                {svc.backend}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex justify-end gap-1">
                            {isActionable && (
                              <>
                                {/* Restart */}
                                <button
                                  onClick={() => handleServiceAction(svc, "restart")}
                                  disabled={actionLoading[restartKey]}
                                  className="p-1.5 rounded transition-colors"
                                  title="Restart"
                                  style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}
                                >
                                  {actionLoading[restartKey] ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <RotateCw className="w-4 h-4" />
                                  )}
                                </button>

                                {/* Stop/Start */}
                                <button
                                  onClick={() => handleServiceAction(svc, svc.status === "active" ? "stop" : "start")}
                                  disabled={actionLoading[stopKey] || svc.status === "not_deployed"}
                                  className="p-1.5 rounded transition-colors"
                                  title={svc.status === "active" ? "Stop" : "Start"}
                                  style={{ color: svc.status === "active" ? "var(--error)" : "var(--success)", background: "none", border: "none", cursor: "pointer" }}
                                >
                                  {svc.status === "active" ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                                </button>

                                {/* Logs */}
                                <button
                                  onClick={() => handleServiceAction(svc, "logs")}
                                  disabled={actionLoading[logsKey]}
                                  className="p-1.5 rounded transition-colors"
                                  title="View Logs"
                                  style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}
                                >
                                  {actionLoading[logsKey] ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Terminal className="w-4 h-4" />
                                  )}
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* VPN & Firewall */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Tailscale VPN */}
            <div className="p-6 rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg" style={{ backgroundColor: "var(--card-elevated)" }}>
                  <Wifi className="w-5 h-5" style={{ color: systemData.tailscale.active ? "var(--success)" : "var(--error)" }} />
                </div>
                <div>
                  <h3 className="font-semibold" style={{ color: "var(--text-primary)" }}>Tailscale VPN</h3>
                  <p className="text-sm" style={{ color: systemData.tailscale.active ? "var(--success)" : "var(--error)" }}>
                    {systemData.tailscale.active ? "Active" : "Inactive"}
                  </p>
                </div>
              </div>
              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span style={{ color: "var(--text-secondary)" }}>This server</span>
                  <span className="font-mono" style={{ color: "var(--text-primary)" }}>{systemData.tailscale.ip}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span style={{ color: "var(--text-secondary)" }}>Devices connected</span>
                  <span style={{ color: "var(--text-primary)" }}>{systemData.tailscale.devices.length}</span>
                </div>
              </div>
              {systemData.tailscale.devices.length > 0 && (
                <div className="space-y-2 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
                  {systemData.tailscale.devices.map((dev, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <Monitor className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
                        <span className="font-mono" style={{ color: "var(--text-secondary)" }}>{dev.hostname}</span>
                        <span style={{ color: "var(--text-muted)" }}>({dev.os})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono" style={{ color: "var(--text-muted)" }}>{dev.ip}</span>
                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: dev.online ? "var(--success)" : "var(--text-muted)" }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Firewall */}
            <div className="p-6 rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg" style={{ backgroundColor: "var(--card-elevated)" }}>
                  <ShieldCheck className="w-5 h-5" style={{ color: systemData.firewall.active ? "var(--success)" : "var(--error)" }} />
                </div>
                <div>
                  <h3 className="font-semibold" style={{ color: "var(--text-primary)" }}>Firewall (UFW)</h3>
                  <p className="text-sm" style={{ color: systemData.firewall.active ? "var(--success)" : "var(--error)" }}>
                    {systemData.firewall.active ? "Active" : "Inactive"}
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                {systemData.firewall.rules.map((rule, i) => (
                  <div
                    key={i}
                    className="flex items-start justify-between text-xs py-1.5"
                    style={{ borderBottom: i < systemData.firewall.rules.length - 1 ? "1px solid var(--border)" : "none" }}
                  >
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold" style={{ color: "var(--text-primary)" }}>{rule.port}</span>
                        <span className="px-1.5 py-0.5 rounded text-xs" style={{ backgroundColor: "var(--success-bg)", color: "var(--success)", fontSize: "9px" }}>
                          {rule.action}
                        </span>
                      </div>
                      {rule.comment && <span style={{ color: "var(--text-muted)", fontSize: "10px" }}>{rule.comment}</span>}
                    </div>
                    <span className="font-mono text-right" style={{ color: "var(--text-secondary)", maxWidth: "120px", wordBreak: "break-all" }}>
                      {rule.from}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Logs Modal */}
      {logsModal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 1000,
          backgroundColor: "rgba(0,0,0,0.85)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "1rem",
        }}>
          <div style={{
            width: "95vw", maxWidth: "900px", height: "80vh",
            backgroundColor: "#0d1117",
            borderRadius: "1rem", border: "1px solid var(--border)",
            display: "flex", flexDirection: "column",
            overflow: "hidden",
          }}>
            {/* Log header */}
            <div style={{
              display: "flex", alignItems: "center", gap: "0.75rem",
              padding: "0.875rem 1rem",
              borderBottom: "1px solid var(--border)",
              flexShrink: 0,
            }}>
              <Terminal className="w-4 h-4" style={{ color: "var(--accent)" }} />
              <span style={{ color: "#c9d1d9", fontFamily: "monospace", fontSize: "0.9rem" }}>
                {logsModal.name} logs
              </span>
              <span style={{ fontSize: "0.75rem", color: "#8b949e", marginLeft: "0.5rem" }}>
                ({logsModal.backend})
              </span>
              <button
                onClick={() => setLogsModal(null)}
                style={{ marginLeft: "auto", padding: "0.375rem", borderRadius: "0.375rem", background: "none", border: "none", cursor: "pointer", color: "#8b949e" }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Log content */}
            <div style={{ flex: 1, overflow: "auto", padding: "1rem" }}>
              {logsModal.loading ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
                  <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--accent)" }} />
                </div>
              ) : (
                <pre style={{
                  fontFamily: "monospace", fontSize: "0.8rem",
                  color: "#c9d1d9", whiteSpace: "pre-wrap", wordBreak: "break-all",
                  lineHeight: 1.6,
                }}>
                  {logsModal.content || "No log output"}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

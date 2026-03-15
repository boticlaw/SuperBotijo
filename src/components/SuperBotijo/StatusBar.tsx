"use client";

import { useEffect, useState } from "react";
import { Cpu, HardDrive, MemoryStick, ShieldCheck, Clock, LucideIcon } from "lucide-react";
import { useI18n } from "@/i18n/provider";

interface SystemStats {
  cpu: { load: number; loadAvg1: number; loadAvg5: number; loadAvg15: number };
  memory: { used: number; total: number; free: number };
  disk: { used: number; total: number };
  vpnActive: boolean;
  firewallActive: boolean;
  activeServices: number;
  totalServices: number;
  uptime: string;
}

interface StatusMetricProps {
  icon: LucideIcon;
  label: string;
  value: string;
  barPercent?: number;
  color?: string;
}

function StatusMetric({ icon: Icon, label, value, barPercent, color }: StatusMetricProps) {
  return (
    <div className="flex items-center gap-1.5" style={{ height: "24px" }}>
      <Icon style={{ width: "14px", height: "14px", color: "var(--text-muted)" }} />
      <span
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "11px",
          fontWeight: 600,
          letterSpacing: "1px",
          color: "var(--text-muted)",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "11px",
          fontWeight: 600,
          color: "var(--text-secondary)",
        }}
      >
        {value}
      </span>
      {barPercent !== undefined && (
        <div
          style={{
            width: "48px",
            height: "4px",
            backgroundColor: "var(--surface-elevated)",
            borderRadius: "2px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${Math.min(100, barPercent)}%`,
              height: "100%",
              backgroundColor: color,
              borderRadius: "2px",
            }}
          />
        </div>
      )}
    </div>
  );
}

export function StatusBar() {
  const { t } = useI18n();
  const [stats, setStats] = useState<SystemStats>({
    cpu: { load: 0, loadAvg1: 0, loadAvg5: 0, loadAvg15: 0 },
    memory: { used: 0, total: 4, free: 4 },
    disk: { used: 0, total: 100 },
    vpnActive: false,
    firewallActive: true,
    activeServices: 0,
    totalServices: 4,
    uptime: "0d 0h",
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch("/api/system/stats");
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch (error) {
        console.error("Failed to fetch system stats:", error);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 30000);

    return () => clearInterval(interval);
  }, []);

  const cpuColor = stats.cpu.load < 60 ? "var(--positive)" : stats.cpu.load < 85 ? "var(--warning)" : "var(--negative)";
  const ramPercent = (stats.memory.used / stats.memory.total) * 100;
  const ramColor = ramPercent < 60 ? "var(--positive)" : ramPercent < 85 ? "var(--warning)" : "var(--negative)";
  const diskPercent = (stats.disk.used / stats.disk.total) * 100;
  const diskColor = diskPercent < 60 ? "var(--positive)" : diskPercent < 85 ? "var(--warning)" : "var(--negative)";

  return (
    <div
      className="status-bar"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: "32px",
        backgroundColor: "var(--surface)",
        borderTop: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        padding: "0 16px 0 84px",
        gap: "16px",
        zIndex: 40,
      }}
    >
      {/* CPU */}
      <StatusMetric icon={Cpu} label="CPU" value={`${stats.cpu.load}%`} barPercent={stats.cpu.load} color={cpuColor} />

      {/* RAM */}
      <StatusMetric
        icon={MemoryStick}
        label="RAM"
        value={`${stats.memory.used.toFixed(1)}/${stats.memory.total}GB`}
        barPercent={ramPercent}
        color={ramColor}
      />

      {/* Disk */}
      <StatusMetric
        icon={HardDrive}
        label="DISK"
        value={`${diskPercent.toFixed(0)}%`}
        barPercent={diskPercent}
        color={diskColor}
      />

      {/* Separator */}
      <div style={{ width: "1px", height: "16px", backgroundColor: "var(--border)" }} />

      {/* VPN Status */}
      <div className="flex items-center gap-1">
        <div
          style={{
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            backgroundColor: stats.vpnActive ? "var(--positive)" : "var(--negative)",
          }}
        />
        <span
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "10px",
            fontWeight: 600,
            letterSpacing: "1px",
            color: "var(--text-muted)",
          }}
        >
          VPN
        </span>
      </div>

      {/* Firewall Status */}
      <div className="flex items-center gap-1">
        <ShieldCheck
          style={{
            width: "12px",
            height: "12px",
            color: stats.firewallActive ? "var(--positive)" : "var(--negative)",
          }}
        />
        <span
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "10px",
            fontWeight: 600,
            letterSpacing: "1px",
            color: "var(--text-muted)",
          }}
        >
          UFW
        </span>
      </div>

      {/* Separator */}
      <div style={{ width: "1px", height: "16px", backgroundColor: "var(--border)" }} />

      {/* Systemd Services */}
      <div className="flex items-center gap-1">
        <span
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "10px",
            fontWeight: 500,
            color: "var(--text-muted)",
          }}
        >
          {t("statusBar.services")}: {stats.activeServices}/{stats.totalServices}
        </span>
      </div>

      {/* Separator */}
      <div style={{ width: "1px", height: "16px", backgroundColor: "var(--border)" }} />

      {/* Uptime */}
      <div className="flex items-center gap-1">
        <Clock style={{ width: "12px", height: "12px", color: "var(--text-muted)" }} />
        <span
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "10px",
            fontWeight: 500,
            color: "var(--text-muted)",
          }}
        >
          {t("statusBar.uptime")}: {stats.uptime}
        </span>
      </div>
    </div>
  );
}

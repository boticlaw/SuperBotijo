"use client";

import { Server, Clock, Cpu, Brain, FolderOpen, HardDrive } from "lucide-react";
import { useI18n } from "@/i18n/provider";

interface SystemInfoProps {
  data: {
    agent: {
      name: string;
      creature: string;
      emoji: string;
    };
    system: {
      uptime: number;
      uptimeFormatted: string;
      nodeVersion: string;
      model: string;
      workspacePath: string;
      platform: string;
      hostname: string;
      memory: {
        total: number;
        free: number;
        used: number;
      };
    };
  } | null;
}

function formatBytes(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024);
  return `${gb.toFixed(1)} GB`;
}

export function SystemInfo({ data }: SystemInfoProps) {
  const { t } = useI18n();

  if (!data) {
    return (
      <div 
        className="rounded-xl p-6 animate-pulse"
        style={{ backgroundColor: "var(--card)" }}
      >
        <div 
          className="h-6 rounded w-1/3 mb-4"
          style={{ backgroundColor: "var(--border)" }}
        ></div>
        <div className="space-y-3">
          <div className="h-4 rounded w-2/3" style={{ backgroundColor: "var(--border)" }}></div>
          <div className="h-4 rounded w-1/2" style={{ backgroundColor: "var(--border)" }}></div>
          <div className="h-4 rounded w-3/4" style={{ backgroundColor: "var(--border)" }}></div>
        </div>
      </div>
    );
  }

  const infoItems = [
    {
      icon: Server,
      labelKey: "systemInfo.agentName",
      value: `${data.agent.emoji} ${data.agent.name}`,
      sublabel: data.agent.creature,
    },
    {
      icon: Clock,
      labelKey: "systemInfo.uptime",
      value: data.system.uptimeFormatted,
      sublabel: `${data.system.hostname}`,
    },
    {
      icon: Cpu,
      labelKey: "systemInfo.nodeVersion",
      value: data.system.nodeVersion,
      sublabel: data.system.platform,
    },
    {
      icon: Brain,
      labelKey: "systemInfo.currentModel",
      value: data.system.model.split("/").pop() || data.system.model,
      sublabel: data.system.model.includes("/") ? data.system.model.split("/")[0] : t("systemInfo.provider"),
    },
    {
      icon: FolderOpen,
      labelKey: "systemInfo.workspace",
      value: data.system.workspacePath.split("/").pop() || "workspace",
      sublabel: data.system.workspacePath,
    },
    {
      icon: HardDrive,
      labelKey: "systemInfo.memory",
      value: `${formatBytes(data.system.memory.used)} / ${formatBytes(data.system.memory.total)}`,
      sublabel: `${formatBytes(data.system.memory.free)} ${t("systemInfo.free")}`,
    },
  ];

  return (
    <div 
      className="rounded-xl p-6"
      style={{ backgroundColor: "var(--card)" }}
    >
      <h2 
        className="text-xl font-semibold mb-6 flex items-center gap-2"
        style={{ color: "var(--text-primary)", fontFamily: "var(--font-heading)" }}
      >
        <Server className="w-5 h-5" style={{ color: "var(--accent)" }} />
        {t("systemInfo.title")}
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {infoItems.map((item, index) => {
          const Icon = item.icon;
          return (
            <div
              key={index}
              className="flex items-start gap-4 p-4 rounded-lg"
              style={{ 
                backgroundColor: "rgba(26, 26, 26, 0.5)", 
                border: "1px solid rgba(42, 42, 42, 0.5)" 
              }}
            >
              <div 
                className="p-2 rounded-lg"
                style={{ backgroundColor: "rgba(255, 59, 48, 0.1)" }}
              >
                <Icon className="w-5 h-5" style={{ color: "var(--accent)" }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm mb-1" style={{ color: "var(--text-secondary)" }}>
                  {t(item.labelKey)}
                </div>
                <div className="font-medium truncate" style={{ color: "var(--text-primary)" }}>
                  {item.value}
                </div>
                <div className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                  {item.sublabel}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

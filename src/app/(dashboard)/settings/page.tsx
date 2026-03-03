"use client";

import { useEffect, useState } from "react";
import { Settings, RefreshCw, Server, FileJson, DollarSign } from "lucide-react";
import { SystemInfo } from "@/components/SystemInfo";
import { IntegrationStatus } from "@/components/IntegrationStatus";
import { QuickActions } from "@/components/QuickActions";
import { ConfigEditor } from "@/components/ConfigEditor";
import { PricingEditor } from "@/components/PricingEditor";
import { useI18n } from "@/i18n/provider";

interface SystemData {
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
  integrations: Array<{
    id: string;
    name: string;
    status: "connected" | "disconnected" | "configured" | "not_configured";
    icon: string;
    lastActivity: string | null;
  }>;
  timestamp: string;
}

export default function SettingsPage() {
  const [systemData, setSystemData] = useState<SystemData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<"system" | "config" | "pricing">("system");
  const { t } = useI18n();

  const tabs = [
    { id: "system" as const, labelKey: "settings.tabs.system", icon: Server },
    { id: "config" as const, labelKey: "settings.tabs.config", icon: FileJson },
    { id: "pricing" as const, labelKey: "settings.tabs.pricing", icon: DollarSign },
  ];

  const fetchSystemData = async () => {
    try {
      const res = await fetch("/api/system");
      const data = await res.json();
      setSystemData(data);
      setLastRefresh(new Date());
    } catch (error) {
      console.error("Failed to fetch system data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSystemData();
    const interval = setInterval(fetchSystemData, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    setLoading(true);
    fetchSystemData();
  };

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 md:mb-8">
        <div>
          <h1 
            className="text-2xl md:text-3xl font-bold mb-1 md:mb-2 flex items-center gap-2 md:gap-3"
            style={{ color: "var(--text-primary)", fontFamily: "var(--font-heading)" }}
          >
            <Settings className="w-6 h-6 md:w-8 md:h-8" style={{ color: "var(--accent)" }} />
            {t("settings.title")}
          </h1>
          <p className="text-sm md:text-base" style={{ color: "var(--text-secondary)" }}>
            {t("settings.subtitle")}
          </p>
        </div>

        <button
          onClick={handleRefresh}
          disabled={loading}
          className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors disabled:opacity-50 w-full sm:w-auto"
          style={{ 
            backgroundColor: "var(--card)", 
            color: "var(--text-secondary)",
            border: "1px solid var(--border)"
          }}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          {t("common.refresh")}
        </button>
      </div>

      {/* Last Refresh Time */}
      {lastRefresh && activeTab === "system" && (
        <div className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
          {t("settings.lastUpdated")}: {lastRefresh.toLocaleTimeString()}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 rounded-lg" style={{ backgroundColor: "var(--card)" }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex items-center gap-2 px-4 py-2 rounded-md transition-all"
            style={{
              backgroundColor: activeTab === tab.id ? "var(--accent)" : "transparent",
              color: activeTab === tab.id ? "white" : "var(--text-secondary)",
            }}
          >
            <tab.icon className="w-4 h-4" />
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "system" && (
        <>
          {/* Grid Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
            {/* System Info - Full width on first row */}
            <div className="lg:col-span-2">
              <SystemInfo data={systemData} />
            </div>

            {/* Integration Status */}
            <div>
              <IntegrationStatus integrations={systemData?.integrations || null} />
            </div>

            {/* Quick Actions */}
            <div>
              <QuickActions onActionComplete={handleRefresh} />
            </div>
          </div>
        </>
      )}

      {activeTab === "config" && <ConfigEditor />}

      {activeTab === "pricing" && <PricingEditor />}

      {/* Footer Info */}
      <div 
        className="mt-6 md:mt-8 p-3 md:p-4 rounded-xl"
        style={{ 
          backgroundColor: "rgba(26, 26, 26, 0.5)", 
          border: "1px solid var(--border)" 
        }}
      >
        <div className="flex items-center justify-between text-sm" style={{ color: "var(--text-muted)" }}>
          <span>SuperBotijo v1.0.0</span>
          <span>OpenClaw Agent Dashboard</span>
        </div>
      </div>
    </div>
  );
}

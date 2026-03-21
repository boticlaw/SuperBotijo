"use client";

import { useEffect, useState, useMemo } from "react";
import Image from "next/image";
import { Settings, RefreshCw, Server, FileJson, DollarSign, User, Clock, Activity, CheckCircle, Puzzle, Heart, Sparkles, Brain, Zap, Terminal, Calendar, MapPin, Coffee, HardDrive, Cpu, Folder } from "lucide-react";
import { SystemInfo } from "@/components/SystemInfo";
import { IntegrationStatus } from "@/components/IntegrationStatus";
import { QuickActions } from "@/components/QuickActions";
import { ConfigEditor } from "@/components/ConfigEditor";
import { PricingEditor } from "@/components/PricingEditor";
import { useI18n } from "@/i18n/provider";
import { BRANDING, getAgentDisplayName } from "@/config/branding";

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

interface AboutStats {
  totalActivities: number;
  successRate: number;
  skillsCount: number;
  cronJobs: number;
}

interface RealSkill {
  id: string;
  name: string;
  description: string;
  emoji?: string;
  source: "workspace" | "system";
}

// Default skill icons/colors for display purposes
const SKILL_DISPLAY_COLORS = [
  "#0088cc", "#1DA1F2", "#facc15", "#60a5fa", "#f472b6", 
  "#34d399", "#FF0000", "#EA4335", "#8b5cf6", "#f97316"
];

// Dynamic personality traits from translations
const getPersonalityTraits = (t: (key: string) => string) => [
  { trait: t("about.traits.direct"), desc: t("about.traits.directDesc"), emoji: "🎯" },
  { trait: t("about.traits.efficient"), desc: t("about.traits.efficientDesc"), emoji: "⚡" },
  { trait: t("about.traits.curious"), desc: t("about.traits.curiousDesc"), emoji: "🔍" },
  { trait: t("about.traits.loyal"), desc: t("about.traits.loyalDesc"), emoji: "💎" },
];

const getPhilosophies = (t: (key: string) => string) => [
  t("about.philosophy.1"),
  t("about.philosophy.2"),
  t("about.philosophy.3"),
  t("about.philosophy.4"),
];

export default function SettingsPage() {
  const [systemData, setSystemData] = useState<SystemData | null>(null);
  const [aboutStats, setAboutStats] = useState<AboutStats | null>(null);
  const [realSkills, setRealSkills] = useState<RealSkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<"system" | "config" | "pricing" | "about">("system");
  const { t } = useI18n();

  const tabs = [
    { id: "system" as const, labelKey: "settings.tabs.system", icon: Server },
    { id: "config" as const, labelKey: "settings.tabs.config", icon: FileJson },
    { id: "pricing" as const, labelKey: "settings.tabs.pricing", icon: DollarSign },
    { id: "about" as const, labelKey: "settings.tabs.about", icon: User },
  ];

  const uptime = useMemo(() => {
    if (!BRANDING.birthDate) return "";
    const birthDate = new Date(BRANDING.birthDate);
    const now = new Date();
    const days = Math.floor(
      (now.getTime() - birthDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    return `${days}d`;
  }, []);

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

  const fetchAboutStats = async () => {
    try {
      const [activities, skillsRes, tasks] = await Promise.all([
        fetch("/api/activities").then((r) => r.json()),
        fetch("/api/skills").then((r) => r.json()),
        fetch("/api/tasks").then((r) => r.json()),
      ]);
      const total = activities.activities?.length || activities.length || 0;
      const success = (activities.activities || activities).filter(
        (a: { status: string }) => a.status === "success"
      ).length;
      
      // Skills API returns { skills: [...] }, not an array directly
      const skillsArray = skillsRes.skills || [];
      setRealSkills(skillsArray);
      
      setAboutStats({
        totalActivities: total,
        successRate: total > 0 ? Math.round((success / total) * 100) : 100,
        skillsCount: skillsArray.length || 0,
        cronJobs: tasks.length || 0,
      });
    } catch (error) {
      console.error("Failed to fetch about stats:", error);
    }
  };

  useEffect(() => {
    fetchSystemData();
    fetchAboutStats();
    const interval = setInterval(fetchSystemData, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    setLoading(true);
    fetchSystemData();
    fetchAboutStats();
  };

  const agentName = BRANDING.agentName;
  const ownerUsername = BRANDING.ownerUsername;
  const description =
    BRANDING.agentDescription ||
    `AI assistant for ${ownerUsername}. Powered by OpenClaw.`;

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
      <div className="flex gap-1 mb-6 p-1 rounded-lg overflow-x-auto" style={{ backgroundColor: "var(--card)" }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex items-center gap-2 px-4 py-2 rounded-md transition-all whitespace-nowrap"
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
              <IntegrationStatus integrations={systemData?.integrations || null} onRefresh={handleRefresh} />
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

      {activeTab === "about" && (
        <div className="max-w-4xl">
          {/* Hero Section */}
          <div
            className="rounded-xl p-4 md:p-6 mb-6"
            style={{
              backgroundColor: "var(--card)",
              border: "1px solid var(--border)",
            }}
          >
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left">
              {/* Avatar */}
              <div
                className="w-16 h-16 md:w-20 md:h-20 rounded-2xl overflow-hidden flex-shrink-0 flex items-center justify-center"
                style={{
                  border: "3px solid var(--accent)",
                  backgroundColor: "var(--background)",
                  fontSize: BRANDING.agentAvatar ? undefined : "2rem",
                }}
              >
                {BRANDING.agentAvatar ? (
                  <Image
                    src={BRANDING.agentAvatar}
                    alt={agentName}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <Image
                    src="/logo.png"
                    alt={agentName}
                    fill
                    className="object-contain p-1"
                  />
                )}
              </div>

              {/* Info */}
              <div className="flex-1">
                <div className="flex flex-col sm:flex-row items-center sm:items-center gap-2 mb-2">
                  <h2
                    className="text-xl md:text-2xl font-bold"
                    style={{
                      fontFamily: "var(--font-heading)",
                      color: "var(--text-primary)",
                    }}
                  >
                    {getAgentDisplayName()}
                  </h2>
                  <span
                    className="px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{
                      backgroundColor: "var(--success-bg)",
                      color: "var(--success)",
                    }}
                  >
                    ● {t("about.online")}
                  </span>
                </div>

                <p
                  className="text-sm mb-3"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {description}
                </p>

                <div
                  className="flex flex-wrap justify-center sm:justify-start gap-3 text-xs"
                  style={{ color: "var(--text-muted)" }}
                >
                  {BRANDING.birthDate && (
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      {t("about.born")} {new Date(BRANDING.birthDate).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </span>
                  )}
                  {BRANDING.agentLocation && (
                    <span className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" />
                      {BRANDING.agentLocation}
                    </span>
                  )}
                  <span className="flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5" style={{ color: "var(--accent)" }} />
                    OpenClaw + {systemData?.system?.model?.split("/")[1]?.split("-")[0] || "AI"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {uptime && (
              <div
                className="rounded-xl p-3 text-center"
                style={{
                  backgroundColor: "var(--card)",
                  border: "1px solid var(--border)",
                }}
              >
                <Clock className="w-5 h-5 mx-auto mb-1" style={{ color: "var(--accent)" }} />
                <div className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
                  {uptime}
                </div>
                <div className="text-xs" style={{ color: "var(--text-muted)" }}>{t("about.uptime")}</div>
              </div>
            )}

            <div
              className="rounded-xl p-3 text-center"
              style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
            >
              <Activity className="w-5 h-5 mx-auto mb-1" style={{ color: "var(--info)" }} />
              <div className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
                {aboutStats?.totalActivities.toLocaleString() || "..."}
              </div>
              <div className="text-xs" style={{ color: "var(--text-muted)" }}>{t("about.activities")}</div>
            </div>

            <div
              className="rounded-xl p-3 text-center"
              style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
            >
              <CheckCircle className="w-5 h-5 mx-auto mb-1" style={{ color: "var(--success)" }} />
              <div className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
                {aboutStats?.successRate || "..."}%
              </div>
              <div className="text-xs" style={{ color: "var(--text-muted)" }}>{t("about.successRate")}</div>
            </div>

            <div
              className="rounded-xl p-3 text-center"
              style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
            >
              <Puzzle className="w-5 h-5 mx-auto mb-1" style={{ color: "#a78bfa" }} />
              <div className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
                {aboutStats?.skillsCount || "..."}
              </div>
              <div className="text-xs" style={{ color: "var(--text-muted)" }}>{t("about.skills")}</div>
            </div>
          </div>

          {/* Quick Info Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {/* Model */}
            <div
              className="rounded-xl p-3"
              style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
            >
              <Cpu className="w-5 h-5 mx-auto mb-1" style={{ color: "#8b5cf6" }} />
              <div className="text-xs font-bold truncate px-1" style={{ color: "var(--text-primary)" }}>
                {systemData?.system?.model?.split("/").pop() || "..."}
              </div>
              <div className="text-xs" style={{ color: "var(--text-muted)" }}>{t("about.model")}</div>
            </div>

            {/* Workspace */}
            <div
              className="rounded-xl p-3"
              style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
            >
              <Folder className="w-5 h-5 mx-auto mb-1" style={{ color: "#f97316" }} />
              <div className="text-xs font-bold truncate px-1" style={{ color: "var(--text-primary)" }}>
                {(systemData?.system?.workspacePath || "").split("/").pop() || "..."}
              </div>
              <div className="text-xs" style={{ color: "var(--text-muted)" }}>{t("about.workspace")}</div>
            </div>

            {/* Platform */}
            <div
              className="rounded-xl p-3"
              style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
            >
              <HardDrive className="w-5 h-5 mx-auto mb-1" style={{ color: "#34d399" }} />
              <div className="text-xs font-bold truncate px-1" style={{ color: "var(--text-primary)" }}>
                {systemData?.system?.platform || "..."}
              </div>
              <div className="text-xs" style={{ color: "var(--text-muted)" }}>{t("about.platform")}</div>
            </div>

            {/* Node */}
            <div
              className="rounded-xl p-3"
              style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
            >
              <Terminal className="w-5 h-5 mx-auto mb-1" style={{ color: "#1DA1F2" }} />
              <div className="text-xs font-bold truncate px-1" style={{ color: "var(--text-primary)" }}>
                v{systemData?.system?.nodeVersion || "..."}
              </div>
              <div className="text-xs" style={{ color: "var(--text-muted)" }}>{t("about.nodeVersion")}</div>
            </div>
          </div>

          {/* About & Personality */}
          <div className="grid md:grid-cols-2 gap-4 mb-6">
            {/* About */}
            <div
              className="rounded-xl p-4"
              style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
            >
              <div className="flex items-center gap-2 mb-3">
                <Heart className="w-4 h-4" style={{ color: "var(--accent)" }} />
                <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  {t("about.aboutSection")}
                </h3>
              </div>
              <div className="space-y-2 text-xs" style={{ color: "var(--text-secondary)", lineHeight: 1.7 }}>
                <p>
                  {t("about.aboutText1", { 
                    name: `${agentName}`,
                    openclaw: "OpenClaw",
                    model: systemData?.system?.model?.split("/")[1]?.split("-")[0] || "Claude"
                  })}
                </p>
                <p>
                  {t("about.aboutText2", { owner: ownerUsername })}
                </p>
              </div>
            </div>

            {/* Personality */}
            <div
              className="rounded-xl p-4"
              style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
            >
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4" style={{ color: "#facc15" }} />
                <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  {t("about.personality")}
                </h3>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {getPersonalityTraits(t).map((p) => (
                  <div key={p.trait} className="rounded-lg p-2 flex items-start gap-2" style={{ backgroundColor: "var(--background)" }}>
                    <span className="text-lg">{p.emoji}</span>
                    <div>
                      <div className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>{p.trait}</div>
                      <div className="text-xs" style={{ color: "var(--text-muted)" }}>{p.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Philosophy */}
          <div
            className="rounded-xl p-4 mb-6"
            style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Brain className="w-4 h-4" style={{ color: "var(--info)" }} />
              <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                {t("about.philosophy")}
              </h3>
            </div>
            <div className="grid md:grid-cols-2 gap-2">
              {getPhilosophies(t).map((p, i) => (
                <div key={i} className="flex gap-2 p-2 rounded-lg" style={{ backgroundColor: "var(--background)" }}>
                  <span className="flex-shrink-0 text-sm" style={{ color: "var(--accent)" }}>▸</span>
                  <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{p}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Capabilities */}
          <div
            className="rounded-xl p-4 mb-6"
            style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-4 h-4" style={{ color: "var(--warning)" }} />
              <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                {t("about.capabilities", { count: realSkills.length })}
              </h3>
            </div>
            {realSkills.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {realSkills.map((skill, index) => {
                  const color = SKILL_DISPLAY_COLORS[index % SKILL_DISPLAY_COLORS.length];
                  return (
                    <div
                      key={skill.id}
                      className="flex items-center gap-2 p-2 rounded-lg"
                      style={{ backgroundColor: "var(--background)" }}
                      title={skill.description}
                    >
                      <span 
                        className="w-4 h-4 flex-shrink-0 flex items-center justify-center text-sm"
                        style={{ color }}
                      >
                        {skill.emoji || "⚡"}
                      </span>
                      <span className="text-xs truncate" style={{ color: "var(--text-primary)" }}>
                        {skill.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-sm" style={{ color: "var(--text-muted)" }}>
                {t("about.noSkills")}
              </div>
            )}
          </div>

          {/* Footer */}
          <div
            className="text-center py-4 rounded-xl"
            style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
          >
            <div className="flex items-center justify-center gap-2 mb-1">
              <Coffee className="w-4 h-4" style={{ color: "var(--accent)" }} />
              <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                {t("about.builtWithSimple")}{" "}
                <a
                  href="https://github.com/openclaw/openclaw"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "var(--accent)", textDecoration: "underline" }}
                >
                  OpenClaw
                </a>
              </span>
            </div>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {agentName} — {t("about.coPilot")}
            </p>
          </div>
        </div>
      )}

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

import "server-only";

import fs from "fs";
import path from "path";
import os from "os";

import { OPENCLAW_WORKSPACE, WORKSPACE_IDENTITY } from "@/lib/paths";

const WORKSPACE_PATH = OPENCLAW_WORKSPACE;
const IDENTITY_PATH = WORKSPACE_IDENTITY;

const OPENCLAW_CONFIG_PATH = path.join(os.homedir(), ".openclaw", "openclaw.json");

export interface Integration {
  id: string;
  name: string;
  status: "connected" | "disconnected" | "configured" | "not_configured";
  icon: string;
  lastActivity: string | null;
  detail?: string | null;
  type?: "channel" | "plugin" | "api_key";
}

export interface SystemData {
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
  integrations: Integration[];
  timestamp: string;
}

interface OpenClawConfig {
  agents?: {
    defaults?: {
      model?: {
        primary?: string;
      };
    };
    list?: Array<{
      model?: {
        primary?: string;
      };
    }>;
  };
  channels?: Record<string, { enabled?: boolean; name?: string }>;
  plugins?: {
    entries?: Record<string, { enabled?: boolean; name?: string; hasEnvVar?: boolean }>;
  };
}

function parseIdentityMd(): { name: string; creature: string; emoji: string } {
  try {
    const content = fs.readFileSync(IDENTITY_PATH, "utf-8");
    const nameMatch = content.match(/\*\*Name:\*\*\s*(.+)/);
    const creatureMatch = content.match(/\*\*Creature:\*\*\s*(.+)/);
    const emojiMatch = content.match(/\*\*Emoji:\*\*\s*(.+)/);

    return {
      name: nameMatch?.[1]?.trim() || "Unknown",
      creature: creatureMatch?.[1]?.trim() || "AI Agent",
      emoji: emojiMatch?.[1]?.match(/./u)?.[0] || "🤖",
    };
  } catch {
    return { name: "OpenClaw Agent", creature: "AI Agent", emoji: "🤖" };
  }
}

function getIntegrationStatus(): Integration[] {
  const integrations: Integration[] = [];

  const openclawConfigPath = path.join(os.homedir(), ".openclaw", "openclaw.json");
  const workspacePath = WORKSPACE_PATH;

  try {
    let openclawConfig: OpenClawConfig = {};
    if (fs.existsSync(openclawConfigPath)) {
      const configContent = fs.readFileSync(openclawConfigPath, "utf-8");
      openclawConfig = JSON.parse(configContent);
    }

    const channels = openclawConfig.channels || {};
    const addedChannelIds = new Set<string>();

    for (const [channelId, channelConfig] of Object.entries(channels)) {
      if (channelConfig?.enabled) {
        addedChannelIds.add(channelId);
        integrations.push({
          id: channelId,
          name: channelConfig.name || channelId,
          status: "connected",
          icon: channelId,
          lastActivity: null,
          detail: null,
          type: "channel",
        });
      }
    }

    const toolsPath = path.join(workspacePath, "TOOLS.md");
    if (fs.existsSync(toolsPath)) {
      const toolsContent = fs.readFileSync(toolsPath, "utf-8");
      if (toolsContent.includes("bird") && toolsContent.includes("auth_token")) {
        if (!integrations.find((i) => i.id === "twitter")) {
          integrations.push({
            id: "twitter",
            name: "Twitter (bird CLI)",
            status: "configured",
            icon: "twitter",
            lastActivity: null,
            detail: null,
            type: "plugin",
          });
        }
      }
    }

    const envIntegrations = [
      { id: "openai", name: "OpenAI", envKey: "OPENAI_API_KEY" },
      { id: "anthropic", name: "Anthropic", envKey: "ANTHROPIC_API_KEY" },
      { id: "google", name: "Google AI", envKey: "GOOGLE_API_KEY" },
      { id: "tavily", name: "Tavily Search", envKey: "TAVILY_API_KEY" },
      { id: "brave", name: "Brave Search", envKey: "BRAVE_API_KEY" },
      { id: "gemini", name: "Gemini", envKey: "GEMINI_API_KEY" },
    ];
    for (const envIntegration of envIntegrations) {
      if (process.env[envIntegration.envKey]) {
        if (!integrations.find((i) => i.id === envIntegration.id)) {
          integrations.push({
            id: envIntegration.id,
            name: envIntegration.name,
            status: "configured",
            icon: "key",
            lastActivity: null,
            detail: "API key configured",
            type: "api_key",
          });
        }
      }
    }

    return integrations;
  } catch (error) {
    console.error("Failed to get integration status:", error);
    return [];
  }
}

function getModelFromOpenClawConfig(): string | null {
  try {
    const configContent = fs.readFileSync(OPENCLAW_CONFIG_PATH, "utf-8");
    const config: OpenClawConfig = JSON.parse(configContent);

    const agentList = config.agents?.list;
    if (agentList && agentList.length > 0 && agentList[0].model?.primary) {
      return agentList[0].model.primary;
    }

    const defaultModel = config.agents?.defaults?.model?.primary;
    if (defaultModel) {
      return defaultModel;
    }

    return null;
  } catch {
    return null;
  }
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (parts.length === 0) parts.push(`${Math.floor(seconds)}s`);

  return parts.join(" ");
}

export async function getSystemData(): Promise<SystemData> {
  const identity = parseIdentityMd();
  const uptime = process.uptime();
  const nodeVersion = process.version;

  const configModel = getModelFromOpenClawConfig();
  const model =
    configModel ||
    process.env.OPENCLAW_MODEL ||
    process.env.DEFAULT_MODEL ||
    "anthropic/claude-sonnet-4";

  return {
    agent: {
      name: identity.name,
      creature: identity.creature,
      emoji: identity.emoji,
    },
    system: {
      uptime: Math.floor(uptime),
      uptimeFormatted: formatUptime(uptime),
      nodeVersion,
      model,
      workspacePath: WORKSPACE_PATH,
      platform: os.platform(),
      hostname: os.hostname(),
      memory: {
        total: os.totalmem(),
        free: os.freemem(),
        used: os.totalmem() - os.freemem(),
      },
    },
    integrations: getIntegrationStatus(),
    timestamp: new Date().toISOString(),
  };
}

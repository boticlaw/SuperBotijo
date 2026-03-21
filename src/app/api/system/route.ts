import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';

import { OPENCLAW_WORKSPACE, WORKSPACE_IDENTITY } from '@/lib/paths';

const WORKSPACE_PATH = OPENCLAW_WORKSPACE;
const IDENTITY_PATH = WORKSPACE_IDENTITY;
const ENV_LOCAL_PATH = path.join(process.cwd(), '.env.local');

const OPENCLAW_CONFIG_PATH = path.join(os.homedir(), '.openclaw', 'openclaw.json');

interface Integration {
  id: string;
  name: string;
  status: "connected" | "disconnected" | "configured" | "not_configured";
  icon: string;
  lastActivity: string | null;
  detail?: string | null;
  type?: "channel" | "plugin" | "api_key";
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
    const content = fs.readFileSync(IDENTITY_PATH, 'utf-8');
    const nameMatch = content.match(/\*\*Name:\*\*\s*(.+)/);
    const creatureMatch = content.match(/\*\*Creature:\*\*\s*(.+)/);
    const emojiMatch = content.match(/\*\*Emoji:\*\*\s*(.+)/);
    
    return {
      name: nameMatch?.[1]?.trim() || 'Unknown',
      creature: creatureMatch?.[1]?.trim() || 'AI Agent',
      emoji: emojiMatch?.[1]?.match(/./u)?.[0] || '🤖',
    };
  } catch {
    return { name: 'OpenClaw Agent', creature: 'AI Agent', emoji: '🤖' };
  }
}

function getIntegrationStatus(): Integration[] {
  const integrations: Integration[] = [];
  
  const openclawConfigPath = path.join(os.homedir(), '.openclaw', 'openclaw.json');
  const workspacePath = WORKSPACE_PATH;

  try {
    // Read openclaw.json if it exists
    let openclawConfig: OpenClawConfig = {};
    if (fs.existsSync(openclawConfigPath)) {
      const configContent = fs.readFileSync(openclawConfigPath, 'utf-8');
      openclawConfig = JSON.parse(configContent);
    }

    // 1. Channels from openclaw.json (telegram, discord, etc.)
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

    // NOTE: Plugins are NOT included here - they have their own dedicated page at /skills
    // Only showing channels (communication platforms) in the integrations list

    // NOTE: Skills are NOT included here - they have their own dedicated page at /skills
    // Including them here would be redundant and confusing for users.

    // 3. Tools from TOOLS.md
    const toolsPath = path.join(workspacePath, 'TOOLS.md');
    if (fs.existsSync(toolsPath)) {
      const toolsContent = fs.readFileSync(toolsPath, 'utf-8');
      // Check for specific tool configurations
      if (toolsContent.includes('bird') && toolsContent.includes('auth_token')) {
        // Avoid duplicate
        if (!integrations.find(i => i.id === 'twitter')) {
          integrations.push({
            id: 'twitter',
            name: 'Twitter (bird CLI)',
            status: 'configured',
            icon: 'twitter',
            lastActivity: null,
            detail: null,
            type: 'plugin',
          });
        }
      }
    }

    // 5. Environment variables (API keys) - check if they exist
    const envIntegrations = [
      { id: 'openai', name: 'OpenAI', envKey: 'OPENAI_API_KEY' },
      { id: 'anthropic', name: 'Anthropic', envKey: 'ANTHROPIC_API_KEY' },
      { id: 'google', name: 'Google AI', envKey: 'GOOGLE_API_KEY' },
      { id: 'tavily', name: 'Tavily Search', envKey: 'TAVILY_API_KEY' },
      { id: 'brave', name: 'Brave Search', envKey: 'BRAVE_API_KEY' },
      { id: 'gemini', name: 'Gemini', envKey: 'GEMINI_API_KEY' },
    ];
    for (const envIntegration of envIntegrations) {
      // Check if the env key exists and has a value
      if (process.env[envIntegration.envKey]) {
        // Avoid duplicates
        if (!integrations.find(i => i.id === envIntegration.id)) {
          integrations.push({
            id: envIntegration.id,
            name: envIntegration.name,
            status: 'configured',
            icon: 'key',
            lastActivity: null,
            detail: 'API key configured',
            type: 'api_key',
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

/**
 * Get the configured model from openclaw.json
 */
function getModelFromOpenClawConfig(): string | null {
  try {
    const configContent = fs.readFileSync(OPENCLAW_CONFIG_PATH, 'utf-8');
    const config: OpenClawConfig = JSON.parse(configContent);
    
    // Priority: agent-specific model > defaults.model > null
    const agentList = config.agents?.list;
    if (agentList && agentList.length > 0 && agentList[0].model?.primary) {
      return agentList[0].model.primary;
    }
    
    // Fallback to defaults
    const defaultModel = config.agents?.defaults?.model?.primary;
    if (defaultModel) {
      return defaultModel;
    }
    
    return null;
  } catch {
    return null;
  }
}

export const dynamic = "force-dynamic";

export async function GET() {
  const identity = parseIdentityMd();
  const uptime = process.uptime();
  const nodeVersion = process.version;
  
  // Get model from openclaw.json first, then fallback to env vars
  const configModel = getModelFromOpenClawConfig();
  const model = configModel 
    || process.env.OPENCLAW_MODEL 
    || process.env.DEFAULT_MODEL 
    || 'anthropic/claude-sonnet-4';
  
  const systemInfo = {
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
  
  return NextResponse.json(systemInfo);
}

export async function POST(request: Request) {
  try {
    const { action, data } = await request.json();
    
    if (action === 'change_password') {
      const { currentPassword, newPassword } = data;
      
      // Read current .env.local
      let envContent = '';
      try {
        envContent = fs.readFileSync(ENV_LOCAL_PATH, 'utf-8');
      } catch {
        return NextResponse.json({ error: 'Could not read configuration' }, { status: 500 });
      }
      
      // Verify current password
      const currentPassMatch = envContent.match(/ADMIN_PASSWORD=(.+)/);
      const storedPassword = currentPassMatch?.[1]?.trim();
      
      if (storedPassword !== currentPassword) {
        return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 });
      }
      
      // Update password
      const newEnvContent = envContent.replace(
        /ADMIN_PASSWORD=.*/,
        `ADMIN_PASSWORD=${newPassword}`
      );
      
      fs.writeFileSync(ENV_LOCAL_PATH, newEnvContent);
      
      return NextResponse.json({ success: true, message: 'Password updated successfully' });
    }
    
    if (action === 'clear_activity_log') {
      const activitiesPath = path.join(process.cwd(), 'data', 'activities.json');
      fs.writeFileSync(activitiesPath, '[]');
      return NextResponse.json({ success: true, message: 'Activity log cleared' });
    }
    
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Action failed' }, { status: 500 });
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
  
  return parts.join(' ');
}

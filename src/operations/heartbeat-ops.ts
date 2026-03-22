/**
 * Heartbeat Operations - Business logic for agent heartbeats
 */
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const OPENCLAW_DIR = process.env.OPENCLAW_DIR || "/home/daniel/.openclaw";

export interface AgentHeartbeat {
  agentId: string;
  agentName: string;
  workspace: string;
  enabled: boolean;
  every: string;
  target: string;
  activeHours: { start: string; end: string } | null;
}

export interface HeartbeatStatus {
  enabled: boolean;
  every: string;
  target: string;
  activeHours: { start: string; end: string } | null;
  heartbeatMd: string;
  heartbeatMdPath: string;
  configured: boolean;
  agentHeartbeats: AgentHeartbeat[];
}

function getAllAgents(): { id: string; name: string; workspace: string; heartbeat?: Record<string, unknown> }[] {
  const configPath = join(OPENCLAW_DIR, "openclaw.json");
  
  if (!existsSync(configPath)) {
    return [];
  }

  try {
    const raw = readFileSync(configPath, "utf-8");
    const json = JSON.parse(raw);
    const agentList = json.agents?.list || [];
    
    return agentList.map((agent: { id: string; name?: string; workspace?: string; heartbeat?: Record<string, unknown> }) => ({
      id: agent.id,
      name: agent.name || agent.id,
      workspace: agent.workspace || join(OPENCLAW_DIR, "workspace"),
      heartbeat: agent.heartbeat,
    }));
  } catch (e) {
    console.error("[heartbeat ops] Error reading agents:", e);
    return [];
  }
}

function getAgentHeartbeats(): AgentHeartbeat[] {
  const agents = getAllAgents();
  
  return agents
    .filter((agent) => agent.heartbeat)
    .map((agent) => ({
      agentId: agent.id,
      agentName: agent.name,
      workspace: agent.workspace,
      enabled: !!(agent.heartbeat as Record<string, unknown>).every,
      every: ((agent.heartbeat as Record<string, unknown>).every as string) || "30m",
      target: ((agent.heartbeat as Record<string, unknown>).target as string) || "none",
      activeHours: (agent.heartbeat as Record<string, unknown>).activeHours as { start: string; end: string } | null || null,
    }));
}

function getDefaultHeartbeatPaths(): string[] {
  return [
    join(OPENCLAW_DIR, "workspace", "HEARTBEAT.md"),
    join(OPENCLAW_DIR, "HEARTBEAT.md"),
  ];
}

export async function getHeartbeatStatus(): Promise<HeartbeatStatus> {
  let config = {
    enabled: false,
    every: "30m",
    target: "last",
    activeHours: null as { start: string; end: string } | null,
  };

  const configPath = join(OPENCLAW_DIR, "openclaw.json");
  if (existsSync(configPath)) {
    try {
      const raw = readFileSync(configPath, "utf-8");
      const json = JSON.parse(raw);
      const hb = json.agents?.defaults?.heartbeat;

      if (hb) {
        config = {
          enabled: !!hb.every,
          every: hb.every || "30m",
          target: hb.target || "last",
          activeHours: hb.activeHours || null,
        };
      }
    } catch (e) {
      console.error("[heartbeat ops] Error reading config:", e);
    }
  }

  const agentHeartbeats = getAgentHeartbeats();

  let heartbeatMd = "";
  let heartbeatMdPath = "";

  const paths = getDefaultHeartbeatPaths();
  for (const p of paths) {
    if (existsSync(p)) {
      heartbeatMd = readFileSync(p, "utf-8");
      heartbeatMdPath = p;
      break;
    }
  }

  return {
    ...config,
    heartbeatMd,
    heartbeatMdPath,
    configured: heartbeatMd.length > 0,
    agentHeartbeats,
  };
}

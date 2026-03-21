/**
 * OpenClaw agents detection - reads from openclaw.json
 */

import fs from "fs";
import path from "path";
import { logActivity } from "@/lib/activity-logger";
import { OPENCLAW_DIR } from "@/lib/paths";
import {
  listProjects,
  createProject,
  createAgentIdentity,
  getAgentIdentity,
  updateAgentIdentity,
} from "@/lib/kanban-db";

export interface OpenClawAgentConfig {
  id: string;
  name?: string;
  workspace?: string;
  heartbeat?: {
    every?: string;
  };
}

export interface OpenClawConfig {
  agents?: {
    list?: OpenClawAgentConfig[];
  };
}

export interface AgentIdentity {
  role: string;
  personality: string | null;
  avatar: string | null;
  mission: string | null;
  domain: string | null;
}

export interface AgentInfo {
  id: string;
  name: string;
  workspace: string;
  role: string;
  personality: string | null;
  avatar: string | null;
  mission: string | null;
  domain: string | null;
  heartbeatInterval: number | null;
  hasIdentity: boolean;
}

/**
 * Get list of agents from openclaw.json
 */
export function getOpenClawAgents(): AgentInfo[] {
  const configPath = path.join(OPENCLAW_DIR, "openclaw.json");

  if (!fs.existsSync(configPath)) {
    console.warn("[openclaw-agents] Config not found:", configPath);
    return [];
  }

  try {
    const configRaw = fs.readFileSync(configPath, "utf-8");
    const config: OpenClawConfig = JSON.parse(configRaw);
    const agents = config.agents?.list ?? [];

    return agents.map((agent) => {
      const workspaceDir = agent.workspace || path.join(OPENCLAW_DIR, "workspace", "agents", agent.id);
      const identityPath = path.join(workspaceDir, "IDENTITY.md");

      let identity: AgentIdentity | null = null;
      let hasIdentity = false;

      if (fs.existsSync(identityPath)) {
        try {
          const identityContent = fs.readFileSync(identityPath, "utf-8");
          identity = parseIdentityMd(identityContent);
          hasIdentity = true;
        } catch (error) {
          console.error("[openclaw-agents] Error reading identity for", agent.id, error);
        }
      }

      const heartbeatInterval = agent.heartbeat?.every
        ? parseHeartbeatInterval(agent.heartbeat.every)
        : null;

      return {
        id: agent.id,
        name: agent.name ?? agent.id,
        workspace: workspaceDir,
        role: identity?.role ?? "general",
        personality: identity?.personality ?? null,
        avatar: identity?.avatar ?? null,
        mission: identity?.mission ?? null,
        domain: identity?.domain ?? null,
        heartbeatInterval,
        hasIdentity,
      };
    });
  } catch (error) {
    console.error("[openclaw-agents] Error loading agents:", error);
    return [];
  }
}

/**
 * Parse IDENTITY.md file for role, personality, mission, domain
 */
function parseIdentityMd(content: string): AgentIdentity {
  let role = "general";
  let personality: string | null = null;
  let avatar: string | null = null;
  let mission: string | null = null;
  let domain: string | null = null;

  const roleMatch = content.match(/(?:^|\n)\*?\*?Role:\*\*?\s*(.+?)(?:\n|$)/i);
  if (roleMatch) {
    role = roleMatch[1].trim();
  }

  const personalityMatch = content.match(/(?:^|\n)\*?\*?Personality:\*\*?\s*(.+?)(?:\n|$)/i);
  if (personalityMatch) {
    personality = personalityMatch[1].trim();
  }

  const avatarMatch = content.match(/(?:^|\n)\*?\*?Avatar:\*\*?\s*(.+?)(?:\n|$)/i);
  if (avatarMatch) {
    avatar = avatarMatch[1].trim();
  }

  const missionMatch = content.match(/(?:^|\n)\*?\*?Mission:\*\*?\s*(.+?)(?:\n|$)/i);
  if (missionMatch) {
    mission = missionMatch[1].trim();
  }

  const domainMatch = content.match(/(?:^|\n)\*?\*?Domain:\*\*?\s*(.+?)(?:\n|$)/i);
  if (domainMatch) {
    domain = domainMatch[1].trim();
  }

  return { role, personality, avatar, mission, domain };
}

/**
 * Parse heartbeat interval string to milliseconds
 */
function parseHeartbeatInterval(every: string): number | null {
  const match = every.match(/^(\d+)\s*(m|min|minute|minutes|h|hour|hours)$/i);
  if (!match) {
    return null;
  }

  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();

  switch (unit) {
    case "m":
    case "min":
    case "minute":
    case "minutes":
      return value * 60 * 1000;
    case "h":
    case "hour":
    case "hours":
      return value * 60 * 60 * 1000;
    default:
      return null;
  }
}

/**
 * Sync OpenClaw agents to Kanban projects
 */
export function syncAgentsToProjects(): { synced: number; created: number; agents: AgentInfo[] } {
  const agents = getOpenClawAgents();
  let synced = 0;
  let created = 0;

  for (const agent of agents) {
    const projects = listProjects();
    const existingProject = projects.find(
      (p) =>
        p.name.toLowerCase() === agent.name.toLowerCase() ||
        p.description?.includes(`agent:${agent.id}`)
    );

    if (!existingProject) {
      const project = createProject({
        name: agent.name,
        description: `Project for ${agent.name} agent (${agent.id})`,
        missionAlignment: agent.mission ?? undefined,
      });

      const existingIdentity = getAgentIdentity(agent.id);
      if (!existingIdentity) {
        createAgentIdentity({
          id: agent.id,
          name: agent.name,
          role: agent.role,
          personality: agent.personality ?? undefined,
          avatar: agent.avatar ?? undefined,
          mission: agent.mission ?? undefined,
        });
      } else {
        updateAgentIdentity(agent.id, {
          name: agent.name,
          role: agent.role,
          personality: agent.personality ?? undefined,
          avatar: agent.avatar ?? undefined,
          mission: agent.mission ?? undefined,
        });
      }

      created++;
      logActivity("task", `Created project for agent ${agent.name}`, "success", {
        metadata: { agentId: agent.id, projectId: project.id },
      });
    } else {
      const existingIdentity = getAgentIdentity(agent.id);
      if (existingIdentity) {
        updateAgentIdentity(agent.id, {
          name: agent.name,
          role: agent.role,
          personality: agent.personality ?? undefined,
          avatar: agent.avatar ?? undefined,
          mission: agent.mission ?? undefined,
        });
      }
      synced++;
    }
  }

  logActivity("task", `Synced ${synced} agents, created ${created} new projects`, "success", {
    metadata: { synced, created },
  });

  return { synced, created, agents };
}

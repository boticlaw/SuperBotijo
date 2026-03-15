/**
 * Agent Operations - Business logic for agent management
 */
import type { OperationResult } from "./index";
import { getActivities } from "@/lib/activities-db"
import { getAgentDefaults } from "@/lib/agent-auto-config"
import { getOpenClawSessionsTelemetry } from "@/lib/telemetry/sources/openclaw-sessions";
import { createCache } from "@/lib/cache";
import { readFileSync, existsSync, readdirSync } from "fs";
import { join } from "path";

const OPENCLAW_DIR = process.env.OPENCLAW_DIR || "/home/daniel/.openclaw";

/**
 * Discover skills by scanning the agent's skills directory
 */
function discoverAgentSkills(workspace: string): string[] {
  const skillsDir = join(workspace, "skills");
  const skills: string[] = [];

  if (!existsSync(skillsDir)) {
    return skills;
  }

  try {
    const entries = readdirSync(skillsDir, { withFileTypes: true });
    for (const entry of entries) {
      // Accept both directories and symlinks (which may point to directories)
      if (entry.isDirectory() || entry.isSymbolicLink()) {
        const skillMdPath = join(skillsDir, entry.name, "SKILL.md");
        if (existsSync(skillMdPath)) {
          skills.push(entry.name);
        }
      }
    }
  } catch (error) {
    console.error("[agent-ops] Error scanning skills directory:", error);
  }

  return skills;
}

export interface AgentInfo {
  id: string;
  name: string;
  emoji: string;
  color: string;
  status: "working" | "idle" | "error" | "paused" | "online" | "offline";
  model: string;
  workspace?: string;
  currentTask?: string;
  lastActivity?: string;
  tokensUsed: number;
  sessionCount: number;
  activeSessions: number;
  botToken?: string;
  allowAgents?: string[];
  allowAgentsDetails?: { id: string; name: string; emoji: string; color: string }[];
  dmPolicy?: string;
  mood?: AgentMood;
  skills?: string[];
}

export interface AgentMood {
  agentId: string;
  mood: "productive" | "busy" | "frustrated" | "content" | "tired";
  emoji: string;
  streak: number;
  energyLevel: number;
  lastCalculated: string;
}

const AGENT_STATUS = {
  working: "working",
  idle: "idle",
  online: "online",
  offline: "offline",
} as const;

export type AgentStatusValue = (typeof AGENT_STATUS)[keyof typeof AGENT_STATUS];

export interface AgentStatusEntry {
  id: string;
  name: string;
  status: AgentStatusValue;
  lastActivity?: string;
  activeSessions: number;
  currentTask?: string;
}

// In-memory agent registry (would be DB in production)
const agentRegistry = new Map<string, AgentInfo>();
const agentMoods = new Map<string, AgentMood>();

// Status classification windows:
// - < 2 min ago → "online" (actively working right now, sitting at desk)
// - 2 min - 30 min → "idle" (available, walking around office)
// - > 30 min → "offline" (not in office)
const ONLINE_WINDOW_MS = 2 * 60 * 1000; // 2 minutes - active right now
const IDLE_WINDOW_MS = 30 * 60 * 1000; // 30 minutes - still available

interface SessionFreshness {
  latestActivity?: string;
  freshSessions: number;
}

function loadSessionFreshnessByAgent(): Map<string, SessionFreshness> {
  const freshnessByAgent = new Map<string, SessionFreshness>();

  try {
    const sessionsSource = getOpenClawSessionsTelemetry();

    if (sessionsSource.degraded.length > 0) {
      console.warn(
        "[agent-ops] Session telemetry degraded while computing freshness:",
        sessionsSource.degraded.map((entry) => entry.message).join(" | "),
      );
    }

    sessionsSource.sessions.forEach((session) => {
      freshnessByAgent.set(session.id, {
        freshSessions: session.freshSessions,
        latestActivity: session.latestActivity,
      });
    });
  } catch (error) {
    console.warn("[agent-ops] Unable to read OpenClaw sessions for status freshness:", error);
  }

  return freshnessByAgent;
}

/**
 * Cached session freshness with 10-second TTL.
 * Avoids spawning the `openclaw sessions` CLI subprocess on every request.
 */
const cachedSessionFreshness = createCache<Map<string, SessionFreshness>>({
  ttlMs: 10_000,
  compute: loadSessionFreshnessByAgent,
});

function classifyAgentStatus(lastActivity: string | undefined, activeSessions: number): AgentStatusValue {
  if (activeSessions > 0) {
    console.log(`[agent-ops] ${lastActivity ? 'agent' : 'unknown'}: working (activeSessions=${activeSessions})`);
    return AGENT_STATUS.working;
  }

  if (lastActivity) {
    const lastActivityTime = new Date(lastActivity).getTime();
    if (!Number.isNaN(lastActivityTime)) {
      const ageMs = Date.now() - lastActivityTime;
      console.log(`[agent-ops] ${lastActivity}: age=${ageMs}ms, onlineWindow=${ONLINE_WINDOW_MS}ms`);
      if (ageMs < ONLINE_WINDOW_MS) {
        return AGENT_STATUS.online;
      }
      if (ageMs < IDLE_WINDOW_MS) {
        return AGENT_STATUS.idle;
      }
    }
  }

  console.log(`[agent-ops] agent: offline (no activity)`);
  return AGENT_STATUS.offline;
}

/**
 * Load agents from openclaw.json configuration
 */
function loadAgentsFromConfig(): AgentInfo[] {
  const configPath = join(OPENCLAW_DIR, "openclaw.json");

  if (!existsSync(configPath)) {
    console.warn("[agent-ops] openclaw.json not found at", configPath);
    return [];
  }

  try {
    const config = JSON.parse(readFileSync(configPath, "utf-8"));
    const agentsList = config.agents?.list || [];

    return agentsList.map((agent: {
      id: string;
      name?: string
      model?: string
      skills?: string[]
      workspace?: string
      subagents?: { allowAgents?: string[] };
    }) => {
      const defaults = getAgentDefaults(agent.id, agent.name);
      const allowAgents = agent.subagents?.allowAgents || [];
      const workspace = agent.workspace || join(OPENCLAW_DIR, "workspace", agent.id);

      // Build allowAgentsDetails using auto-config
      const allowAgentsDetails = allowAgents.map((subId: string) => {
        const subDefaults = getAgentDefaults(subId, subId);
        return {
          id: subId,
          name: subId,
          emoji: subDefaults.emoji,
          color: subDefaults.color,
        };
      });

      // Discover skills from workspace directory + config skills
      const discoveredSkills = discoverAgentSkills(workspace);
      const configSkills = agent.skills || [];
      const allSkills = [...new Set([...discoveredSkills, ...configSkills])];

      return {
        id: agent.id,
        name: agent.name || agent.id,
        emoji: defaults.emoji,
        color: defaults.color,
        status: "offline" as const,
        model: agent.model || "unknown",
        tokensUsed: 0,
        sessionCount: 0,
        activeSessions: 0,
        workspace,
        allowAgents,
        allowAgentsDetails,
        skills: allSkills,
      };
    });
  } catch (error) {
    console.error("[agent-ops] Error loading agents from config:", error);
    return [];
  }
}

/**
 * Calculate mood for an agent from a pre-fetched list of activities.
 *
 * This avoids the N+1 problem — instead of querying the DB per-agent,
 * we filter from the already-loaded activities dataset.
 */
function calculateMoodFromActivities(
  id: string,
  agentActivities: Array<{ status: string }>
): AgentMood {
  const activityCount = agentActivities.length;
  const errorCount = agentActivities.filter((a) => a.status === "error").length;
  const successCount = agentActivities.filter((a) => a.status === "success").length;

  let mood: AgentMood["mood"];
  let emoji: string;
  let streak: number;
  let energyLevel: number;

  if (errorCount > successCount) {
    mood = "frustrated";
    emoji = "😤";
    streak = 0;
    energyLevel = 30;
  } else if (activityCount > 5) {
    mood = "busy";
    emoji = "🏃";
    streak = successCount;
    energyLevel = 70;
  } else if (activityCount >= 3) {
    mood = "productive";
    emoji = "💪";
    streak = activityCount;
    energyLevel = 90;
  } else {
    mood = "content";
    emoji = "😊";
    streak = 1;
    energyLevel = 60;
  }

  return {
    agentId: id,
    mood,
    emoji,
    streak,
    energyLevel,
    lastCalculated: new Date().toISOString(),
  };
}

/**
 * Get all registered agents
 */
export async function getAgents(): Promise<OperationResult<AgentInfo[]>> {
  try {
    // Load agents from openclaw.json
    const configAgents = loadAgentsFromConfig();

    // Update registry with config agents
    for (const agent of configAgents) {
      if (!agentRegistry.has(agent.id)) {
        agentRegistry.set(agent.id, agent);
      }
    }

    // Get activities ONCE for all agents — avoids N+1
    const activitiesResult = getActivities({ limit: 1000, sort: "newest" });
    const recentActivities = activitiesResult.activities;

    // Calculate stats for each agent using the shared dataset
    for (const agent of configAgents) {
      const agentActivities = recentActivities.filter(
        (a) => a.agent === agent.id || (a.agent?.toLowerCase().includes(agent.id.toLowerCase()))
      );

      // Session count = total activities
      agent.sessionCount = agentActivities.length;

      // Active sessions = running status
      agent.activeSessions = agentActivities.filter(
        (a) => a.status === "running"
      ).length;

      // Tokens used = sum of tokens_used
      agent.tokensUsed = agentActivities.reduce(
        (sum, a) => sum + (a.tokens_used || 0),
        0
      );

      // Last activity
      agent.lastActivity =
        agentActivities.length > 0
          ? agentActivities[0].timestamp
          : undefined;

      // Determine status based on activities
      if (agent.activeSessions > 0) {
        agent.status = "working";
      } else if (agentActivities.length > 0) {
        const lastActivityTime = new Date(agentActivities[0].timestamp).getTime();
        const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
        agent.status = lastActivityTime > fiveMinutesAgo ? "online" : "idle";
      }

      // Calculate mood from already-fetched activities (no extra DB query)
      const mood = calculateMoodFromActivities(agent.id, agentActivities);
      agentMoods.set(agent.id, mood);
      agent.mood = mood;

      // Update registry
      agentRegistry.set(agent.id, agent);
    }

    return { success: true, data: [...agentRegistry.values()] };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get agents",
    };
  }
}

/**
 * Get normalized agent status list for UI polling
 */
export async function getAgentStatusList(): Promise<OperationResult<AgentStatusEntry[]>> {
  try {
    const configAgents = loadAgentsFromConfig();
    const activitiesResult = getActivities({ limit: 1000, sort: "newest" });
    const recentActivities = activitiesResult.activities;
    const sessionFreshnessByAgent = cachedSessionFreshness.get();

    console.log(`[agent-ops] getAgentStatusList: ${configAgents.length} agents loaded, ${recentActivities.length} activities found`);
    console.log(`[agent-ops] Agent IDs from config:`, configAgents.map(a => a.id));
    if (recentActivities.length > 0) {
      console.log(`[agent-ops] Recent activity agents:`, [...new Set(recentActivities.map(a => a.agent))].filter(Boolean));
    }

    const statuses = configAgents.map((agent) => {
      const agentActivities = recentActivities.filter(
        (activity) => activity.agent === agent.id || activity.agent?.toLowerCase().includes(agent.id.toLowerCase())
      );
      const runningActivities = agentActivities.filter((activity) => activity.status === "running").length;
      const sessionFreshness = sessionFreshnessByAgent.get(agent.id);
      const activeSessions = Math.max(runningActivities, sessionFreshness?.freshSessions || 0);

      const activityTimestamp = agentActivities.length > 0 ? agentActivities[0].timestamp : undefined;
      const sessionTimestamp = sessionFreshness?.latestActivity;
      const lastActivity = activityTimestamp && sessionTimestamp
        ? (new Date(activityTimestamp).getTime() > new Date(sessionTimestamp).getTime() ? activityTimestamp : sessionTimestamp)
        : activityTimestamp || sessionTimestamp;

      console.log(`[agent-ops] ${agent.id}: ${agentActivities.length} activities, lastActivity=${lastActivity}, activeSessions=${activeSessions}`);

      const status = classifyAgentStatus(lastActivity, activeSessions);

      return {
        id: agent.id,
        name: agent.name,
        status,
        lastActivity,
        activeSessions,
      };
    });

    console.log(`[agent-ops] Final statuses:`, statuses.map(s => `${s.id}:${s.status}`).join(', '));

    return { success: true, data: statuses };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get agent statuses",
    };
  }
}

/**
 * Get a single agent by ID
 */
export async function getAgentById(
  id: string
): Promise<OperationResult<AgentInfo>> {
  try {
    const agents = await getAgents();
    if (!agents.success) {
      return { success: false, error: "No agents found" };
    }

    const agent = agents.data?.find((a) => a.id === id);
    if (!agent) {
      return { success: false, error: "Agent not found" };
    }

    return { success: true, data: agent };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get agent",
    };
  }
}

/**
 * Update agent status
 */
export async function updateAgentStatus(
  id: string,
  status: AgentInfo["status"],
  currentTask?: string
): Promise<OperationResult<AgentInfo>> {
  try {
    const agent = agentRegistry.get(id);

    if (!agent) {
      return { success: false, error: "Agent not found" };
    }

    agent.status = status;
    if (currentTask !== undefined) {
      agent.currentTask = currentTask;
    }
    agent.lastActivity = new Date().toISOString();

    return { success: true, data: { ...agent } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update status",
    };
  }
}

/**
 * Pause an agent
 */
export async function pauseAgent(id: string): Promise<OperationResult> {
  try {
    const result = await updateAgentStatus(id, "paused");

    if (!result.success) {
      return { success: false, error: result.error };
    }

    // Log the pause
    console.log(`[agent-ops] Agent ${id} paused at ${new Date().toISOString()}`);

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to pause agent",
    };
  }
}

/**
 * Resume a paused agent
 */
export async function resumeAgent(id: string): Promise<OperationResult> {
  try {
    const agent = agentRegistry.get(id);

    if (!agent) {
      return { success: false, error: "Agent not found" };
    }

    if (agent.status !== "paused") {
      return { success: false, error: "Agent is not paused" };
    }

    const result = await updateAgentStatus(id, "idle");
    return { success: result.success };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to resume agent",
    };
  }
}

/**
 * Calculate agent mood based on recent activity
 */
export async function calculateAgentMood(
  id: string
): Promise<OperationResult<AgentMood>> {
  try {
    const agent = agentRegistry.get(id);

    if (!agent) {
      return { success: false, error: "Agent not found" };
    }

    // Get recent activities for this agent
    const result = getActivities({ limit: 100, sort: "newest" });
    const recentActivities = result.activities.filter(
      (a) => a.agent === id || a.agent?.toLowerCase().includes(id)
    );

    // Calculate mood based on activity patterns
    const activityCount = recentActivities.length;
    const errorCount = recentActivities.filter((a) => a.status === "error").length;
    const successCount = recentActivities.filter((a) => a.status === "success").length;

    // Determine mood
    let mood: AgentMood["mood"];
    let emoji: string;
    let streak: number;
    let energyLevel: number;

    if (errorCount > successCount) {
      mood = "frustrated";
      emoji = "😤";
      streak = 0;
      energyLevel = 30;
    } else if (activityCount > 5) {
      mood = "busy";
      emoji = "🏃";
      streak = successCount;
      energyLevel = 70;
    } else if (activityCount >= 3) {
      mood = "productive";
      emoji = "💪";
      streak = activityCount;
      energyLevel = 90;
    } else {
      mood = "content";
      emoji = "😊";
      streak = 1;
      energyLevel = 60;
    }

    const agentMood: AgentMood = {
      agentId: id,
      mood,
      emoji,
      streak,
      energyLevel,
      lastCalculated: new Date().toISOString(),
    };

    agentMoods.set(id, agentMood);

    return { success: true, data: agentMood };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to calculate mood",
    };
  }
}

/**
 * Get agent mood (cached or recalculate)
 */
export async function getAgentMood(
  id: string,
  forceRefresh: boolean = false
): Promise<OperationResult<AgentMood>> {
  try {
    const cached = agentMoods.get(id);

    // Return cached if fresh (< 5 minutes old)
    if (!forceRefresh && cached) {
      const cacheAge = Date.now() - new Date(cached.lastCalculated).getTime();
      if (cacheAge < 5 * 60 * 1000) {
        return { success: true, data: cached };
      }
    }

    return calculateAgentMood(id);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get mood",
    };
  }
}

/**
 * Register a new agent
 */
export async function registerAgent(
  id: string,
  name: string,
  model: string
): Promise<OperationResult<AgentInfo>> {
  try {
    if (agentRegistry.has(id)) {
      return { success: false, error: "Agent already exists" };
    }

    const defaults = getAgentDefaults(id, name);
    const agent: AgentInfo = {
      id,
      name,
      model,
      emoji: defaults.emoji,
      color: defaults.color,
      status: "idle",
      tokensUsed: 0,
      sessionCount: 0,
      activeSessions: 0,
      workspace: join(OPENCLAW_DIR, "workspace", id),
    };

    agentRegistry.set(id, agent);

    return { success: true, data: agent };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to register agent",
    };
  }
}

/**
 * unregister an agent
 */
export async function unregisterAgent(id: string): Promise<OperationResult> {
  try {
    if (!agentRegistry.has(id)) {
      return { success: false, error: "Agent not found" };
    }

    // Don't allow unregistering the main agent
    if (id === "superbotijo") {
      return { success: false, error: "Cannot unregister main agent" };
    }

    agentRegistry.delete(id);
    agentMoods.delete(id);

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to unregister agent",
    };
  }
}

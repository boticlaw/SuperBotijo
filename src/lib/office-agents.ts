/**
 * Office Agents — Agent Data Utilities
 *
 * Utility functions for fetching and transforming agent data
 * for the 3D office visualization.
 */

import type { AgentWithDesk, AvatarState, AgentStatus, AgentConfig, AvatarAccessories } from "@/components/Office3D/agentsConfig";
import { calculateDeskPosition, getGridDimensions } from "@/components/Office3D/desk-positions";

/**
 * Raw API response types
 */
interface ApiAgent {
  id: string;
  name: string;
  emoji?: string;
  color?: string;
  model?: string;
  workspace?: string;
  dmPolicy?: string;
  allowAgents?: string[];
  botToken?: string;
  status?: string;
  lastActivity?: string;
  activeSessions?: number;
  tokensUsed?: number;
  sessionCount?: number;
  currentTask?: string;
  mood?: {
    mood: string;
    emoji: string;
    streak: number;
    energyLevel: number;
  };
}

interface ApiAgentStatus {
  id: string;
  status: string;
  currentTask?: string;
  activeSessions?: number;
  lastActivity?: string;
}

interface AgentsApiResponse {
  agents: ApiAgent[];
}

interface AgentStatusApiResponse {
  agents: ApiAgentStatus[];
}

const VALID_STATUSES: AgentStatus[] = ["idle", "working", "thinking", "error", "online", "offline"];

/**
 * Fetch all agents from the API and transform to AgentWithDesk format
 * Falls back to /api/agents/config if main API fails
 * @returns Array of agents with desk positions
 */
export async function fetchOfficeAgents(): Promise<AgentWithDesk[]> {
  try {
    // Fetch full agent data from /api/agents
    const agentsRes = await fetch("/api/agents");
    if (!agentsRes.ok) {
      throw new Error(`Failed to fetch agents: ${agentsRes.status}`);
    }
    const agentsData: AgentsApiResponse = await agentsRes.json();

    // Fetch dynamic statuses from /api/agents/status
    const statusRes = await fetch("/api/agents/status");
    if (!statusRes.ok) {
      throw new Error(`Failed to fetch agent statuses: ${statusRes.status}`);
    }
    const statusData: AgentStatusApiResponse = await statusRes.json();

    // Build status map for quick lookup
    const statusMap = new Map<string, ApiAgentStatus>();
    for (const s of statusData.agents || []) {
      statusMap.set(s.id, s);
    }

    // Calculate grid dimensions
    const { cols } = getGridDimensions(agentsData.agents.length);

    // Transform to AgentWithDesk format
    return agentsData.agents.map((agent, index) => {
      const statusInfo = statusMap.get(agent.id);
      const agentStatus: AgentStatus = VALID_STATUSES.includes(statusInfo?.status as AgentStatus)
        ? (statusInfo?.status as AgentStatus)
        : VALID_STATUSES.includes(agent.status as AgentStatus)
        ? (agent.status as AgentStatus)
        : "offline";

      const deskPosition = calculateDeskPosition(index, cols);

      return {
        id: agent.id,
        name: agent.name || agent.id,
        emoji: agent.emoji || "🤖",
        color: agent.color || "#666666",
        role: agent.id === "main" ? "Main Agent" : "Agent",
        deskPosition: {
          x: deskPosition.x,
          y: deskPosition.y,
          z: deskPosition.z,
          rotation: deskPosition.rotation,
        },
        currentAvatarState: calculateAvatarState(agentStatus),
        accessories: getDefaultAccessories(agent.id),
      };
    });
  } catch (error) {
    console.warn("[office-agents] Main API failed, trying config fallback:", error);
    // Fallback: try /api/agents/config which reads directly from openclaw.json
    try {
      const configRes = await fetch("/api/agents/config");
      if (configRes.ok) {
        const configData = await configRes.json();
        const agentsList = configData.agents || [];
        const { cols } = getGridDimensions(agentsList.length);
        
        return agentsList.map((agent: { id: string; name?: string; emoji?: string; color?: string }, index: number) => {
          const deskPosition = calculateDeskPosition(index, cols);
          return {
            id: agent.id,
            name: agent.name || agent.id,
            emoji: agent.emoji || "🤖",
            color: agent.color || "#666666",
            role: agent.id === "main" ? "Main Agent" : "Agent",
            deskPosition: {
              x: deskPosition.x,
              y: deskPosition.y,
              z: deskPosition.z,
              rotation: deskPosition.rotation,
            },
            currentAvatarState: "offline" as AvatarState,
            accessories: getDefaultAccessories(agent.id),
          };
        });
      }
    } catch (configError) {
      console.error("[office-agents] Config fallback also failed:", configError);
    }
    
    // Last resort fallback: empty array (Office3D will use its internal fallback)
    return [];
  }
}

/**
 * Fetch agent statuses from the API
 * @returns Map of agent ID to status information
 */
export async function fetchAgentStatuses(): Promise<Map<string, ApiAgentStatus>> {
  try {
    const statusRes = await fetch("/api/agents/status");
    if (!statusRes.ok) {
      throw new Error(`Failed to fetch agent statuses: ${statusRes.status}`);
    }
    const statusData: AgentStatusApiResponse = await statusRes.json();

    const statusMap = new Map<string, ApiAgentStatus>();
    for (const s of statusData.agents || []) {
      statusMap.set(s.id, s);
    }
    return statusMap;
  } catch (error) {
    console.warn("[office-agents] fetchAgentStatuses API failed:", error);
    return new Map();
  }
}

/**
 * Map agent status string to AvatarState
 * @param agentStatus - The agent status from API
 * @returns The corresponding AvatarState
 */
export function calculateAvatarState(agentStatus: AgentStatus | string): AvatarState {
  // Ensure valid status
  const status = VALID_STATUSES.includes(agentStatus as AgentStatus)
    ? (agentStatus as AgentStatus)
    : "offline";

  return status;
}

/**
 * Default accessory presets for known agents
 */
const DEFAULT_AGENT_ACCESSORIES: Record<string, AvatarAccessories> = {
  main: { glasses: true, hair: "short" },
  infra: { hat: "cap", hair: "spiky" },
  developer: { beard: true, hair: "long" },
  studio: { earrings: true, hair: "long" },
};

const ACCESSORY_PRESETS: AvatarAccessories[] = [
  { glasses: true, hair: "short" },
  { hat: "beanie", hair: "short" },
  { beard: true, hair: "long" },
  { hat: "cap", glasses: true, hair: "none" },
  { earrings: true, hair: "spiky" },
];

/**
 * Get a deterministic hash of a string
 */
function getStringHash(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/**
 * Get default accessories for an agent
 * Uses deterministic presets based on agent ID
 * @param agentId - The agent identifier
 * @returns AvatarAccessories configuration
 */
export function getDefaultAccessories(agentId: string): AvatarAccessories {
  if (DEFAULT_AGENT_ACCESSORIES[agentId]) {
    return DEFAULT_AGENT_ACCESSORIES[agentId];
  }

  const presetIndex = getStringHash(agentId) % ACCESSORY_PRESETS.length;
  return ACCESSORY_PRESETS[presetIndex];
}

/**
 * Convert AgentWithDesk to AgentConfig for backward compatibility
 * @param agentWithDesk - Agent with desk configuration
 * @returns AgentConfig object
 */
export function toAgentConfig(agentWithDesk: AgentWithDesk): AgentConfig {
  return {
    id: agentWithDesk.id,
    name: agentWithDesk.name,
    emoji: agentWithDesk.emoji,
    color: agentWithDesk.color,
    role: agentWithDesk.role,
    position: [agentWithDesk.deskPosition.x, agentWithDesk.deskPosition.y, agentWithDesk.deskPosition.z],
    accessories: agentWithDesk.accessories,
  };
}

/**
 * Convert desk position to 3D position array
 * @param deskPosition - Desk position from AgentWithDesk
 * @returns Position array [x, y, z]
 */
export function toDeskPosition3D(deskPosition: { x: number; y: number; z: number; rotation: number }): [number, number, number] {
  return [deskPosition.x, deskPosition.y, deskPosition.z];
}

/**
 * Convert desk rotation to 3D rotation array
 * @param deskPosition - Desk position containing rotation
 * @returns Rotation array [x, y, z]
 */
export function toDeskRotation3D(deskPosition: { x: number; y: number; z: number; rotation: number }): [number, number, number] {
  return [0, deskPosition.rotation, 0];
}

/**
 * Office 3D — Agent Configuration
 *
 * This file defines the visual layout of agents in the 3D office.
 * Names, emojis and roles are loaded at runtime from the OpenClaw API
 * (/api/agents → openclaw.json), so you only need to set positions and colors here.
 *
 * Agent IDs correspond to workspace directory suffixes:
 *   id: "main"     → workspace/          (main agent)
 *   id: "studio"   → workspace-studio/
 *   id: "infra"    → workspace-infra/
 *   etc.
 *
 * Add, remove or reposition agents to match your own OpenClaw setup.
 */

export interface AgentConfig {
  id: string;
  name: string;
  emoji: string;
  position: [number, number, number]; // x, y, z
  color: string;
  role: string;
  accessories?: AvatarAccessories;
}

export const AVATAR_HAT_TYPES = {
  none: "none",
  cap: "cap",
  beanie: "beanie",
} as const;

export const AVATAR_HAIR_TYPES = {
  none: "none",
  short: "short",
  long: "long",
  spiky: "spiky",
} as const;

export interface AvatarAccessories {
  glasses?: boolean;
  hat?: (typeof AVATAR_HAT_TYPES)[keyof typeof AVATAR_HAT_TYPES];
  hair?: (typeof AVATAR_HAIR_TYPES)[keyof typeof AVATAR_HAIR_TYPES];
  beard?: boolean;
  earrings?: boolean;
}

export const AGENTS: AgentConfig[] = [
  {
    id: "main",
    name: process.env.NEXT_PUBLIC_AGENT_NAME || "SuperBotijo",
    emoji: process.env.NEXT_PUBLIC_AGENT_EMOJI || "🫙",
    position: [0, 0, 0], // Center — main desk
    color: "#FFCC00",
    role: "Main Agent",
  },
  {
    id: "agent-2",
    name: "Agent 2",
    emoji: "🤖",
    position: [-4, 0, -3],
    color: "#4CAF50",
    role: "Sub-agent",
  },
  {
    id: "agent-3",
    name: "Agent 3",
    emoji: "🤖",
    position: [4, 0, -3],
    color: "#E91E63",
    role: "Sub-agent",
  },
  {
    id: "agent-4",
    name: "Agent 4",
    emoji: "🤖",
    position: [-4, 0, 3],
    color: "#0077B5",
    role: "Sub-agent",
  },
  {
    id: "agent-5",
    name: "Agent 5",
    emoji: "🤖",
    position: [4, 0, 3],
    color: "#9C27B0",
    role: "Sub-agent",
  },
  {
    id: "agent-6",
    name: "Agent 6",
    emoji: "🤖",
    position: [0, 0, 6],
    color: "#607D8B",
    role: "Sub-agent",
  },
];

export type AgentStatus = "idle" | "working" | "thinking" | "error" | "online" | "offline";

export interface Activity {
  id: string;
  timestamp: string;
  type: string;
  description: string;
  status: string;
  tokens_used?: number;
}

export interface AgentState {
  id: string;
  status: AgentStatus;
  currentTask?: string;
  model?: string;
  tokensUsed?: number;
  tokensPerHour?: number;
  sessionCount?: number;
  tasksInQueue?: number;
  uptime?: number;
  lastActivity?: string;
  activities?: Activity[];
  mood?: {
    mood: string;
    emoji: string;
    streak: number;
    energyLevel: number;
  };
}

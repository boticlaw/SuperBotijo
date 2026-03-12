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

export type AgentStatus = "idle" | "working" | "thinking" | "error" | "online" | "offline";

export type AvatarState = "offline" | "idle" | "working" | "thinking" | "error" | "online";

export interface DeskPosition {
  x: number;
  y: number;
  z: number;
  rotation: number;
}

export interface AgentWithDesk {
  id: string;
  name: string;
  emoji: string;
  color: string;
  role: string;
  deskPosition: DeskPosition;
  currentAvatarState: AvatarState;
  accessories?: AvatarAccessories;
}

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

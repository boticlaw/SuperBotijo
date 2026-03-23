import "server-only";

import fs from "fs";
import path from "path";

const AGENT_STATE_PATH = process.env.SUPERBOTIJO_AGENT_STATE_PATH || path.join(process.cwd(), "data", "agent-runtime-state.json");

export const AGENT_RUNTIME_STATUS = {
  working: "working",
  idle: "idle",
  error: "error",
  paused: "paused",
  online: "online",
  offline: "offline",
} as const;

export type AgentRuntimeStatus = (typeof AGENT_RUNTIME_STATUS)[keyof typeof AGENT_RUNTIME_STATUS];

export const AGENT_MOOD = {
  productive: "productive",
  busy: "busy",
  frustrated: "frustrated",
  content: "content",
  tired: "tired",
} as const;

export type AgentMoodValue = (typeof AGENT_MOOD)[keyof typeof AGENT_MOOD];

export interface PersistedAgentMood {
  agentId: string;
  mood: AgentMoodValue;
  emoji: string;
  streak: number;
  energyLevel: number;
  lastCalculated: string;
}

export interface PersistedCustomAgent {
  id: string;
  name: string;
  model: string;
  emoji: string;
  color: string;
  workspace: string;
  createdAt: string;
}

export interface PersistedStatusOverride {
  status: AgentRuntimeStatus;
  currentTask?: string;
  lastActivity: string;
}

interface PersistedAgentState {
  customAgents: Record<string, PersistedCustomAgent>;
  statusOverrides: Record<string, PersistedStatusOverride>;
  moodCache: Record<string, PersistedAgentMood>;
}

function ensureParentDir() {
  const dir = path.dirname(AGENT_STATE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function loadState(): PersistedAgentState {
  try {
    if (!fs.existsSync(AGENT_STATE_PATH)) {
      return {
        customAgents: {},
        statusOverrides: {},
        moodCache: {},
      };
    }

    const raw = fs.readFileSync(AGENT_STATE_PATH, "utf-8");
    const parsed = JSON.parse(raw) as Partial<PersistedAgentState>;

    return {
      customAgents: parsed.customAgents || {},
      statusOverrides: parsed.statusOverrides || {},
      moodCache: parsed.moodCache || {},
    };
  } catch {
    return {
      customAgents: {},
      statusOverrides: {},
      moodCache: {},
    };
  }
}

function saveState(state: PersistedAgentState) {
  ensureParentDir();
  fs.writeFileSync(AGENT_STATE_PATH, JSON.stringify(state, null, 2));
}

export function getPersistedCustomAgents(): PersistedCustomAgent[] {
  return Object.values(loadState().customAgents);
}

export function getPersistedStatusOverride(agentId: string): PersistedStatusOverride | undefined {
  return loadState().statusOverrides[agentId];
}

export function setPersistedStatusOverride(agentId: string, override: PersistedStatusOverride): void {
  const state = loadState();
  state.statusOverrides[agentId] = override;
  saveState(state);
}

export function getPersistedMood(agentId: string): PersistedAgentMood | undefined {
  return loadState().moodCache[agentId];
}

export function setPersistedMood(agentId: string, mood: PersistedAgentMood): void {
  const state = loadState();
  state.moodCache[agentId] = mood;
  saveState(state);
}

export function addPersistedCustomAgent(agent: PersistedCustomAgent): void {
  const state = loadState();
  state.customAgents[agent.id] = agent;
  saveState(state);
}

export function removePersistedCustomAgent(agentId: string): void {
  const state = loadState();
  delete state.customAgents[agentId];
  delete state.statusOverrides[agentId];
  delete state.moodCache[agentId];
  saveState(state);
}

export function clearPersistedStatusOverride(agentId: string): void {
  const state = loadState();
  delete state.statusOverrides[agentId];
  saveState(state);
}

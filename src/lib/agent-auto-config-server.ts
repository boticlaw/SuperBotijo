/**
 * Agent Auto-Configuration - Server Side
 * 
 * Persistence functions that use Node.js APIs.
 * Only import this from server-side code (API routes, etc.)
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

const DATA_DIR = join(process.cwd(), "data");
const CACHE_FILE = join(DATA_DIR, "agent-defaults.json");

import {
  type AgentDefaults,
  HARDCODED_DEFAULTS,
  suggestEmoji,
  generateColor,
  detectDepartment,
} from "./agent-auto-config";

interface AgentDefaultsCache {
  version: number;
  lastUpdated: string;
  agents: Record<string, AgentDefaults>;
}

/**
 * Ensure data directory exists
 */
function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

/**
 * Load cached agent defaults from disk
 */
function loadCache(): AgentDefaultsCache {
  ensureDataDir();
  
  if (!existsSync(CACHE_FILE)) {
    return { version: 1, lastUpdated: new Date().toISOString(), agents: {} };
  }
  
  try {
    const content = readFileSync(CACHE_FILE, "utf-8");
    return JSON.parse(content) as AgentDefaultsCache;
  } catch {
    return { version: 1, lastUpdated: new Date().toISOString(), agents: {} };
  }
}

/**
 * Save agent defaults cache to disk
 */
function saveCache(cache: AgentDefaultsCache): void {
  ensureDataDir();
  cache.lastUpdated = new Date().toISOString();
  writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
}

/**
 * Get or generate defaults for an agent (server version with caching)
 * Priority: hardcoded > cache > generated
 */
export function getAgentDefaultsServer(agentId: string, agentName?: string): AgentDefaults {
  // 1. Check hardcoded defaults first
  if (HARDCODED_DEFAULTS[agentId]) {
    return HARDCODED_DEFAULTS[agentId];
  }
  
  // 2. Check cache
  const cache = loadCache();
  if (cache.agents[agentId]) {
    return cache.agents[agentId];
  }
  
  // 3. Generate new defaults
  const name = agentName || agentId;
  const defaults: AgentDefaults = {
    emoji: suggestEmoji(name),
    color: generateColor(agentId),
    department: detectDepartment(name),
  };
  
  // Save to cache
  cache.agents[agentId] = defaults;
  saveCache(cache);
  
  console.log(`[agent-auto-config] Generated defaults for "${agentId}":`, defaults);
  
  return defaults;
}

/**
 * Get all agent defaults (hardcoded + cached)
 */
export function getAllAgentDefaultsServer(): Record<string, AgentDefaults> {
  const cache = loadCache();
  return { ...cache.agents, ...HARDCODED_DEFAULTS };
}

/**
 * Manually set defaults for an agent
 */
export function setAgentDefaultsServer(agentId: string, defaults: AgentDefaults): void {
  const cache = loadCache();
  cache.agents[agentId] = defaults;
  saveCache(cache);
}

/**
 * Clear cached defaults for an agent
 */
export function clearAgentDefaultsServer(agentId: string): void {
  if (HARDCODED_DEFAULTS[agentId]) {
    return;
  }
  
  const cache = loadCache();
  delete cache.agents[agentId];
  saveCache(cache);
}

/**
 * Get list of discovered agents (not hardcoded)
 */
export function getDiscoveredAgentsServer(): string[] {
  const cache = loadCache();
  return Object.keys(cache.agents).filter((id) => !HARDCODED_DEFAULTS[id]);
}

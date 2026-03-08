/**
 * Agent Auto-Configuration Types and Client-Safe Functions
 * 
 * This file is safe to import from client components.
 * Server-side functions (cache, persistence) are in agent-auto-config-server.ts
 */

// Department definitions
export const DEPARTMENTS = {
  DEVELOPMENT: { id: "development", name: "Development", emoji: "💻", color: "#06b6d4" },
  DATA_EXTRACTION: { id: "data-extraction", name: "Data Extraction", emoji: "📄", color: "#ef4444" },
  MEMORY_NOTES: { id: "memory-notes", name: "Memory & Notes", emoji: "🧠", color: "#10b981" },
  COMMUNICATION: { id: "communication", name: "Communication", emoji: "💬", color: "#8b5cf6" },
  INFRASTRUCTURE: { id: "infrastructure", name: "Infrastructure", emoji: "🏗️", color: "#6366f1" },
  ENTERTAINMENT: { id: "entertainment", name: "Entertainment", emoji: "🎮", color: "#f59e0b" },
  GENERAL: { id: "general", name: "General", emoji: "🤖", color: "#3b82f6" },
  OTHER: { id: "other", name: "Other", emoji: "📁", color: "#6b7280" },
} as const;

export type DepartmentId = keyof typeof DEPARTMENTS;

export interface AgentDefaults {
  emoji: string;
  color: string;
  department?: DepartmentId;
}

// Hardcoded defaults for known agents (these always take precedence)
export const HARDCODED_DEFAULTS: Record<string, AgentDefaults> = {
  boti: { emoji: "🤖", color: "#3b82f6", department: "GENERAL" },
  opencode: { emoji: "⚡", color: "#8b5cf6", department: "DEVELOPMENT" },
  memo: { emoji: "🧠", color: "#10b981", department: "MEMORY_NOTES" },
  escapeitor: { emoji: "🔐", color: "#f59e0b", department: "ENTERTAINMENT" },
  superbotijo: { emoji: "🫙", color: "#6366f1", department: "INFRASTRUCTURE" },
  extractor: { emoji: "📄", color: "#ef4444", department: "DATA_EXTRACTION" },
  code: { emoji: "💻", color: "#06b6d4", department: "DEVELOPMENT" },
  scout: { emoji: "🔍", color: "#f97316", department: "DATA_EXTRACTION" },
};

// Emoji suggestions based on keywords in agent name
const EMOJI_KEYWORDS: Array<{ keywords: string[]; emoji: string }> = [
  { keywords: ["code", "coder", "dev", "program"], emoji: "💻" },
  { keywords: ["extract", "scraper", "parser"], emoji: "📄" },
  { keywords: ["memo", "memory", "note"], emoji: "📝" },
  { keywords: ["escape", "game", "room"], emoji: "🔐" },
  { keywords: ["open", "shell", "terminal"], emoji: "⚡" },
  { keywords: ["bot", "assistant", "helper"], emoji: "🤖" },
  { keywords: ["brain", "think", "mind"], emoji: "🧠" },
  { keywords: ["data", "analy", "metric"], emoji: "📊" },
  { keywords: ["web", "fetch", "browse"], emoji: "🌐" },
  { keywords: ["file", "folder", "disk"], emoji: "📁" },
  { keywords: ["chat", "talk", "message"], emoji: "💬" },
  { keywords: ["image", "photo", "picture"], emoji: "🖼️" },
  { keywords: ["video", "movie", "stream"], emoji: "🎬" },
  { keywords: ["audio", "sound", "music"], emoji: "🎵" },
  { keywords: ["test", "spec", "check"], emoji: "🧪" },
  { keywords: ["doc", "readme", "wiki"], emoji: "📚" },
  { keywords: ["git", "repo", "version"], emoji: "📦" },
  { keywords: ["cloud", "deploy", "server"], emoji: "☁️" },
  { keywords: ["security", "auth", "secure"], emoji: "🔒" },
  { keywords: ["api", "rest", "graphql"], emoji: "🔌" },
  { keywords: ["db", "database", "sql"], emoji: "🗄️" },
  { keywords: ["email", "mail", "smtp"], emoji: "📧" },
  { keywords: ["calendar", "schedule", "event"], emoji: "📅" },
  { keywords: ["task", "todo", "job"], emoji: "✅" },
  { keywords: ["search", "find", "query"], emoji: "🔍" },
  { keywords: ["translate", "lang", "i18n"], emoji: "🌐" },
  { keywords: ["math", "calc", "number"], emoji: "🔢" },
  { keywords: ["ai", "ml", "model", "neural"], emoji: "🧠" },
  { keywords: ["super", "admin", "manager"], emoji: "🫙" },
];

/**
 * Simple deterministic color generation from string (browser-safe)
 */
export function generateColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    const char = id.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  const hex = Math.abs(hash).toString(16).padStart(6, "0").slice(0, 6);
  return `#${hex}`;
}

/**
 * Suggest an emoji based on agent name/id
 */
export function suggestEmoji(name: string): string {
  const lowerName = name.toLowerCase();
  
  for (const { keywords, emoji } of EMOJI_KEYWORDS) {
    if (keywords.some((kw) => lowerName.includes(kw))) {
      return emoji;
    }
  }
  
  return "🤖";
}

/**
 * Detect department based on agent name/id
 */
export function detectDepartment(name: string): DepartmentId {
  const lowerName = name.toLowerCase();
  
  // Development - code, programming, testing
  if (
    lowerName.includes("code") ||
    lowerName.includes("dev") ||
    lowerName.includes("program") ||
    lowerName.includes("test") ||
    lowerName.includes("spec") ||
    lowerName.includes("build")
  ) {
    return "DEVELOPMENT";
  }
  
  // Data - extraction, parsing, scraping
  if (
    lowerName.includes("extract") ||
    lowerName.includes("scrape") ||
    lowerName.includes("parse") ||
    lowerName.includes("data")
  ) {
    return "DATA_EXTRACTION";
  }
  
  // Memory - notes, reminders
  if (
    lowerName.includes("memo") ||
    lowerName.includes("memory") ||
    lowerName.includes("note") ||
    lowerName.includes("reminder")
  ) {
    return "MEMORY_NOTES";
  }
  
  // Communication - chat, messaging
  if (
    lowerName.includes("chat") ||
    lowerName.includes("talk") ||
    lowerName.includes("message") ||
    lowerName.includes("telegram") ||
    lowerName.includes("discord")
  ) {
    return "COMMUNICATION";
  }
  
  // Infrastructure - system, admin
  if (
    lowerName.includes("system") ||
    lowerName.includes("admin") ||
    lowerName.includes("monitor") ||
    lowerName.includes("manage") ||
    lowerName.includes("super")
  ) {
    return "INFRASTRUCTURE";
  }
  
  // Entertainment - games, puzzles
  if (
    lowerName.includes("escape") ||
    lowerName.includes("game") ||
    lowerName.includes("puzzle") ||
    lowerName.includes("room")
  ) {
    return "ENTERTAINMENT";
  }
  
  // General - default
  if (
    lowerName.includes("general") ||
    lowerName.includes("default") ||
    lowerName.includes("main") ||
    lowerName.includes("bot") ||
    lowerName.includes("assistant") ||
    lowerName.includes("helper")
  ) {
    return "GENERAL";
  }
  
  return "OTHER";
}

/**
 * Get agent defaults (client-safe version)
 * Only uses hardcoded defaults and auto-detection (no cache)
 */
export function getAgentDefaults(agentId: string, agentName?: string): AgentDefaults {
  // 1. Check hardcoded defaults first
  if (HARDCODED_DEFAULTS[agentId]) {
    return HARDCODED_DEFAULTS[agentId];
  }
  
  // 2. Generate defaults
  const name = agentName || agentId;
  return {
    emoji: suggestEmoji(name),
    color: generateColor(agentId),
    department: detectDepartment(name),
  };
}

/**
 * Get department for an agent
 */
export function getAgentDepartment(agentId: string, agentName?: string): DepartmentId {
  const defaults = getAgentDefaults(agentId, agentName);
  return defaults.department || "OTHER";
}

/**
 * Group agents by department
 */
export function groupAgentsByDepartment<T extends { id: string; name?: string }>(
  agents: T[]
): Partial<Record<DepartmentId, T[]>> {
  const grouped: Partial<Record<DepartmentId, T[]>> = {};
  
  for (const agent of agents) {
    const dept = getAgentDepartment(agent.id, agent.name);
    if (!grouped[dept]) {
      grouped[dept] = [];
    }
    grouped[dept]!.push(agent);
  }
  
  return grouped;
}

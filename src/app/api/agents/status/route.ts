import { NextResponse } from "next/server";
import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

export const dynamic = "force-dynamic";

interface AgentStatus {
  id: string;
  status: 'working' | 'idle' | 'online' | 'offline';
  lastActivity?: string;
  activeSessions: number;
  currentTask?: string;
}

interface AgentConfig {
  id: string;
  workspace?: string;
}

interface CacheEntry {
  data: { agents: AgentStatus[]; timestamp: number };
  timestamp: number;
}

let statusCache: CacheEntry | null = null;
const CACHE_TTL = 10000; // 10 seconds

/**
 * Count active sessions for an agent
 * Active = .jsonl file modified in last 5 minutes
 */
function countActiveSessions(agentId: string, openclawDir: string): number {
  const sessionsDir = join(openclawDir, "agents", agentId, "sessions");
  
  if (!existsSync(sessionsDir)) return 0;
  
  try {
    const files = readdirSync(sessionsDir);
    let active = 0;
    
    for (const file of files) {
      if (!file.endsWith('.jsonl')) continue;
      
      try {
        const stat = statSync(join(sessionsDir, file));
        const ageMs = Date.now() - stat.mtime.getTime();
        
        // Active if modified in last 5 minutes
        if (ageMs < 5 * 60 * 1000) {
          active++;
        }
      } catch {
        // File might be locked or deleted, skip
        continue;
      }
    }
    
    return active;
  } catch {
    return 0;
  }
}

/**
 * Get latest activity timestamp for an agent
 */
function getLatestActivity(agentId: string, openclawDir: string): string | undefined {
  const sessionsDir = join(openclawDir, "agents", agentId, "sessions");
  
  if (!existsSync(sessionsDir)) return undefined;
  
  try {
    const files = readdirSync(sessionsDir);
    let latest = 0;
    
    for (const file of files) {
      if (!file.endsWith('.jsonl') && !file.endsWith('.jsonl.lock')) continue;
      
      try {
        const stat = statSync(join(sessionsDir, file));
        if (stat.mtime.getTime() > latest) {
          latest = stat.mtime.getTime();
        }
      } catch {
        continue;
      }
    }
    
    return latest > 0 ? new Date(latest).toISOString() : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Determine agent status based on activity and sessions
 */
function determineAgentStatus(
  lastActivity?: string, 
  activeSessions: number = 0
): 'working' | 'idle' | 'online' | 'offline' {
  // Working if has active sessions
  if (activeSessions > 0) return 'working';
  
  // Online if recent activity (last 5 minutes)
  if (lastActivity) {
    const ageMs = Date.now() - new Date(lastActivity).getTime();
    if (ageMs < 5 * 60 * 1000) {
      return 'online';
    }
  }
  
  // Idle if some activity (last 1 hour)
  if (lastActivity) {
    const ageMs = Date.now() - new Date(lastActivity).getTime();
    if (ageMs < 60 * 60 * 1000) {
      return 'idle';
    }
  }
  
  // Offline otherwise
  return 'offline';
}

/**
 * Get current task from last session message
 */
function getCurrentTask(agentId: string, openclawDir: string): string | undefined {
  const sessionsDir = join(openclawDir, "agents", agentId, "sessions");
  
  if (!existsSync(sessionsDir)) return undefined;
  
  try {
    const files = readdirSync(sessionsDir)
      .filter(f => f.endsWith('.jsonl'))
      .map(f => ({
        name: f,
        mtime: statSync(join(sessionsDir, f)).mtime.getTime()
      }))
      .sort((a, b) => b.mtime - a.mtime);
    
    if (files.length === 0) return undefined;
    
    // Read last few lines of most recent session
    const sessionPath = join(sessionsDir, files[0].name);
    const content = readFileSync(sessionPath, 'utf-8');
    const lines = content.trim().split('\n').slice(-5); // Last 5 messages
    
    // Find last user message
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const msg = JSON.parse(lines[i]);
        if (msg.role === 'user' && msg.content) {
          const content = typeof msg.content === 'string' 
            ? msg.content 
            : msg.content[0]?.text || '';
          
          // Truncate to 50 chars
          return content.substring(0, 50) + (content.length > 50 ? '...' : '');
        }
      } catch {
        continue;
      }
    }
    
    return undefined;
  } catch {
    return undefined;
  }
}

export async function GET() {
  const now = Date.now();
  
  // Return cached data if still fresh
  if (statusCache && (now - statusCache.timestamp) < CACHE_TTL) {
    return NextResponse.json(statusCache.data);
  }
  
  try {
    const openclawDir = process.env.OPENCLAW_DIR || "/home/daniel/.openclaw";
    const configPath = join(openclawDir, "openclaw.json");
    
    if (!existsSync(configPath)) {
      return NextResponse.json(
        { error: "Config not found" },
        { status: 500 }
      );
    }
    
    const config = JSON.parse(readFileSync(configPath, "utf-8"));
    
    // Compute statuses for all agents
    const statuses: AgentStatus[] = config.agents.list.map((agent: AgentConfig) => {
      const activeSessions = countActiveSessions(agent.id, openclawDir);
      const lastActivity = getLatestActivity(agent.id, openclawDir);
      const status = determineAgentStatus(lastActivity, activeSessions);
      const currentTask = getCurrentTask(agent.id, openclawDir);
      
      return {
        id: agent.id,
        status,
        lastActivity,
        activeSessions,
        currentTask,
      };
    });
    
    // Update cache
    const responseData = {
      agents: statuses,
      timestamp: now,
    };
    
    statusCache = {
      data: responseData,
      timestamp: now,
    };
    
    return NextResponse.json(responseData);
  } catch (error) {
    console.error("Error computing agent statuses:", error);
    
    // Return error but don't crash
    return NextResponse.json(
      { 
        error: "Failed to compute statuses",
        agents: [],
        timestamp: now 
      },
      { status: 500 }
    );
  }
}

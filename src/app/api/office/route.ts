import { NextResponse } from "next/server";
import { readFileSync, statSync } from "fs";
import { join } from "path";

export const dynamic = "force-dynamic";

interface AgentConfigEntry {
  id: string;
  name?: string;
  workspace?: string;
}

const AGENT_CONFIG = {
  main: { emoji: "🫙", color: "#ff6b35", name: "SuperBotijo", role: "Boss" },
  academic: {
    emoji: "🎓",
    color: "#4ade80",
    name: "Profe",
    role: "Teacher",
  },
  infra: {
    emoji: "🔧",
    color: "#f97316",
    name: "Infra",
    role: "DevOps",
  },
  studio: {
    emoji: "🎬",
    color: "#a855f7",
    name: "Studio",
    role: "Video Editor",
  },
  social: {
    emoji: "📱",
    color: "#ec4899",
    name: "Social",
    role: "Social Media",
  },
  linkedin: {
    emoji: "💼",
    color: "#0077b5",
    name: "LinkedIn Pro",
    role: "Professional",
  },
  devclaw: {
    emoji: "👨‍💻",
    color: "#8b5cf6",
    name: "DevClaw",
    role: "Developer",
  },
  freelance: {
    emoji: "👨‍💻",
    color: "#8b5cf6",
    name: "DevClaw",
    role: "Developer",
  },
};

interface AgentSession {
  agentId: string;
  sessionId: string;
  label?: string;
  lastActivity?: string;
  createdAt?: string;
}

async function getAgentStatusFromGateway(): Promise<
  Record<string, { isActive: boolean; currentTask: string; lastSeen: number }>
> {
  try {
    const configPath = (process.env.OPENCLAW_DIR || "/home/daniel/.openclaw") + "/openclaw.json";
    const config = JSON.parse(readFileSync(configPath, "utf-8"));
    const gatewayToken = config.gateway?.auth?.token;

    if (!gatewayToken) {
      console.warn("No gateway token found");
      return {};
    }

    // Try to fetch sessions from gateway
    const response = await fetch("http://localhost:18789/api/sessions", {
      headers: {
        Authorization: `Bearer ${gatewayToken}`,
      },
      signal: AbortSignal.timeout(2000), // 2s timeout
    });

    if (!response.ok) {
      console.warn("Gateway returned non-OK status:", response.status);
      return {};
    }

    // Verify Content-Type before parsing JSON
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      console.warn("Gateway returned non-JSON response:", contentType);
      return {};
    }

    const sessions = (await response.json()) as AgentSession[];
    const agentStatus: Record<
      string,
      { isActive: boolean; currentTask: string; lastSeen: number }
    > = {};

    for (const session of sessions) {
      if (!session.agentId) continue;

      const lastActivity = session.lastActivity
        ? new Date(session.lastActivity).getTime()
        : 0;
      const now = Date.now();
      const minutesAgo = (now - lastActivity) / 1000 / 60;

      let status = "SLEEPING";
      let currentTask = "zzZ...";

      if (minutesAgo < 5) {
        status = "ACTIVE";
        currentTask = session.label || "Working on task...";
      } else if (minutesAgo < 30) {
        status = "IDLE";
        currentTask = session.label || "Idle...";
      }

      // Keep most recent activity per agent
      if (
        !agentStatus[session.agentId] ||
        lastActivity > agentStatus[session.agentId].lastSeen
      ) {
        agentStatus[session.agentId] = {
          isActive: status === "ACTIVE",
          currentTask: `${status}: ${currentTask}`,
          lastSeen: lastActivity,
        };
      }
    }

    return agentStatus;
  } catch (error) {
    console.warn("Failed to fetch from gateway:", error);
    return {};
  }
}

function getAgentStatusFromFiles(
  agentId: string,
  workspace: string
): { isActive: boolean; currentTask: string; lastSeen: number } {
  try {
    const today = new Date().toISOString().split("T")[0];
    const memoryFile = join(workspace, "memory", `${today}.md`);

    // Check if file exists
    const stat = statSync(memoryFile);
    const lastSeen = stat.mtime.getTime();
    const minutesSinceUpdate = (Date.now() - lastSeen) / 1000 / 60;

    const content = readFileSync(memoryFile, "utf-8");
    const lines = content.trim().split("\n").filter((l) => l.trim());

    let currentTask = "Idle...";
    if (lines.length > 0) {
      // Get last meaningful line (skip timestamps)
      const lastLine = lines
        .slice(-10)
        .reverse()
        .find((l) => l.length > 20 && !l.match(/^#+\s/));

      if (lastLine) {
        currentTask = lastLine.replace(/^[-*]\s*/, "").slice(0, 100);
        if (lastLine.length > 100) currentTask += "...";
      }
    }

    // Determine status based on file modification time
    if (minutesSinceUpdate < 5) {
      return { isActive: true, currentTask: `ACTIVE: ${currentTask}`, lastSeen };
    } else if (minutesSinceUpdate < 30) {
      return { isActive: false, currentTask: `IDLE: ${currentTask}`, lastSeen };
    } else {
      return { isActive: false, currentTask: "SLEEPING: zzZ...", lastSeen };
    }
  } catch (error) {
    // No memory file or error reading
    return { isActive: false, currentTask: "SLEEPING: zzZ...", lastSeen: 0 };
  }
}

export async function GET() {
  try {
    const configPath = (process.env.OPENCLAW_DIR || "/home/daniel/.openclaw") + "/openclaw.json";
    const config = JSON.parse(readFileSync(configPath, "utf-8"));

    // Try gateway first, fallback to file-based
    const gatewayStatus = await getAgentStatusFromGateway();

    const agents = config.agents.list.map((agent: AgentConfigEntry) => {
      const agentInfo = AGENT_CONFIG[agent.id as keyof typeof AGENT_CONFIG] || {
        emoji: "🤖",
        color: "#666",
        name: agent.name || agent.id,
        role: "Agent",
      };

      // Get status from gateway, or fallback to files
      let status = gatewayStatus[agent.id];
      if (!status && agent.workspace) {
        status = getAgentStatusFromFiles(agent.id, agent.workspace);
      }

      // Default status if not found
      const finalStatus = status || { isActive: false, currentTask: "Offline", lastSeen: 0 };

      // Map freelance -> devclaw for canvas compatibility
      const canvasId = agent.id === "freelance" ? "devclaw" : agent.id;

      return {
        id: canvasId,
        name: agentInfo.name,
        emoji: agentInfo.emoji,
        color: agentInfo.color,
        role: agentInfo.role,
        currentTask: finalStatus.currentTask,
        isActive: finalStatus.isActive,
      };
    });

    return NextResponse.json({ agents });
  } catch (error) {
    console.error("Error getting office data:", error);
    return NextResponse.json(
      { error: "Failed to load office data" },
      { status: 500 }
    );
  }
}

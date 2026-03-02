import { NextResponse } from "next/server";
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

export const dynamic = "force-dynamic";

interface AgentConfig {
  id: string;
  name?: string;
  workspace: string;
  model?: { primary?: string };
  subagents?: { allowAgents?: string[] };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const configPath = (process.env.OPENCLAW_DIR || "/home/daniel/.openclaw") + "/openclaw.json";
    const config = JSON.parse(readFileSync(configPath, "utf-8"));

    const agent = config.agents.list.find((a: AgentConfig) => a.id === id);
    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const memoryPath = join(agent.workspace, "memory");
    let recentFiles: Array<{ date: string; size: number; modified: string }> =
      [];

    try {
      const files = readdirSync(memoryPath).filter((f) =>
        f.match(/^\d{4}-\d{2}-\d{2}\.md$/)
      );
      recentFiles = files
        .map((file) => {
          const stat = statSync(join(memoryPath, file));
          return {
            date: file.replace(".md", ""),
            size: stat.size,
            modified: stat.mtime.toISOString(),
          };
        })
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 7);
    } catch {
      // Memory directory doesn't exist
    }

    interface SessionInfo {
      id: string;
      status: string;
    }
    const sessions: SessionInfo[] = [];

    const telegramAccount = config.channels?.telegram?.accounts?.[id];

    return NextResponse.json({
      agent: {
        id: agent.id,
        name: agent.name,
        model: agent.model?.primary || config.agents.defaults.model.primary,
        workspace: agent.workspace,
        dmPolicy: telegramAccount?.dmPolicy,
        allowAgents: agent.subagents?.allowAgents || [],
        telegramConfigured: !!telegramAccount?.botToken,
      },
      memory: {
        recentFiles,
      },
      sessions,
    });
  } catch (error) {
    console.error("Error getting agent status:", error);
    return NextResponse.json(
      { error: "Failed to get agent status" },
      { status: 500 }
    );
  }
}

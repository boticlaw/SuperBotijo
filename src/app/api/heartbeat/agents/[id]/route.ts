import { NextRequest, NextResponse } from "next/server";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

export const dynamic = "force-dynamic";

const OPENCLAW_DIR = process.env.OPENCLAW_DIR || "/home/daniel/.openclaw";

interface HeartbeatConfig {
  every: string;
  target: string;
  activeHours?: { start: string; end: string } | null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { every, target, activeHours } = body as HeartbeatConfig;

    const configPath = join(OPENCLAW_DIR, "openclaw.json");

    if (!existsSync(configPath)) {
      return NextResponse.json(
        { error: "openclaw.json not found" },
        { status: 404 }
      );
    }

    const raw = readFileSync(configPath, "utf-8");
    const config = JSON.parse(raw);

    // Find the agent in the list
    const agentIndex = config.agents?.list?.findIndex(
      (a: { id: string }) => a.id === id
    );

    if (agentIndex === -1 || agentIndex === undefined) {
      return NextResponse.json(
        { error: `Agent '${id}' not found` },
        { status: 404 }
      );
    }

    // Update the heartbeat config
    if (!config.agents.list[agentIndex].heartbeat) {
      config.agents.list[agentIndex].heartbeat = {};
    }

    if (every !== undefined) {
      config.agents.list[agentIndex].heartbeat.every = every;
    }
    if (target !== undefined) {
      config.agents.list[agentIndex].heartbeat.target = target;
    }
    if (activeHours !== undefined) {
      config.agents.list[agentIndex].heartbeat.activeHours = activeHours;
    }

    // Write back
    writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");

    return NextResponse.json({
      success: true,
      agentId: id,
      heartbeat: config.agents.list[agentIndex].heartbeat,
    });
  } catch (error) {
    console.error("[heartbeat/agent] Error updating:", error);
    return NextResponse.json(
      { error: "Failed to update agent heartbeat" },
      { status: 500 }
    );
  }
}

/**
 * Agent Config API - Get/Update config for a specific agent
 * Backed by SQLite for persistence across restarts
 */
import { NextRequest, NextResponse } from "next/server";
import { getAgentById } from "@/operations/agent-ops";
import {
  getAgentConfig,
  setAgentConfig,
  DEFAULT_CONFIG,
  type AgentConfig,
  type AgentConfigInput,
} from "@/lib/agent-config-store";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: agentId } = await params;

    const agentResult = await getAgentById(agentId);
    if (!agentResult.success) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const config = getAgentConfig(agentId);
    const response: AgentConfig = config || {
      agentId,
      ...DEFAULT_CONFIG,
      model: agentResult.data?.model || DEFAULT_CONFIG.model,
      updatedAt: new Date().toISOString(),
    };

    return NextResponse.json({ config: response });
  } catch (error) {
    console.error("[api/agents/[id]/config] GET error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get config" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: agentId } = await params;
    const body = await request.json();

    const agentResult = await getAgentById(agentId);
    if (!agentResult.success) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const updates: AgentConfigInput = {};

    if (body.temperature !== undefined) {
      const temp = parseFloat(body.temperature);
      if (Number.isNaN(temp) || temp < 0 || temp > 2) {
        return NextResponse.json({ error: "Invalid temperature (0-2)" }, { status: 400 });
      }
      updates.temperature = temp;
    }

    if (body.maxTokens !== undefined) {
      const tokens = parseInt(body.maxTokens, 10);
      if (Number.isNaN(tokens) || tokens < 1 || tokens > 100000) {
        return NextResponse.json({ error: "Invalid maxTokens (1-100000)" }, { status: 400 });
      }
      updates.maxTokens = tokens;
    }

    if (body.heartbeatInterval !== undefined) {
      const interval = parseInt(body.heartbeatInterval, 10);
      if (Number.isNaN(interval) || interval < 5 || interval > 3600) {
        return NextResponse.json({ error: "Invalid heartbeatInterval (5-3600 seconds)" }, { status: 400 });
      }
      updates.heartbeatInterval = interval;
    }

    if (body.model !== undefined) {
      updates.model = String(body.model);
    }

    if (body.autoStart !== undefined) {
      updates.autoStart = Boolean(body.autoStart);
    }

    if (body.logLevel !== undefined) {
      if (!["debug", "info", "warn", "error"].includes(body.logLevel)) {
        return NextResponse.json({ error: "Invalid logLevel" }, { status: 400 });
      }
      updates.logLevel = body.logLevel;
    }

    if (body.skills !== undefined) {
      updates.skills = Array.isArray(body.skills) ? body.skills : [];
    }

    const newConfig = setAgentConfig(agentId, updates);

    return NextResponse.json({
      success: true,
      config: newConfig,
      message: "Config updated successfully",
    });
  } catch (error) {
    console.error("[api/agents/[id]/config] PATCH error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update config" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: agentId } = await params;

    const agentResult = await getAgentById(agentId);
    if (!agentResult.success) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const { deleteAgentConfig } = await import("@/lib/agent-config-store");
    const deleted = deleteAgentConfig(agentId);

    if (!deleted) {
      return NextResponse.json({ message: "No config to delete" }, { status: 200 });
    }

    return NextResponse.json({
      success: true,
      message: "Config reset to defaults",
    });
  } catch (error) {
    console.error("[api/agents/[id]/config] DELETE error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete config" },
      { status: 500 }
    );
  }
}

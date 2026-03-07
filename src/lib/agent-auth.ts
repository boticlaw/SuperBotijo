/**
 * Agent Authentication Library
 * 
 * Validates API requests from OpenClaw agents using API keys.
 * Each agent has a unique key configured in OPENCLAW_AGENT_KEYS env var.
 * 
 * Format: OPENCLAW_AGENT_KEYS=boti:sk-key-1,leo:sk-key-2,memo:sk-key-3
 */
import { NextRequest, NextResponse } from "next/server";

// ============================================================================
// Types
// ============================================================================

export interface AgentAuthResult {
  agentId: string;
}

// ============================================================================
// Agent Key Management
// ============================================================================

// Parse agent keys from environment (memoized)
let _agentKeys: Map<string, string> | null = null;

function getAgentKeys(): Map<string, string> {
  if (_agentKeys) return _agentKeys;

  _agentKeys = new Map();
  const raw = process.env.OPENCLAW_AGENT_KEYS || "";

  for (const entry of raw.split(",")) {
    const trimmed = entry.trim();
    if (!trimmed) continue;

    const colonIndex = trimmed.indexOf(":");
    if (colonIndex === -1) continue;

    const agentId = trimmed.slice(0, colonIndex).trim();
    const apiKey = trimmed.slice(colonIndex + 1).trim();

    if (agentId && apiKey) {
      _agentKeys.set(agentId, apiKey);
    }
  }

  return _agentKeys;
}

/**
 * Reset the agent keys cache (for testing)
 */
export function resetAgentKeysCache(): void {
  _agentKeys = null;
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate agent authentication from request headers
 *
 * Required headers:
 * - X-Agent-Id: The agent's ID (e.g., "boti", "leo")
 * - X-Agent-Key: The agent's API key
 *
 * @param request - The incoming request
 * @returns Agent ID if valid, null if invalid
 */
export function validateAgentAuth(request: NextRequest): string | null {
  const agentId = request.headers.get("X-Agent-Id");
  const agentKey = request.headers.get("X-Agent-Key");

  if (!agentId || !agentKey) {
    return null;
  }

  const keys = getAgentKeys();
  const expectedKey = keys.get(agentId);

  if (!expectedKey || expectedKey !== agentKey) {
    return null;
  }

  return agentId;
}

/**
 * Require agent authentication, *
 * Use as a middleware-like function in API routes
 *
 * @param request - The incoming request
 * @returns Agent ID if valid, or NextResponse with 401 error
 */
export function requireAgentAuth(
  request: NextRequest
): AgentAuthResult | NextResponse {
  const agentId = validateAgentAuth(request);

  if (!agentId) {
    return NextResponse.json(
      {
        error: "Unauthorized",
        message: "Valid X-Agent-Id and X-Agent-Key headers required",
      },
      { status: 401 }
    );
  }

  return { agentId };
}

/**
 * Get list of configured agent IDs
 * Useful for UI filters
 *
 * @returns Array of agent IDs that have API keys configured
 */
export function getConfiguredAgents(): string[] {
  return Array.from(getAgentKeys().keys());
}

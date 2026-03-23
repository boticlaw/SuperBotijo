/**
 * Authentication helpers for API routes.
 *
 * AUTHORIZATION MODEL:
 *
 * Public routes:
 * - /api/auth/login
 * - /api/auth/logout
 * - /api/health
 *
 * /api/heartbeat:
 * - GET /api/heartbeat → SESSION REQUIRED
 * - PUT /api/heartbeat → SESSION REQUIRED
 * - PATCH /api/heartbeat/agents/[id] → SESSION REQUIRED
 * - GET /api/heartbeat/tasks → AGENT KEY REQUIRED
 *
 * /api/kanban/agent (Agent endpoints):
 * - All endpoints require either:
 *   1) X-Agent-Id + X-Agent-Key headers, OR
 *   2) Authenticated human session
 * - Uses requireAgentOrSessionAuth()
 *
 * Rationale:
 * - Minimize public surface area
 * - Keep auth policy explicit and consistent in route handlers
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAgentAuth } from "@/lib/agent-auth";
import { sessionStore } from "@/lib/session-store";

export interface AuthResult {
  authorized: boolean;
  error?: NextResponse;
}

export interface AgentOrSessionAuthResult {
  authorized: boolean;
  authType?: "agent" | "session";
  agentId?: string;
  error?: NextResponse;
}

export async function requireAuth(request: NextRequest): Promise<AuthResult> {
  const token = extractToken(request);

  if (!token) {
    return {
      authorized: false,
      error: NextResponse.json(
        { error: "Unauthorized", message: "Authentication required" },
        { status: 401 }
      ),
    };
  }

  const isValid = await sessionStore.validate(token);

  if (!isValid) {
    return {
      authorized: false,
      error: NextResponse.json(
        { error: "Unauthorized", message: "Invalid or expired token" },
        { status: 401 }
      ),
    };
  }

  return { authorized: true };
}

export async function requireAgentOrSessionAuth(
  request: NextRequest
): Promise<AgentOrSessionAuthResult> {
  const agentAuth = requireAgentAuth(request);
  if (!(agentAuth instanceof NextResponse)) {
    return {
      authorized: true,
      authType: "agent",
      agentId: agentAuth.agentId,
    };
  }

  const sessionAuth = await requireAuth(request);
  if (sessionAuth.authorized) {
    return {
      authorized: true,
      authType: "session",
    };
  }

  return {
    authorized: false,
    error: NextResponse.json(
      {
        error: "Unauthorized",
        message: "Valid X-Agent-Id and X-Agent-Key headers or authenticated session required",
      },
      { status: 401 }
    ),
  };
}

function extractToken(request: NextRequest): string | null {
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  return request.cookies.get("auth_token")?.value ?? null;
}

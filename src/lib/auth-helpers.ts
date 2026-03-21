/**
 * Authentication helpers for API routes.
 *
 * AUTHORIZATION MODEL:
 *
 * /api/heartbeat:
 * - GET /api/heartbeat → PUBLIC (agents poll for config)
 * - GET /api/heartbeat/tasks → PUBLIC (agents poll for assigned tasks)
 * - PUT /api/heartbeat → AUTH REQUIRED (writes HEARTBEAT.md)
 * - PATCH /api/heartbeat/agents/[id] → AUTH REQUIRED (modifies agent config)
 *
 * /api/kanban/tasks (Human endpoints):
 * - GET /api/kanban/tasks → PUBLIC (dashboard needs to list tasks)
 * - GET /api/kanban/tasks/[id] → PUBLIC (dashboard needs to view tasks)
 * - GET /api/kanban/tasks/[id]/comments → PUBLIC (dashboard needs to view comments)
 * - POST /api/kanban/tasks → AUTH REQUIRED (create task)
 * - PUT /api/kanban/tasks/[id] → AUTH REQUIRED (update task)
 * - DELETE /api/kanban/tasks/[id] → AUTH REQUIRED (delete task)
 * - POST /api/kanban/tasks/[id]/claim → AUTH REQUIRED (claim task)
 * - DELETE /api/kanban/tasks/[id]/claim → AUTH REQUIRED (release claim)
 * - POST /api/kanban/tasks/[id]/move → AUTH REQUIRED (move task)
 * - POST /api/kanban/tasks/[id]/comments → AUTH REQUIRED (create comment)
 *
 * /api/kanban/agent (Agent endpoints):
 * - All endpoints require X-Agent-Id and X-Agent-Key headers
 * - Uses requireAgentAuth() from @/lib/agent-auth
 *
 * Rationale: 
 * - Agents need to poll heartbeat and view tasks without human sessions
 * - Human mutations require session authentication
 * - Agent mutations require agent API key authentication
 */

import { NextRequest, NextResponse } from "next/server";
import { sessionStore } from "@/lib/session-store";

export interface AuthResult {
  authorized: boolean;
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

function extractToken(request: NextRequest): string | null {
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  return request.cookies.get("auth_token")?.value ?? null;
}

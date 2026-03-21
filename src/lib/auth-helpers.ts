/**
 * Authentication helpers for API routes.
 *
 * AUTHORIZATION MODEL FOR /api/heartbeat:
 * - GET /api/heartbeat → PUBLIC (agents poll for config)
 * - GET /api/heartbeat/tasks → PUBLIC (agents poll for assigned tasks)
 * - PUT /api/heartbeat → AUTH REQUIRED (writes HEARTBEAT.md)
 * - PATCH /api/heartbeat/agents/[id] → AUTH REQUIRED (modifies agent config)
 *
 * Rationale: Agents need to poll heartbeat endpoints without human sessions,
 * but write operations must be restricted to authenticated dashboard users.
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

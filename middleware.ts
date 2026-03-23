import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { validateAgentAuth } from "@/lib/agent-auth";
import { sessionStore } from "@/lib/session-store";

// Routes that never require authentication
const PUBLIC_ROUTES = new Set(["/login"]);

// API routes that are always public
const PUBLIC_API_PREFIXES = [
  "/api/auth/",
  "/api/health",
  "/api/debug/public",
];

const AGENT_API_PREFIXES = [
  "/api/heartbeat/tasks",
  "/api/kanban/agent/",
];

function extractToken(request: NextRequest): string | null {
  // Check Authorization header first
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  // Fall back to cookie (set by login API)
  return request.cookies.get("auth_token")?.value ?? null;
}

async function isAuthenticated(request: NextRequest): Promise<boolean> {
  const token = extractToken(request);
  if (!token) {
    return false;
  }
  return sessionStore.validate(token);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow public pages (login)
  if (PUBLIC_ROUTES.has(pathname)) {
    return NextResponse.next();
  }

  // Always allow public API routes
  if (PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  // Agent API routes must use explicit agent credentials
  if (AGENT_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
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

    return NextResponse.next();
  }

  // Check authentication
  if (!(await isAuthenticated(request))) {
    // For API routes: return 401 JSON
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Authentication required" },
        { status: 401 }
      );
    }

    // For page routes: redirect to login
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|_next/webpack|favicon.ico|.*\\..*).*)",
  ],
};

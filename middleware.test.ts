import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { middleware } from "./middleware";
import { sessionStore } from "@/lib/session-store";
import { resetAgentKeysCache } from "@/lib/agent-auth";

const previousAuthSecret = process.env.AUTH_SECRET;
const previousAgentKeys = process.env.OPENCLAW_AGENT_KEYS;

describe("middleware auth policy", () => {
  let authToken = "";

  beforeEach(async () => {
    process.env.AUTH_SECRET = "test-secret-123456789012345678901234567890";
    process.env.OPENCLAW_AGENT_KEYS = "agent-a:key-agent-a";
    resetAgentKeysCache();
    authToken = await sessionStore.generateToken();
  });

  afterEach(() => {
    sessionStore.clearRevoked();

    if (previousAuthSecret === undefined) {
      delete process.env.AUTH_SECRET;
    } else {
      process.env.AUTH_SECRET = previousAuthSecret;
    }

    if (previousAgentKeys === undefined) {
      delete process.env.OPENCLAW_AGENT_KEYS;
    } else {
      process.env.OPENCLAW_AGENT_KEYS = previousAgentKeys;
    }

    resetAgentKeysCache();
  });

  it("allows public auth routes", async () => {
    const request = new NextRequest(new URL("http://localhost/api/auth/login"));
    const response = await middleware(request);

    expect(response.status).toBe(200);
  });

  it("blocks non-whitelisted auth-like routes", async () => {
    const request = new NextRequest(new URL("http://localhost/api/auth/internal"));
    const response = await middleware(request);

    expect(response.status).toBe(401);
  });

  it("blocks protected API routes without session", async () => {
    const request = new NextRequest(new URL("http://localhost/api/git"));
    const response = await middleware(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("allows protected API routes with valid session", async () => {
    const request = new NextRequest(new URL("http://localhost/api/git"), {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    const response = await middleware(request);
    expect(response.status).toBe(200);
  });

  it("blocks agent routes when agent credentials are missing", async () => {
    const request = new NextRequest(new URL("http://localhost/api/heartbeat/tasks"));
    const response = await middleware(request);

    expect(response.status).toBe(401);
  });

  it("allows agent routes with valid agent credentials", async () => {
    const request = new NextRequest(new URL("http://localhost/api/heartbeat/tasks"), {
      headers: {
        "X-Agent-Id": "agent-a",
        "X-Agent-Key": "key-agent-a",
      },
    });

    const response = await middleware(request);
    expect(response.status).toBe(200);
  });

  it("does not allow session-only access to heartbeat agent route", async () => {
    const request = new NextRequest(new URL("http://localhost/api/heartbeat/tasks"), {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    const response = await middleware(request);
    expect(response.status).toBe(401);
  });

  it("allows session access to kanban agent routes", async () => {
    const request = new NextRequest(new URL("http://localhost/api/kanban/agent/tasks"), {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    const response = await middleware(request);
    expect(response.status).toBe(200);
  });
});

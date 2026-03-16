import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { proxy } from "@/proxy";

function createRequest(path: string, authCookie?: string): NextRequest {
  const headers = new Headers();
  if (authCookie) {
    headers.set("cookie", `mc_auth=${authCookie}`);
  }

  return new NextRequest(new URL(path, "http://localhost"), { headers });
}

describe("proxy auth boundary", () => {
  it("rejects unauthenticated telemetry API requests", async () => {
    const request = createRequest("/api/telemetry/dashboard");
    const response = proxy(request);

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe("Unauthorized");
  });

  it("allows authenticated telemetry API requests", () => {
    const request = createRequest("/api/telemetry/dashboard", "mc_authenticated_session_token_2026");
    const response = proxy(request);

    expect(response.status).toBe(200);
  });

  it("rejects unauthenticated chat send API requests", async () => {
    const request = createRequest("/api/chat/agents/developer/send");
    const response = proxy(request);

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.message).toBe("Authentication required");
  });

  it("allows authenticated chat send API requests", () => {
    const request = createRequest("/api/chat/agents/developer/send", "mc_authenticated_session_token_2026");
    const response = proxy(request);

    expect(response.status).toBe(200);
  });
});

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { GET } from "./route";
import { sessionStore } from "@/lib/session-store";

const previousAuthSecret = process.env.AUTH_SECRET;

describe("/api/heartbeat GET auth", () => {
  let authToken = "";

  beforeEach(async () => {
    process.env.AUTH_SECRET = "test-secret-123456789012345678901234567890";
    authToken = await sessionStore.generateToken();
  });

  afterEach(() => {
    sessionStore.clearRevoked();

    if (previousAuthSecret === undefined) {
      delete process.env.AUTH_SECRET;
    } else {
      process.env.AUTH_SECRET = previousAuthSecret;
    }
  });

  it("returns 401 when session is missing", async () => {
    const request = new NextRequest(new URL("http://localhost/api/heartbeat"));
    const response = await GET(request);
    expect(response).toBeDefined();

    expect(response!.status).toBe(401);
  });

  it("does not expose filesystem paths in response", async () => {
    const request = new NextRequest(new URL("http://localhost/api/heartbeat"), {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    const response = await GET(request);
    expect(response).toBeDefined();
    const data = await response!.json();

    expect(response!.status).toBe(200);
    expect(data.heartbeatMdPath).toBeUndefined();
  });
});

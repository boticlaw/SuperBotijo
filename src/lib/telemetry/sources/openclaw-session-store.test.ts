import { describe, expect, it } from "vitest";

import {
  getOpenClawSessionStoreTelemetry,
  normalizeStoreSessions,
  aggregateSessionsByAgent,
  getAgentIdFromSessionKey,
  isExcludedSessionKey,
} from "./openclaw-session-store";

describe("getAgentIdFromSessionKey", () => {
  it("extracts agent id from valid session key", () => {
    expect(getAgentIdFromSessionKey("agent:main:cron:heartbeat")).toBe("main");
    expect(getAgentIdFromSessionKey("agent:memo:subagent:writer")).toBe("memo");
  });

  it("returns null for invalid session keys", () => {
    expect(getAgentIdFromSessionKey("invalid")).toBeNull();
    expect(getAgentIdFromSessionKey("")).toBeNull();
    expect(getAgentIdFromSessionKey("agent:")).toBeNull();
  });
});

describe("isExcludedSessionKey", () => {
  it("returns true for excluded keys", () => {
    expect(isExcludedSessionKey("agent:main:main")).toBe(true);
  });

  it("returns false for non-excluded keys", () => {
    expect(isExcludedSessionKey("agent:main:cron:heartbeat")).toBe(false);
    expect(isExcludedSessionKey("agent:memo:subagent:writer")).toBe(false);
  });
});

describe("normalizeStoreSessions", () => {
  it("filters out malformed session records", () => {
    const now = Date.now();
    const sessions = [
      { key: "agent:main:cron:heartbeat", updatedAt: now, ageMs: 1000 },
      { key: "invalid-key" },
      { updatedAt: now },
      {},
    ] as unknown as Parameters<typeof normalizeStoreSessions>[0];

    const result = normalizeStoreSessions(sessions);

    expect(result).toHaveLength(1);
    expect(result[0].key).toBe("agent:main:cron:heartbeat");
  });

  it("excludes agent:main:main from normalized sessions", () => {
    const now = Date.now();
    const sessions = [
      { key: "agent:main:main", updatedAt: now, ageMs: 1000 },
      { key: "agent:main:cron:heartbeat", updatedAt: now, ageMs: 1000 },
    ] as unknown as Parameters<typeof normalizeStoreSessions>[0];

    const result = normalizeStoreSessions(sessions);

    expect(result).toHaveLength(1);
    expect(result[0].key).toBe("agent:main:cron:heartbeat");
  });

  it("derives ageMs from updatedAt when missing", () => {
    const sessions = [
      { key: "agent:main:cron:heartbeat", updatedAt: Date.now() - 60_000 },
    ] as unknown as Parameters<typeof normalizeStoreSessions>[0];

    const result = normalizeStoreSessions(sessions);

    expect(result).toHaveLength(1);
    expect(result[0].ageMs).toBeGreaterThanOrEqual(60_000);
  });
});

describe("aggregateSessionsByAgent", () => {
  it("aggregates freshness and latest activity across multiple agents", () => {
    const now = Date.now();
    const normalizedSessions = [
      { key: "agent:main:cron:heartbeat", updatedAt: now - 5000, ageMs: 5000 },
      { key: "agent:main:subagent:writer", updatedAt: now - 30_000, ageMs: 30_000 },
      { key: "agent:memo:subagent:writer", updatedAt: now - 180_000, ageMs: 180_000 },
    ];

    const result = aggregateSessionsByAgent(normalizedSessions);

    expect(result).toHaveLength(2);
    const main = result.find((entry) => entry.id === "main");
    const memo = result.find((entry) => entry.id === "memo");

    expect(main?.freshSessions).toBe(2);
    expect(memo?.freshSessions).toBe(0);
    expect(main?.latestActivity).toBeDefined();
  });

  it("aggregates fresh sessions correctly", () => {
    const now = Date.now();
    const normalizedSessions = [
      { key: "agent:main:cron:heartbeat", updatedAt: now - 5000, ageMs: 5000 },
      { key: "agent:main:subagent:writer", updatedAt: now - 130_000, ageMs: 130_000 },
    ];

    const result = aggregateSessionsByAgent(normalizedSessions);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("main");
    expect(result[0].freshSessions).toBe(1);
  });

  it("returns empty array for invalid session keys", () => {
    const normalizedSessions = [
      { key: "invalid-key", updatedAt: Date.now(), ageMs: 1000 },
    ];

    const result = aggregateSessionsByAgent(normalizedSessions);

    expect(result).toHaveLength(0);
  });
});

describe("getOpenClawSessionStoreTelemetry", () => {
  it("returns empty when agents directory does not exist", async () => {
    const result = getOpenClawSessionStoreTelemetry();

    expect(result.sessions).toHaveLength(0);
    expect(result.degraded).toHaveLength(0);
  });
});

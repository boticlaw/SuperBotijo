import { describe, expect, it } from "vitest";

import {
  getOpenClawSessionsTelemetry,
  parseOpenClawSessionsOutput,
} from "@/lib/telemetry/sources/openclaw-sessions";
import { TELEMETRY_DEGRADATION_CODE } from "@/lib/telemetry/types";

describe("parseOpenClawSessionsOutput", () => {
  it("aggregates freshness and latest activity by agent", () => {
    const now = Date.now();
    const rawOutput = JSON.stringify({
      sessions: [
        {
          key: "agent:main:main",
          updatedAt: now,
          ageMs: 1000,
        },
        {
          key: "agent:main:cron:heartbeat",
          updatedAt: now - 5000,
          ageMs: 5000,
        },
        {
          key: "agent:memo:subagent:writer",
          updatedAt: now - 60_000,
          ageMs: 60_000,
        },
      ],
    });

    const sessions = parseOpenClawSessionsOutput(rawOutput);

    expect(sessions).toHaveLength(2);
    const main = sessions.find((entry) => entry.id === "main");
    const memo = sessions.find((entry) => entry.id === "memo");

    expect(main?.freshSessions).toBe(2);
    expect(main?.latestActivity).toBeDefined();
    expect(memo?.freshSessions).toBe(1);
  });
});

describe("getOpenClawSessionsTelemetry", () => {
  it("requests sessions across all agents", () => {
    let capturedCommand = "";
    const result = getOpenClawSessionsTelemetry((command) => {
      capturedCommand = command;
      return JSON.stringify({ sessions: [] });
    });

    expect(result.degraded).toHaveLength(0);
    expect(capturedCommand).toContain("--all-agents");
  });

  it("returns timeout degradation when source command times out", () => {
    const result = getOpenClawSessionsTelemetry(() => {
      throw new Error("Command timed out after 10000ms");
    });

    expect(result.sessions).toHaveLength(0);
    expect(result.degraded).toHaveLength(1);
    expect(result.degraded[0].code).toBe(TELEMETRY_DEGRADATION_CODE.TIMEOUT);
    expect(result.degraded[0].retriable).toBe(true);
  });
});

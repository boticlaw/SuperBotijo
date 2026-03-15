import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getOpenClawSessionsTelemetry,
  parseOpenClawSessionsOutput,
} from "@/lib/telemetry/sources/openclaw-sessions";
import { TELEMETRY_DEGRADATION_CODE } from "@/lib/telemetry/types";

vi.mock("@/lib/paths", () => ({
  OPENCLAW_DIR: "/mock/openclaw",
}));

vi.mock("fs", () => ({
  default: {
    existsSync: vi.fn(() => false),
    readdirSync: vi.fn(() => []),
    readFileSync: vi.fn(() => "{}"),
  },
}));

import fs from "fs";

const mockFs = {
  existsSync: fs.existsSync as unknown as ReturnType<typeof vi.fn>,
  readdirSync: fs.readdirSync as unknown as ReturnType<typeof vi.fn>,
  readFileSync: fs.readFileSync as unknown as ReturnType<typeof vi.fn>,
};

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

    expect(main?.freshSessions).toBe(1);
    expect(main?.latestActivity).toBeDefined();
    expect(memo?.freshSessions).toBe(1);
  });
});

describe("getOpenClawSessionsTelemetry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses store-first approach when store has data", () => {
    const now = Date.now();

    mockFs.existsSync.mockReturnValue(true);
    mockFs.readdirSync.mockReturnValue([
      { isDirectory: () => true, name: "main" },
    ]);
    mockFs.existsSync.mockReturnValueOnce(true);
    mockFs.readFileSync.mockReturnValueOnce(
      JSON.stringify({
        sessions: [
          { key: "agent:main:cron:heartbeat", updatedAt: now - 5000, ageMs: 5000 },
        ],
      }),
    );

    let cliCalled = false;
    const result = getOpenClawSessionsTelemetry(() => {
      cliCalled = true;
      return JSON.stringify({ sessions: [] });
    });

    expect(result.sessions).toHaveLength(1);
    expect(result.sessions[0].freshSessions).toBe(1);
    expect(result.degraded).toHaveLength(0);
    expect(cliCalled).toBe(false);
  });

  it("falls back to CLI when store has degraded state", () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readdirSync.mockReturnValue([
      { isDirectory: () => true, name: "main" },
    ]);
    mockFs.existsSync.mockReturnValueOnce(true);
    mockFs.readFileSync.mockImplementationOnce(() => {
      throw new Error("Read error");
    });

    const now = Date.now();
    const result = getOpenClawSessionsTelemetry(() => {
      return JSON.stringify({
        sessions: [
          { key: "agent:main:cron:heartbeat", updatedAt: now - 5000, ageMs: 5000 },
        ],
      });
    });

    expect(result.sessions).toHaveLength(1);
    expect(result.degraded.some((d) => d.code === TELEMETRY_DEGRADATION_CODE.SOURCE_UNAVAILABLE)).toBe(true);
  });

  it("returns timeout degradation when CLI times out", () => {
    mockFs.existsSync.mockReturnValue(false);

    const result = getOpenClawSessionsTelemetry(() => {
      throw new Error("Command timed out after 10000ms");
    });

    expect(result.sessions).toHaveLength(0);
    expect(result.degraded.some((d) => d.code === TELEMETRY_DEGRADATION_CODE.TIMEOUT)).toBe(true);
  });
});
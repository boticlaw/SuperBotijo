import { describe, expect, it } from "vitest";

import { getDashboardTelemetrySnapshot } from "@/lib/telemetry/dashboard-snapshot";
import {
  TELEMETRY_DEGRADATION_CODE,
  TELEMETRY_DEGRADATION_SECTION,
  TELEMETRY_FRESHNESS_STATUS,
} from "@/lib/telemetry/types";

describe("getDashboardTelemetrySnapshot", () => {
  it("deduplicates agents and merges source degradation details", () => {
    const now = new Date("2026-03-14T02:00:00.000Z");

    const snapshot = getDashboardTelemetrySnapshot({
      now: () => now,
      stalenessThresholdSec: 30,
      getAgentsConfigTelemetry: () => ({
        agents: [
          {
            id: "main",
            name: "Main",
            emoji: "🤖",
            color: "#111111",
            model: "anthropic/claude-sonnet-4",
          },
          {
            id: "main",
            name: "Main Duplicate",
            emoji: "🤖",
            color: "#111111",
            model: "anthropic/claude-sonnet-4",
          },
        ],
        degraded: [],
      }),
      getActivitiesTelemetrySummary: () => ({
        summary: {
          totalActivities: 100,
          todayActivities: 10,
          successfulActivities: 9,
          failedActivities: 1,
        },
        degraded: [
          {
            section: TELEMETRY_DEGRADATION_SECTION.ACTIVITY,
            code: TELEMETRY_DEGRADATION_CODE.SOURCE_UNAVAILABLE,
            retriable: true,
            message: "Activity source unavailable",
          },
        ],
      }),
      getOpenClawSessionsTelemetry: () => ({
        sessions: [
          {
            id: "main",
            freshSessions: 2,
            latestActivity: "2026-03-14T01:59:55.000Z",
          },
        ],
        degraded: [],
      }),
    });

    expect(snapshot.agents).toHaveLength(1);
    expect(snapshot.agents[0].id).toBe("main");
    expect(snapshot.agents[0].status).toBe("working");
    expect(snapshot.degraded).toHaveLength(1);
    expect(snapshot.summary.totalActivities).toBe(100);
    expect(snapshot.freshness.status).toBe(TELEMETRY_FRESHNESS_STATUS.FRESH);
  });

  it("classifies stale snapshots when threshold is exceeded", () => {
    const snapshotAt = new Date("2026-03-14T02:00:00.000Z");
    const now = new Date("2026-03-14T02:01:10.000Z");
    let tick = 0;

    const snapshot = getDashboardTelemetrySnapshot({
      now: () => {
        tick += 1;
        return tick === 1 ? snapshotAt : now;
      },
      stalenessThresholdSec: 30,
      getAgentsConfigTelemetry: () => ({
        agents: [],
        degraded: [],
      }),
      getActivitiesTelemetrySummary: () => ({
        summary: {
          totalActivities: 0,
          todayActivities: 0,
          successfulActivities: 0,
          failedActivities: 0,
        },
        degraded: [],
      }),
      getOpenClawSessionsTelemetry: () => ({
        sessions: [],
        degraded: [],
      }),
    });

    expect(snapshot.freshness.status).toBe(TELEMETRY_FRESHNESS_STATUS.STALE);
    expect(snapshot.freshness.snapshotAgeSec).toBeGreaterThan(30);
  });

  it("excludes unknown session identities and emits validation degradation", () => {
    const snapshot = getDashboardTelemetrySnapshot({
      now: () => new Date("2026-03-14T02:00:00.000Z"),
      getAgentsConfigTelemetry: () => ({
        agents: [
          {
            id: "main",
            name: "Main",
            emoji: "🤖",
            color: "#111111",
            model: "anthropic/claude-sonnet-4",
          },
        ],
        degraded: [],
      }),
      getActivitiesTelemetrySummary: () => ({
        summary: {
          totalActivities: 0,
          todayActivities: 0,
          successfulActivities: 0,
          failedActivities: 0,
        },
        degraded: [],
      }),
      getOpenClawSessionsTelemetry: () => ({
        sessions: [
          {
            id: "unknown-agent",
            freshSessions: 1,
            latestActivity: "2026-03-14T01:59:00.000Z",
          },
        ],
        degraded: [],
      }),
    });

    expect(snapshot.agents).toHaveLength(1);
    expect(snapshot.agents[0].id).toBe("main");
    expect(snapshot.agents[0].activeSessions).toBe(0);

    const validationIssue = snapshot.degraded.find(
      (entry) =>
        entry.section === TELEMETRY_DEGRADATION_SECTION.AGENTS &&
        entry.code === TELEMETRY_DEGRADATION_CODE.VALIDATION_ERROR,
    );

    expect(validationIssue).toBeDefined();
    expect(validationIssue?.message).toContain("unknown-agent");
  });
});

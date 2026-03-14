import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getAgentStatusListMock = vi.fn();
const getDashboardTelemetrySnapshotMock = vi.fn();

vi.mock("@/operations", () => ({
  getAgentStatusList: () => getAgentStatusListMock(),
}));

vi.mock("@/lib/telemetry/dashboard-snapshot", () => ({
  getDashboardTelemetrySnapshot: () => getDashboardTelemetrySnapshotMock(),
}));

async function callGet() {
  const route = await import("./route");
  return route.GET();
}

describe("/api/agents/status compatibility", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_DASHBOARD_REAL_TELEMETRY", "false");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses legacy status operation when telemetry flag is disabled", async () => {
    getAgentStatusListMock.mockResolvedValue({
      success: true,
      data: [
        {
          id: "legacy",
          name: "Legacy",
          status: "online",
          activeSessions: 1,
        },
      ],
    });

    const response = await callGet();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.agents).toHaveLength(1);
    expect(getAgentStatusListMock).toHaveBeenCalledTimes(1);
    expect(getDashboardTelemetrySnapshotMock).not.toHaveBeenCalled();
  });

  it("proxies from telemetry snapshot when flag is enabled", async () => {
    vi.stubEnv("NEXT_PUBLIC_DASHBOARD_REAL_TELEMETRY", "true");
    getDashboardTelemetrySnapshotMock.mockReturnValue({
      freshness: {
        snapshotAt: "2026-03-14T02:00:00.000Z",
        snapshotAgeSec: 1,
        stalenessThresholdSec: 30,
        status: "fresh",
      },
      summary: {
        totalActivities: 1,
        todayActivities: 1,
        successfulActivities: 1,
        failedActivities: 0,
      },
      agents: [
        {
          id: "main",
          name: "Main",
          emoji: "🤖",
          color: "#111111",
          model: "anthropic/claude-sonnet-4",
          status: "working",
          activeSessions: 2,
          lastActivity: "2026-03-14T01:59:59.000Z",
        },
      ],
      degraded: [],
    });

    const response = await callGet();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.agents[0]).toMatchObject({
      id: "main",
      status: "working",
      activeSessions: 2,
    });
    expect(getDashboardTelemetrySnapshotMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to legacy operation if telemetry proxy fails", async () => {
    vi.stubEnv("NEXT_PUBLIC_DASHBOARD_REAL_TELEMETRY", "true");
    getDashboardTelemetrySnapshotMock.mockImplementation(() => {
      throw new Error("snapshot failed");
    });
    getAgentStatusListMock.mockResolvedValue({
      success: true,
      data: [
        {
          id: "fallback",
          name: "Fallback",
          status: "idle",
          activeSessions: 0,
        },
      ],
    });

    const response = await callGet();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.agents[0].id).toBe("fallback");
    expect(getAgentStatusListMock).toHaveBeenCalledTimes(1);
  });
});

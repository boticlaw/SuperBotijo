import { beforeEach, describe, expect, it, vi } from "vitest";

import { TelemetrySourceError, TelemetryValidationError } from "@/lib/telemetry/errors";

const getDashboardTelemetrySnapshotMock = vi.fn();

vi.mock("@/lib/telemetry/dashboard-snapshot", () => ({
  getDashboardTelemetrySnapshot: () => getDashboardTelemetrySnapshotMock(),
}));

import { GET, resetTelemetryDashboardCacheForTest } from "./route";

describe("/api/telemetry/dashboard", () => {
  beforeEach(() => {
    getDashboardTelemetrySnapshotMock.mockReset();
    resetTelemetryDashboardCacheForTest();
  });

  it("returns normalized telemetry snapshot payload", async () => {
    getDashboardTelemetrySnapshotMock.mockReturnValue({
      freshness: {
        snapshotAt: "2026-03-14T02:00:00.000Z",
        snapshotAgeSec: 5,
        stalenessThresholdSec: 30,
        status: "fresh",
      },
      summary: {
        totalActivities: 10,
        todayActivities: 2,
        successfulActivities: 2,
        failedActivities: 0,
      },
      agents: [],
      degraded: [
        {
          section: "sessions",
          code: "source_unavailable",
          retriable: true,
          message: "Source unavailable",
        },
      ],
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.freshness.status).toBe("fresh");
    expect(data.degraded).toHaveLength(1);
  });

  it("returns non-retriable validation_failed error", async () => {
    getDashboardTelemetrySnapshotMock.mockImplementation(() => {
      throw new TelemetryValidationError("Telemetry shape is invalid");
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error.code).toBe("validation_failed");
    expect(data.error.retriable).toBe(false);
  });

  it("returns retriable telemetry_unavailable for source errors", async () => {
    getDashboardTelemetrySnapshotMock.mockImplementation(() => {
      throw new TelemetrySourceError("Sessions source unavailable", true);
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error.code).toBe("telemetry_unavailable");
    expect(data.error.retriable).toBe(true);
  });

  it("classifies unknown errors as retriable telemetry_unavailable", async () => {
    getDashboardTelemetrySnapshotMock.mockImplementation(() => {
      throw new Error("Unexpected failure");
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error.code).toBe("telemetry_unavailable");
    expect(data.error.retriable).toBe(true);
  });

  it("reuses cached snapshot inside ttl window", async () => {
    getDashboardTelemetrySnapshotMock.mockReturnValue({
      freshness: {
        snapshotAt: "2026-03-14T02:00:00.000Z",
        snapshotAgeSec: 1,
        stalenessThresholdSec: 30,
        status: "fresh",
      },
      summary: {
        totalActivities: 5,
        todayActivities: 1,
        successfulActivities: 1,
        failedActivities: 0,
      },
      agents: [],
      degraded: [],
    });

    const firstResponse = await GET();
    const secondResponse = await GET();
    const firstData = await firstResponse.json();
    const secondData = await secondResponse.json();

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);
    expect(firstData.summary.totalActivities).toBe(5);
    expect(secondData.summary.totalActivities).toBe(5);
    expect(getDashboardTelemetrySnapshotMock).toHaveBeenCalledTimes(1);
  });

  it("serves stale cached snapshot when refresh fails", async () => {
    vi.useFakeTimers();

    try {
      vi.setSystemTime(new Date("2026-03-14T02:00:00.000Z"));
      getDashboardTelemetrySnapshotMock
        .mockReturnValueOnce({
          freshness: {
            snapshotAt: "2026-03-14T02:00:00.000Z",
            snapshotAgeSec: 0,
            stalenessThresholdSec: 30,
            status: "fresh",
          },
          summary: {
            totalActivities: 9,
            todayActivities: 2,
            successfulActivities: 2,
            failedActivities: 0,
          },
          agents: [],
          degraded: [],
        })
        .mockImplementationOnce(() => {
          throw new Error("Telemetry source failed during refresh");
        });

      await GET();

      vi.setSystemTime(new Date("2026-03-14T02:00:20.000Z"));
      const fallbackResponse = await GET();
      const fallbackData = await fallbackResponse.json();

      expect(fallbackResponse.status).toBe(200);
      expect(fallbackData.freshness.status).toBe("stale");
      expect(fallbackData.summary.totalActivities).toBe(9);
      expect(fallbackData.degraded).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            section: "summary",
            code: "source_unavailable",
            retriable: true,
            message: "Telemetry source failed during refresh",
          }),
        ]),
      );
      expect(getDashboardTelemetrySnapshotMock).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});

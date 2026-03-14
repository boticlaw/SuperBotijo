import { beforeEach, describe, expect, it, vi } from "vitest";

import { TelemetrySourceError, TelemetryValidationError } from "@/lib/telemetry/errors";

const getDashboardTelemetrySnapshotMock = vi.fn();

vi.mock("@/lib/telemetry/dashboard-snapshot", () => ({
  getDashboardTelemetrySnapshot: () => getDashboardTelemetrySnapshotMock(),
}));

import { GET } from "./route";

describe("/api/telemetry/dashboard", () => {
  beforeEach(() => {
    getDashboardTelemetrySnapshotMock.mockReset();
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
});

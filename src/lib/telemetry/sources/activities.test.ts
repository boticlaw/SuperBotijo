import { describe, expect, it } from "vitest";

import {
  buildActivitySummaryTelemetry,
} from "@/lib/telemetry/sources/activities";

describe("buildActivitySummaryTelemetry", () => {
  it("maps status groups into summary metrics", () => {
    const summary = buildActivitySummaryTelemetry({
      total: 120,
      today: 12,
      byType: {},
      byStatus: {
        success: 9,
        approved: 3,
        error: 2,
        rejected: 1,
      },
      heatmap: [],
      trend: [],
    });

    expect(summary.totalActivities).toBe(120);
    expect(summary.todayActivities).toBe(12);
    expect(summary.successfulActivities).toBe(12);
    expect(summary.failedActivities).toBe(3);
  });

  it("defaults missing statuses to zero", () => {
    const summary = buildActivitySummaryTelemetry({
      total: 10,
      today: 1,
      byType: {},
      byStatus: {},
      heatmap: [],
      trend: [],
    });

    expect(summary.successfulActivities).toBe(0);
    expect(summary.failedActivities).toBe(0);
  });
});

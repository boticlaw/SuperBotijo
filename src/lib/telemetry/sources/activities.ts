import {
  getActivityStats,
  type ActivityStats,
} from "@/lib/activities-db";
import {
  TELEMETRY_DEGRADATION_CODE,
  TELEMETRY_DEGRADATION_SECTION,
  type ActivitySummaryTelemetry,
  type TelemetryDegradation,
} from "@/lib/telemetry/types";

const SUCCESS_STATUSES = {
  SUCCESS: "success",
  APPROVED: "approved",
} as const;

const FAILURE_STATUSES = {
  ERROR: "error",
  REJECTED: "rejected",
} as const;

export interface ActivitiesSourceResult {
  summary: ActivitySummaryTelemetry;
  degraded: TelemetryDegradation[];
}

export function buildActivitySummaryTelemetry(stats: ActivityStats): ActivitySummaryTelemetry {
  const successfulActivities =
    (stats.byStatus[SUCCESS_STATUSES.SUCCESS] ?? 0) +
    (stats.byStatus[SUCCESS_STATUSES.APPROVED] ?? 0);

  const failedActivities =
    (stats.byStatus[FAILURE_STATUSES.ERROR] ?? 0) +
    (stats.byStatus[FAILURE_STATUSES.REJECTED] ?? 0);

  return {
    totalActivities: stats.total,
    todayActivities: stats.today,
    successfulActivities,
    failedActivities,
  };
}

export function getActivitiesTelemetrySummary(): ActivitiesSourceResult {
  try {
    const stats = getActivityStats();
    return {
      summary: buildActivitySummaryTelemetry(stats),
      degraded: [],
    };
  } catch (error) {
    return {
      summary: {
        totalActivities: 0,
        todayActivities: 0,
        successfulActivities: 0,
        failedActivities: 0,
      },
      degraded: [
        {
          section: TELEMETRY_DEGRADATION_SECTION.ACTIVITY,
          code: TELEMETRY_DEGRADATION_CODE.SOURCE_UNAVAILABLE,
          retriable: true,
          message: error instanceof Error ? error.message : "Failed to read activities source",
        },
      ],
    };
  }
}

import { NextResponse } from "next/server";

import { getDashboardTelemetrySnapshot } from "@/lib/telemetry/dashboard-snapshot";
import {
  TELEMETRY_ERROR_KIND,
  TelemetryError,
} from "@/lib/telemetry/errors";
import {
  TELEMETRY_DEGRADATION_CODE,
  TELEMETRY_DEGRADATION_SECTION,
  TELEMETRY_FRESHNESS_STATUS,
  type DashboardTelemetryResponse,
} from "@/lib/telemetry/types";

export const dynamic = "force-dynamic";

const API_ERROR_CODE = {
  TELEMETRY_UNAVAILABLE: "telemetry_unavailable",
  VALIDATION_FAILED: "validation_failed",
} as const;

const SNAPSHOT_CACHE_TTL_MS = Number(process.env.DASHBOARD_TELEMETRY_CACHE_MS ?? "15000");

interface TelemetrySnapshotCache {
  snapshot: DashboardTelemetryResponse | null;
  createdAtMs: number;
  inFlight: Promise<DashboardTelemetryResponse> | null;
}

const snapshotCache: TelemetrySnapshotCache = {
  snapshot: null,
  createdAtMs: 0,
  inFlight: null,
};

function isCacheFresh(nowMs: number): boolean {
  if (!snapshotCache.snapshot) {
    return false;
  }

  return nowMs - snapshotCache.createdAtMs < SNAPSHOT_CACHE_TTL_MS;
}

async function getCachedDashboardSnapshot(): Promise<DashboardTelemetryResponse> {
  const nowMs = Date.now();

  if (isCacheFresh(nowMs) && snapshotCache.snapshot) {
    return snapshotCache.snapshot;
  }

  if (snapshotCache.inFlight) {
    return snapshotCache.inFlight;
  }

  snapshotCache.inFlight = Promise.resolve().then(() => getDashboardTelemetrySnapshot());

  try {
    const snapshot = await snapshotCache.inFlight;
    snapshotCache.snapshot = snapshot;
    snapshotCache.createdAtMs = Date.now();
    return snapshot;
  } finally {
    snapshotCache.inFlight = null;
  }
}

export function resetTelemetryDashboardCacheForTest(): void {
  snapshotCache.snapshot = null;
  snapshotCache.createdAtMs = 0;
  snapshotCache.inFlight = null;
}

function createErrorResponse(error: unknown): NextResponse {
  if (error instanceof TelemetryError) {
    const code = error.kind === TELEMETRY_ERROR_KIND.VALIDATION
      ? API_ERROR_CODE.VALIDATION_FAILED
      : API_ERROR_CODE.TELEMETRY_UNAVAILABLE;

    return NextResponse.json(
      {
        error: {
          code,
          retriable: error.retriable,
          message: error.message,
        },
      },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      error: {
        code: API_ERROR_CODE.TELEMETRY_UNAVAILABLE,
        retriable: true,
        message: error instanceof Error ? error.message : "Failed to build telemetry dashboard snapshot",
      },
    },
    { status: 500 },
  );
}

function createSnapshotFallbackFromCache(error: unknown): DashboardTelemetryResponse | null {
  if (!snapshotCache.snapshot) {
    return null;
  }

  const cachedSnapshot = snapshotCache.snapshot;
  const cachedSnapshotAtMs = Date.parse(cachedSnapshot.freshness.snapshotAt);
  const fallbackSnapshotAgeSec = Number.isNaN(cachedSnapshotAtMs)
    ? cachedSnapshot.freshness.snapshotAgeSec
    : Math.max(0, Math.floor((Date.now() - cachedSnapshotAtMs) / 1000));
  const retriable = error instanceof TelemetryError ? error.retriable : true;
  const fallbackMessage = error instanceof Error
    ? error.message
    : "Failed to refresh telemetry snapshot, serving stale cache";

  return {
    ...cachedSnapshot,
    freshness: {
      ...cachedSnapshot.freshness,
      snapshotAgeSec: fallbackSnapshotAgeSec,
      status: TELEMETRY_FRESHNESS_STATUS.STALE,
    },
    degraded: [
      ...cachedSnapshot.degraded,
      {
        section: TELEMETRY_DEGRADATION_SECTION.SUMMARY,
        code: TELEMETRY_DEGRADATION_CODE.SOURCE_UNAVAILABLE,
        retriable,
        message: fallbackMessage,
      },
    ],
  };
}

export async function GET() {
  try {
    const snapshot = await getCachedDashboardSnapshot();

    if (snapshot.degraded.length > 0) {
      console.warn("[api/telemetry/dashboard] degraded snapshot served", {
        degradedCount: snapshot.degraded.length,
        snapshotStatus: snapshot.freshness.status,
      });
    }

    return NextResponse.json(snapshot);
  } catch (error) {
    const fallbackSnapshot = createSnapshotFallbackFromCache(error);
    if (fallbackSnapshot) {
      console.warn("[api/telemetry/dashboard] Serving stale snapshot fallback", {
        snapshotAgeSec: fallbackSnapshot.freshness.snapshotAgeSec,
        degradedCount: fallbackSnapshot.degraded.length,
      });
      return NextResponse.json(fallbackSnapshot);
    }

    console.error("[api/telemetry/dashboard] Error:", error);
    return createErrorResponse(error);
  }
}

import { NextResponse } from "next/server";

import { getDashboardTelemetrySnapshot } from "@/lib/telemetry/dashboard-snapshot";
import {
  TELEMETRY_ERROR_KIND,
  TelemetryError,
} from "@/lib/telemetry/errors";

export const dynamic = "force-dynamic";

const API_ERROR_CODE = {
  TELEMETRY_UNAVAILABLE: "telemetry_unavailable",
  VALIDATION_FAILED: "validation_failed",
} as const;

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

export async function GET() {
  try {
    const snapshot = getDashboardTelemetrySnapshot();

    if (snapshot.degraded.length > 0) {
      console.warn("[api/telemetry/dashboard] degraded snapshot served", {
        degradedCount: snapshot.degraded.length,
        snapshotStatus: snapshot.freshness.status,
      });
    }

    return NextResponse.json(snapshot);
  } catch (error) {
    console.error("[api/telemetry/dashboard] Error:", error);
    return createErrorResponse(error);
  }
}

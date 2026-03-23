/**
 * Efficiency Score API
 * GET /api/costs/efficiency
 * Returns efficiency score, components, and history
 */

import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import {
  calculateEfficiencyScore,
  getEfficiencyHistory,
} from "@/lib/efficiency-calculator";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const days = parseInt(searchParams.get("days") || "7", 10);

  try {
    const score = calculateEfficiencyScore(days);
    const history = getEfficiencyHistory(days);

    return NextResponse.json({
      ...score,
      history,
      period: `${days}d`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error calculating efficiency score:", error);
    return NextResponse.json(
      { error: "Failed to calculate efficiency score" },
      { status: 500 }
    );
  }
}

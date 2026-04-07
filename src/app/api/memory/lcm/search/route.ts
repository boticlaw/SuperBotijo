/**
 * LCM Search API
 * GET /api/memory/lcm/search?q=<query> - FTS5 search across messages and summaries
 */
import { NextRequest, NextResponse } from "next/server";

import { isLcmAvailable } from "@/lib/lcm-detect";
import { search } from "@/lib/lcm-store";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { available } = isLcmAvailable();

    if (!available) {
      return NextResponse.json(
        { error: "LCM is not available", lcmAvailable: false },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim() || "";

    if (!q) {
      return NextResponse.json(
        { error: "Query parameter 'q' is required" },
        { status: 400 }
      );
    }

    const results = search(q);

    return NextResponse.json({ results });
  } catch (error) {
    console.error("[memory/lcm/search] Error searching:", error);
    return NextResponse.json(
      { error: "Search failed" },
      { status: 500 }
    );
  }
}

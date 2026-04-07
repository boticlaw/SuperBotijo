/**
 * LCM Summaries API
 * GET /api/memory/lcm/summaries?conversationId=<id> - Summary DAG for a conversation
 */
import { NextRequest, NextResponse } from "next/server";

import { isLcmAvailable } from "@/lib/lcm-detect";
import { getSummaries } from "@/lib/lcm-store";

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
    const conversationId = searchParams.get("conversationId");

    if (!conversationId) {
      return NextResponse.json(
        { error: "Query parameter 'conversationId' is required" },
        { status: 400 }
      );
    }

    const summaries = getSummaries(conversationId);

    return NextResponse.json({ summaries });
  } catch (error) {
    console.error("[memory/lcm/summaries] Error fetching summaries:", error);
    return NextResponse.json(
      { error: "Failed to fetch summaries" },
      { status: 500 }
    );
  }
}

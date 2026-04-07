/**
 * LCM Conversation Messages API
 * GET /api/memory/lcm/conversations/[id] - Paginated messages for a conversation
 */
import { NextRequest, NextResponse } from "next/server";

import { isLcmAvailable } from "@/lib/lcm-detect";
import { getMessages } from "@/lib/lcm-store";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { available } = isLcmAvailable();

    if (!available) {
      return NextResponse.json(
        { error: "LCM is not available", lcmAvailable: false },
        { status: 404 }
      );
    }

    const { id } = await params;

    const { searchParams } = new URL(request.url);
    const offset = Math.max(0, parseInt(searchParams.get("offset") || "0", 10) || 0);
    const rawLimit = parseInt(searchParams.get("limit") || "50", 10) || 50;
    // Clamp limit to [1, 200]
    const limit = Math.max(1, Math.min(200, rawLimit));

    const result = getMessages(id, offset, limit);

    if (result.total === 0) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("[memory/lcm/conversations] Error fetching messages:", error);
    return NextResponse.json(
      { error: "Failed to fetch conversation messages" },
      { status: 500 }
    );
  }
}

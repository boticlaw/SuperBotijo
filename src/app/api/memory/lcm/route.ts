/**
 * LCM (Lossless-Claw Memory) Detection & Conversations API
 * GET /api/memory/lcm - Check LCM availability and list conversations
 */
import { NextResponse } from "next/server";

import { isLcmAvailable } from "@/lib/lcm-detect";
import { getConversations } from "@/lib/lcm-store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { available } = isLcmAvailable();

    if (!available) {
      return NextResponse.json(
        { error: "LCM is not available. Plugin not enabled or database not found.", lcmAvailable: false },
        { status: 404 }
      );
    }

    const conversations = getConversations();

    return NextResponse.json({ lcmAvailable: true, conversations });
  } catch (error) {
    console.error("[memory/lcm] Error listing conversations:", error);
    return NextResponse.json(
      { error: "Failed to list LCM conversations" },
      { status: 500 }
    );
  }
}

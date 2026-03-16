import { NextResponse } from "next/server";

import { checkGatewayStatus } from "@/lib/openclaw-gateway";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const status = await checkGatewayStatus();
    return NextResponse.json(status);
  } catch (error) {
    console.error("[/api/chat/gateway/health] Error", error);
    return NextResponse.json(
      {
        available: false,
        latencyMs: null,
        error: "Gateway status check failed",
      },
      { status: 500 },
    );
  }
}

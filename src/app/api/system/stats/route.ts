import { NextResponse } from "next/server";

import { cachedSystemStats } from "@/lib/system-stats";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const stats = await cachedSystemStats.get();
    return NextResponse.json(stats);
  } catch (error) {
    console.error("Error fetching system stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch system stats" },
      { status: 500 }
    );
  }
}

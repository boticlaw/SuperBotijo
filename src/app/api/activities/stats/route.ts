import { NextResponse } from "next/server";
import { getActivityStats } from "@/lib/activities-db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const stats = getActivityStats();
    return NextResponse.json(stats);
  } catch (error) {
    console.error("Failed to fetch activity stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch activity stats" },
      { status: 500 }
    );
  }
}

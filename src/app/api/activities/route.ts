import { NextResponse } from "next/server";
import { getActivities } from "@/lib/activities-db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "100", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);
    const type = searchParams.get("type") || undefined;
    const status = searchParams.get("status") || undefined;

    const result = getActivities({
      limit,
      offset,
      type,
      status,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to fetch activities:", error);
    return NextResponse.json({ activities: [], total: 0 }, { status: 500 });
  }
}

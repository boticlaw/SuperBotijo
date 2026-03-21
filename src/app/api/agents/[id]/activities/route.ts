/**
 * Single Agent Activities API
 * GET activities for a specific agent (last 50)
 */
import { NextResponse } from "next/server";

import { getActivities } from "@/lib/activities-db";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const activities = getActivities({ 
      agent: id, 
      limit: 50, 
      sort: "newest" 
    }).activities

    return NextResponse.json({ activities })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get activities" },
      { status: 500 }
    )
  }
}
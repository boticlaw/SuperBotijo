import { NextResponse } from "next/server";

import { listAvailableWorkspaces } from "@/lib/files-workspaces";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const workspaces = await listAvailableWorkspaces();
    return NextResponse.json({ workspaces });
  } catch (error) {
    console.error("Failed to list workspaces:", error);
    return NextResponse.json({ workspaces: [] }, { status: 500 });
  }
}

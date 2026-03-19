import { NextResponse } from "next/server";
import path from "path";

const DB_PATH = path.join(process.cwd(), "data", "usage-tracking.db");

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const { collectUsageFromFilesAndSave } = await import("@/lib/usage-collector");
    const result = await collectUsageFromFilesAndSave(DB_PATH);
    
    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Error collecting usage from files:", error);
    return NextResponse.json(
      { error: "Failed to collect usage data" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: "Use POST to trigger collection" },
    { status: 405 }
  );
}

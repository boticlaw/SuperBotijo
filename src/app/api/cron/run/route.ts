import { NextRequest, NextResponse } from "next/server";
import { safeExecFile, isValidId } from "@/lib/safe-exec";

export const dynamic = "force-dynamic";

async function createNotification(title: string, message: string, type: "info" | "success" | "warning" | "error" = "info") {
  try {
    await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/notifications`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, message, type }),
    });
  } catch (error) {
    console.error("Failed to create notification:", error);
  }
}

// POST: Trigger a cron job immediately
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: "Job ID required" }, { status: 400 });
    }

    if (!isValidId(id)) {
      return NextResponse.json({ error: "Invalid job ID" }, { status: 400 });
    }

    const result = safeExecFile("openclaw", ["cron", "run", id, "--force"], {
      timeout: 15000,
    });

    // Create success notification
    await createNotification(
      "Cron Job Triggered",
      `Job "${id}" has been manually executed.`,
      "success"
    );

    return NextResponse.json({
      success: true,
      jobId: id,
      message: result.stdout.trim() || "Job triggered successfully",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to trigger job";
    console.error("Error triggering cron job:", error);
    
    // Create error notification
    const body = await request.json();
    await createNotification(
      "Cron Job Failed",
      `Failed to execute job "${body.id}": ${message}`,
      "error"
    );
    
    // Even if the command exits with non-zero, the job might have been triggered
    // The openclaw CLI sometimes exits with error but still works
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

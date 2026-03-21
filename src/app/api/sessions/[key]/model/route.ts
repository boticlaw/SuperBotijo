import { NextResponse } from "next/server";
import { safeExecFile, isValidId } from "@/lib/safe-exec";

export const dynamic = "force-dynamic";

interface ModelUpdateResponse {
  success: boolean;
  model?: string;
  error?: string;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ key: string }> }
): Promise<NextResponse<ModelUpdateResponse>> {
  try {
    const { key } = await params;
    const body = await request.json();
    const { model } = body;

    if (!model) {
      return NextResponse.json(
        { success: false, error: "Model is required" },
        { status: 400 }
      );
    }

    const decodedKey = decodeURIComponent(key);

    if (!isValidId(decodedKey)) {
      return NextResponse.json(
        { success: false, error: "Invalid session key" },
        { status: 400 }
      );
    }

    if (!isValidId(model)) {
      return NextResponse.json(
        { success: false, error: "Invalid model identifier" },
        { status: 400 }
      );
    }

    const result = safeExecFile("openclaw", ["session", "set-model", decodedKey, model], {
      timeout: 10000,
    });

    if (result.status !== 0) {
      return NextResponse.json(
        { success: false, error: "Model change not supported - command not available" },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, model });
  } catch (error) {
    console.error("[session/model] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update model" },
      { status: 500 }
    );
  }
}

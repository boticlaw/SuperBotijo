import { NextResponse } from "next/server";
import { execSync } from "child_process";

export const dynamic = "force-dynamic";

const SAFE_SESSION_KEY_PATTERN = /^[a-zA-Z0-9_\-./]+$/;

function isValidSessionKey(key: string): boolean {
  if (!key || key.length === 0 || key.length > 255) {
    return false;
  }
  if (key.includes("..") || key.includes("\0")) {
    return false;
  }
  return SAFE_SESSION_KEY_PATTERN.test(key);
}

function escapeShellArg(arg: string): string {
  return arg.replace(/[^a-zA-Z0-9_\-./]/g, "");
}

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

    if (!isValidSessionKey(decodedKey)) {
      return NextResponse.json(
        { success: false, error: "Invalid session key" },
        { status: 400 }
      );
    }

    const safeKey = escapeShellArg(decodedKey);
    const safeModel = escapeShellArg(model);

    try {
      execSync(`openclaw session set-model "${safeKey}" "${safeModel}"`, {
        encoding: "utf-8",
        timeout: 10000,
      });

      return NextResponse.json({ success: true, model });
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "Model change not supported - command not available",
        },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("[session/model] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update model" },
      { status: 500 }
    );
  }
}

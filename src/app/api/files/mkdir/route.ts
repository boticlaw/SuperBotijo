import { promises as fs } from "fs";
import path from "path";

import { NextRequest, NextResponse } from "next/server";

import { resolveWorkspacePath } from "@/lib/files-workspaces";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { workspace, path: dirPath, name } = body;

    if (!dirPath && !name) {
      return NextResponse.json({ error: "Missing path or name" }, { status: 400 });
    }

    const rawPath = name
      ? path.join(dirPath || "", name)
      : (dirPath || "");

    const resolvedPath = await resolveWorkspacePath(workspace, rawPath);
    if (!resolvedPath) {
      return NextResponse.json({ error: "Invalid workspace or path" }, { status: 400 });
    }

    await fs.mkdir(resolvedPath.fullPath, { recursive: true });

    return NextResponse.json({ success: true, path: resolvedPath.relativePath });
  } catch (error) {
    console.error("[mkdir] Error:", error);
    return NextResponse.json({ error: "Failed to create directory" }, { status: 500 });
  }
}

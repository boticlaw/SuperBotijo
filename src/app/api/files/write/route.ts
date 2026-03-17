/**
 * Write file content endpoint
 * POST /api/files/write
 * Body: { workspace, path, content }
 */
import { promises as fs } from "fs";
import path from "path";

import { NextRequest, NextResponse } from "next/server";

import { logActivity } from "@/lib/activities-db";
import { resolveWorkspacePath } from "@/lib/files-workspaces";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { workspace, path: filePath, content } = body;

    if (!filePath || content === undefined) {
      return NextResponse.json({ error: "Missing path or content" }, { status: 400 });
    }

    const resolvedPath = await resolveWorkspacePath(workspace, filePath);
    if (!resolvedPath) {
      return NextResponse.json({ error: "Invalid workspace or path" }, { status: 400 });
    }

    await fs.mkdir(path.dirname(resolvedPath.fullPath), { recursive: true });
    await fs.writeFile(resolvedPath.fullPath, content, "utf-8");

    const stat = await fs.stat(resolvedPath.fullPath);

    logActivity("file_write", `Edited file: ${resolvedPath.relativePath}`, "success", {
      metadata: { workspace, filePath, size: stat.size },
    });

    return NextResponse.json({ success: true, path: resolvedPath.relativePath, size: stat.size });
  } catch (error) {
    console.error("[write] Error:", error);
    return NextResponse.json({ error: "Write failed" }, { status: 500 });
  }
}

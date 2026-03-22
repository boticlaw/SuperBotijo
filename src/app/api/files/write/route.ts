import { promises as fs } from "fs";
import path from "path";

import { NextRequest, NextResponse } from "next/server";

import { logActivity } from "@/lib/activities-db";
import { resolveWorkspacePath } from "@/lib/files-workspaces";
import { validateBody, FileWriteSchema } from "@/lib/api-validation";

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.json();
    const validation = validateBody(FileWriteSchema, rawBody);
    if (!validation.success) return validation.error;
    const { workspace, path: filePath, content } = validation.data;

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

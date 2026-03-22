import { promises as fs } from "fs";
import path from "path";

import { NextRequest, NextResponse } from "next/server";

import { logActivity } from "@/lib/activities-db";
import { resolveWorkspacePath } from "@/lib/files-workspaces";
import { validateBody, FileDeleteSchema } from "@/lib/api-validation";

const PROTECTED = [
  "MEMORY.md", "SOUL.md", "USER.md", "AGENTS.md", "TOOLS.md",
  "package.json", "tsconfig.json", ".env", ".env.local",
];

export async function DELETE(request: NextRequest) {
  try {
    const rawBody = await request.json();
    const validation = validateBody(FileDeleteSchema, rawBody);
    if (!validation.success) return validation.error;
    const { workspace, path: filePath } = validation.data;

    const resolvedPath = await resolveWorkspacePath(workspace, filePath);
    if (!resolvedPath) {
      return NextResponse.json({ error: "Invalid workspace or path" }, { status: 400 });
    }

    const filename = path.basename(resolvedPath.fullPath);
    if (PROTECTED.includes(filename)) {
      return NextResponse.json({ error: `Cannot delete protected file: ${filename}` }, { status: 403 });
    }

    const stat = await fs.stat(resolvedPath.fullPath);
    if (stat.isDirectory()) {
      await fs.rm(resolvedPath.fullPath, { recursive: true });
    } else {
      await fs.unlink(resolvedPath.fullPath);
    }

    logActivity("file_write", `Deleted ${stat.isDirectory() ? "folder" : "file"}: ${resolvedPath.relativePath}`, "success", {
      metadata: { workspace, filePath },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[delete] Error:", error);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}

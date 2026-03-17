import { promises as fs } from "fs";
import path from "path";

import { NextRequest, NextResponse } from "next/server";

import { logActivity } from "@/lib/activities-db";
import { resolveWorkspacePath } from "@/lib/files-workspaces";

function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const mimeMap: Record<string, string> = {
    ".ts": "text/plain",
    ".tsx": "text/plain",
    ".js": "text/javascript",
    ".jsx": "text/javascript",
    ".json": "application/json",
    ".md": "text/markdown",
    ".txt": "text/plain",
    ".log": "text/plain",
    ".py": "text/plain",
    ".sh": "text/plain",
    ".yaml": "text/yaml",
    ".yml": "text/yaml",
    ".toml": "text/plain",
    ".css": "text/css",
    ".html": "text/html",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
    ".pdf": "application/pdf",
    ".zip": "application/zip",
  };
  return mimeMap[ext] || "application/octet-stream";
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspace = searchParams.get("workspace") || "workspace";
    const filePath = searchParams.get("path") || "";

    if (!filePath) {
      return NextResponse.json({ error: "Missing path parameter" }, { status: 400 });
    }

    const resolvedPath = await resolveWorkspacePath(workspace, filePath);
    if (!resolvedPath) {
      return NextResponse.json({ error: "Invalid workspace or path" }, { status: 400 });
    }

    const stat = await fs.stat(resolvedPath.fullPath);
    if (!stat.isFile()) {
      return NextResponse.json({ error: "Not a file" }, { status: 400 });
    }

    const content = await fs.readFile(resolvedPath.fullPath);
    const filename = path.basename(resolvedPath.fullPath);
    const mimeType = getMimeType(filename);

    logActivity("file_read", `Downloaded file: ${resolvedPath.relativePath}`, "success", {
      metadata: { workspace, filePath, size: stat.size },
    });

    return new NextResponse(content, {
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": stat.size.toString(),
      },
    });
  } catch (error) {
    console.error("[download] Error:", error);
    return NextResponse.json({ error: "Download failed" }, { status: 500 });
  }
}

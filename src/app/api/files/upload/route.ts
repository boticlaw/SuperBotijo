import { promises as fs } from "fs";
import path from "path";

import { NextRequest, NextResponse } from "next/server";

import { logActivity } from "@/lib/activities-db";
import { resolveWorkspacePath } from "@/lib/files-workspaces";
import { validateFileExtension } from "@/lib/magic-bytes";

const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "pdf", "txt", "md"];

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const workspace = (formData.get("workspace") as string) || "workspace";
    const dirPath = (formData.get("path") as string) || "";
    const files = formData.getAll("files") as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    const resolvedDirectory = await resolveWorkspacePath(workspace, dirPath);
    if (!resolvedDirectory) {
      return NextResponse.json({ error: "Invalid workspace or path" }, { status: 400 });
    }

    const results: Array<{ name: string; size: number; path: string }> = [];

    for (const file of files) {
      const ext = validateFileExtension(file.name, ALLOWED_EXTENSIONS);
      if (!ext) {
        return NextResponse.json({ error: "Invalid file type" }, { status: 400 });
      }

      const buffer = Buffer.from(await file.arrayBuffer());

      if (buffer.length === 0) {
        return NextResponse.json({ error: "Empty files not allowed" }, { status: 400 });
      }

      const headerBytes = buffer.slice(0, 8);
      const { validateMagicBytes } = await import("@/lib/magic-bytes");
      if (!validateMagicBytes(headerBytes, ext)) {
        return NextResponse.json({ error: "File content does not match extension" }, { status: 400 });
      }

      const sanitizedName = path.basename(file.name);
      const targetPath = path.join(resolvedDirectory.fullPath, sanitizedName);

      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.writeFile(targetPath, buffer);

      results.push({
        name: sanitizedName,
        size: buffer.length,
        path: resolvedDirectory.relativePath ? `${resolvedDirectory.relativePath}/${sanitizedName}` : sanitizedName,
      });
    }

    logActivity("file_write", `Uploaded ${results.length} file(s) to ${workspace}/${dirPath || "/"}`, "success", {
      metadata: { files: results.map((r) => r.name), workspace, dirPath },
    });

    return NextResponse.json({ success: true, files: results });
  } catch (error) {
    console.error("[upload] Error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

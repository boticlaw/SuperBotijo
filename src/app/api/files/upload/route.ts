import { promises as fs } from "fs";
import path from "path";

import { NextRequest, NextResponse } from "next/server";

import { logActivity } from "@/lib/activities-db";
import { resolveWorkspacePath } from "@/lib/files-workspaces";

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
      const sanitizedName = path.basename(file.name);
      const targetPath = path.join(resolvedDirectory.fullPath, sanitizedName);

      const buffer = Buffer.from(await file.arrayBuffer());

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

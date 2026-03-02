import { NextRequest, NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import path from "path";

const ALLOWED_PREFIXES = [
  (process.env.OPENCLAW_WORKSPACE || "/home/daniel/.openclaw/workspace") + "/",
  (process.env.OPENCLAW_DIR || "/home/daniel/.openclaw") + "/media/",
];

const ALLOWED_EXTENSIONS: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params;
  const filePath = "/" + segments.join("/");
  const resolved = path.resolve(filePath);

  // Security: only allowed prefixes
  if (!ALLOWED_PREFIXES.some((p) => resolved.startsWith(p))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Security: only image extensions
  const ext = path.extname(resolved).toLowerCase();
  const contentType = ALLOWED_EXTENSIONS[ext];
  if (!contentType) {
    return NextResponse.json({ error: "Not an image" }, { status: 403 });
  }

  try {
    const fileStat = await stat(resolved);
    if (!fileStat.isFile()) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const data = await readFile(resolved);
    return new NextResponse(data, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

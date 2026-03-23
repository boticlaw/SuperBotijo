import { NextRequest, NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import path from "path";

const ALLOWED_PREFIXES = [
  path.join(process.env.OPENCLAW_DIR || "/root/.openclaw", "media"),
  path.join(process.env.OPENCLAW_DIR || "/root/.openclaw", "public", "models"),
];

export const dynamic = "force-dynamic";

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

  let sanitized = filePath.replace(/\x00/g, "");
  sanitized = decodeURIComponent(sanitized);

  const resolved = path.resolve(sanitized);

  if (!ALLOWED_PREFIXES.some((prefix) => resolved.startsWith(prefix + path.sep))) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  if (resolved.includes("..")) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

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

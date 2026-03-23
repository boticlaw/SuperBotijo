import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { OPENCLAW_WORKSPACE } from "@/lib/paths";

export const dynamic = "force-dynamic";

const WORKSPACE = OPENCLAW_WORKSPACE;
const MEMORY_DIR = "memory";

const REPORT_PATTERNS = [
  /^twitter-analysis-/,
  /^instagram-analysis-/,
  /^youtube-analysis-/,
  /-analysis-/,
  /-report-/,
];

function isReportFile(filename: string): boolean {
  return REPORT_PATTERNS.some((p) => p.test(filename));
}

function extractTitle(content: string): string {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : "Untitled Report";
}

function getReportType(filename: string): string {
  if (filename.startsWith("twitter-")) return "twitter";
  if (filename.startsWith("instagram-")) return "instagram";
  if (filename.startsWith("youtube-")) return "youtube";
  if (filename.includes("-analysis-")) return "analysis";
  if (filename.includes("-report-")) return "report";
  return "other";
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const filePath = searchParams.get("path");

  try {
    if (filePath) {
      // Read specific file
      const normalized = path.normalize(filePath);
      if (normalized.startsWith("..") || path.isAbsolute(normalized) || !normalized.endsWith(".md")) {
        return NextResponse.json({ error: "Invalid path" }, { status: 400 });
      }
      const fullPath = path.join(WORKSPACE, normalized);
      const content = await fs.readFile(fullPath, "utf-8");
      return NextResponse.json({ path: normalized, content });
    }

    // List report files
    const memoryPath = path.join(WORKSPACE, MEMORY_DIR);
    let files: string[] = [];
    try {
      files = await fs.readdir(memoryPath);
    } catch {
      return NextResponse.json([]);
    }

    const reports = [];
    for (const file of files) {
      if (!file.endsWith(".md") || !isReportFile(file)) continue;
      const fullPath = path.join(memoryPath, file);
      const stat = await fs.stat(fullPath);
      const content = await fs.readFile(fullPath, "utf-8");
      reports.push({
        name: file,
        path: `${MEMORY_DIR}/${file}`,
        title: extractTitle(content),
        type: getReportType(file),
        size: stat.size,
        modified: stat.mtime.toISOString(),
      });
    }

    reports.sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime());
    return NextResponse.json(reports);
  } catch (error) {
    console.error("Error in reports API:", error);
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
  }
}

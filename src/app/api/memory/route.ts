/**
 * Memory files list API
 * GET /api/memory - List recent memory files
 */
import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const OPENCLAW_DIR = process.env.OPENCLAW_DIR || "/home/daniel/.openclaw";
const WORKSPACE = path.join(OPENCLAW_DIR, "workspace");

interface MemoryFile {
  name: string;
  path: string;
  modified: string;
  size: number;
}

async function getMemoryFiles(): Promise<MemoryFile[]> {
  const files: MemoryFile[] = [];

  // Root workspace files
  const rootFiles = ["MEMORY.md", "SOUL.md", "USER.md", "AGENTS.md", "TOOLS.md", "IDENTITY.md", "HEARTBEAT.md"];
  for (const f of rootFiles) {
    const fullPath = path.join(WORKSPACE, f);
    try {
      const stat = await fs.stat(fullPath);
      files.push({
        name: f,
        path: f,
        modified: stat.mtime.toISOString(),
        size: stat.size,
      });
    } catch {
      // File doesn't exist, skip
    }
  }

  // Memory directory
  try {
    const memDir = path.join(WORKSPACE, "memory");
    const memFiles = await fs.readdir(memDir);
    
    // Get last 30 days of memory files
    const sortedFiles = memFiles
      .filter(f => f.endsWith(".md"))
      .sort()
      .reverse()
      .slice(0, 30);

    for (const f of sortedFiles) {
      const fullPath = path.join(memDir, f);
      try {
        const stat = await fs.stat(fullPath);
        files.push({
          name: f,
          path: `memory/${f}`,
          modified: stat.mtime.toISOString(),
          size: stat.size,
        });
      } catch {
        // Skip if can't read
      }
    }
  } catch {
    // Memory directory doesn't exist
  }

  // Sort by modified date
  files.sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime());

  return files;
}

export async function GET() {
  try {
    const files = await getMemoryFiles();
    return NextResponse.json({ files });
  } catch (error) {
    console.error("[memory] Error:", error);
    return NextResponse.json({ error: "Failed to list memory files" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join, resolve } from "path";
import { existsSync } from "fs";

const SAFE_SESSION_KEY_PATTERN = /^[a-zA-Z0-9_\-./]+$/;

function isValidSessionKey(key: string): boolean {
  if (!key || key.length === 0 || key.length > 255) {
    return false;
  }
  if (key.includes("..") || key.includes("\0")) {
    return false;
  }
  return SAFE_SESSION_KEY_PATTERN.test(key);
}

function isPathWithinBase(basePath: string, targetPath: string): boolean {
  const resolvedBase = resolve(basePath);
  const resolvedTarget = resolve(targetPath);
  return resolvedTarget.startsWith(resolvedBase + "/") || resolvedTarget === resolvedBase;
}

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await params;
    const sessionKey = decodeURIComponent(key);
    
    if (!isValidSessionKey(sessionKey)) {
      return NextResponse.json(
        { error: "Invalid session key" },
        { status: 400 }
      );
    }
    
    const workspaceRoot = process.env.WORKSPACE_ROOT || "/home/daniel/.openclaw/workspace";
    const sessionsBaseDir = join(workspaceRoot, "sessions");
    const sessionPath = join(sessionsBaseDir, sessionKey, "session.jsonl");
    
    if (!isPathWithinBase(sessionsBaseDir, sessionPath)) {
      return NextResponse.json(
        { error: "Invalid session key" },
        { status: 400 }
      );
    }
    
    if (!existsSync(sessionPath)) {
      return NextResponse.json(
        { error: "Session transcript not found" },
        { status: 404 }
      );
    }

    // Read and parse JSONL
    const content = await readFile(sessionPath, "utf-8");
    const lines = content.trim().split("\n");
    
    const messages = lines
      .map((line, index) => {
        try {
          const data = JSON.parse(line);
          
          // Extract message data based on format
          return {
            id: `msg-${index}`,
            type: data.type || "system",
            role: data.role,
            content: data.content || data.message || JSON.stringify(data),
            timestamp: data.timestamp || new Date().toISOString(),
            model: data.model,
            toolName: data.tool_name || data.toolName,
          };
        } catch {
          return null;
        }
      })
      .filter((msg) => msg !== null);

    return NextResponse.json({ messages });
  } catch (error) {
    console.error("Error reading transcript:", error);
    return NextResponse.json(
      { error: "Failed to read transcript" },
      { status: 500 }
    );
  }
}

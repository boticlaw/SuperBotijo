import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await params;
    const sessionKey = decodeURIComponent(key);
    
    // Construct path to session JSONL file
    const workspaceRoot = process.env.WORKSPACE_ROOT || "/home/daniel/.openclaw/workspace";
    const sessionPath = join(workspaceRoot, "sessions", sessionKey, "session.jsonl");
    
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

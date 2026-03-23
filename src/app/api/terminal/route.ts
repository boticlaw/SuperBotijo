/**
 * Secure Browser Terminal API
 * POST /api/terminal
 * Body: { command }
 */
import { execFile } from "child_process";
import { promisify } from "util";

import { NextRequest, NextResponse } from "next/server";

import { validateTerminalCommand } from "@/lib/terminal-command";

export const dynamic = "force-dynamic";

const execFileAsync = promisify(execFile);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const command = typeof body.command === "string" ? body.command : "";
    const validation = validateTerminalCommand(command);

    if (!validation.ok) {
      return NextResponse.json({
        error: validation.error,
        hint: validation.hint,
      }, { status: validation.status });
    }

    const start = Date.now();
    const { stdout, stderr } = await execFileAsync(validation.executable, validation.args, {
      timeout: 10000,
      maxBuffer: 1024 * 1024,
      shell: false,
    });
    const duration = Date.now() - start;

    return NextResponse.json({
      output: stdout + (stderr ? `\nSTDERR: ${stderr}` : ""),
      duration,
      command: validation.command,
    });
  } catch (error) {
    const execError = error as Error & { stdout?: string; stderr?: string; code?: number | string };
    const message = execError.stderr || execError.stdout || execError.message || String(error);
    const statusCode = typeof execError.code === "number" ? 400 : 500;

    return NextResponse.json({ error: message.trim() || "Terminal command failed" }, { status: statusCode });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";

export const dynamic = "force-dynamic";

const OPENCLAW_DIR = process.env.OPENCLAW_DIR || "/home/daniel/.openclaw";

export interface HeartbeatStatus {
  enabled: boolean;
  every: string;
  target: string;
  activeHours: { start: string; end: string } | null;
  heartbeatMd: string;
  heartbeatMdPath: string;
  configured: boolean;
}

function getHeartbeatPaths(): string[] {
  return [
    join(OPENCLAW_DIR, "workspace", "HEARTBEAT.md"),
    join(OPENCLAW_DIR, "HEARTBEAT.md"),
  ];
}

export async function GET() {
  try {
    let config = {
      enabled: false,
      every: "30m",
      target: "last",
      activeHours: null as { start: string; end: string } | null,
    };

    const configPath = join(OPENCLAW_DIR, "openclaw.json");
    if (existsSync(configPath)) {
      try {
        const raw = readFileSync(configPath, "utf-8");
        const json = JSON.parse(raw);
        const hb = json.agents?.defaults?.heartbeat;

        if (hb) {
          config = {
            enabled: !!hb.every,
            every: hb.every || "30m",
            target: hb.target || "last",
            activeHours: hb.activeHours || null,
          };
        }
      } catch (e) {
        console.error("[heartbeat] Error reading config:", e);
      }
    }

    const paths = getHeartbeatPaths();
    let heartbeatMd = "";
    let heartbeatMdPath = "";

    for (const p of paths) {
      if (existsSync(p)) {
        heartbeatMd = readFileSync(p, "utf-8");
        heartbeatMdPath = p;
        break;
      }
    }

    return NextResponse.json({
      ...config,
      heartbeatMd,
      heartbeatMdPath,
      configured: heartbeatMd.length > 0,
    });
  } catch (error) {
    console.error("[heartbeat] Error:", error);
    return NextResponse.json(
      { error: "Failed to read heartbeat status" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { content } = body;

    if (typeof content !== "string") {
      return NextResponse.json(
        { error: "Content must be a string" },
        { status: 400 }
      );
    }

    if (content.length > 100 * 1024) {
      return NextResponse.json(
        { error: "Content too large (max 100KB)" },
        { status: 400 }
      );
    }

    const paths = getHeartbeatPaths();
    const targetPath = paths.find((p) => existsSync(p)) || paths[0];

    const dir = dirname(targetPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(targetPath, content, "utf-8");

    return NextResponse.json({
      success: true,
      path: targetPath,
      message: "HEARTBEAT.md saved successfully",
    });
  } catch (error) {
    console.error("[heartbeat] Error saving:", error);
    return NextResponse.json(
      { error: "Failed to save HEARTBEAT.md" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { readFileSync } from "fs";

export const dynamic = "force-dynamic";

interface GatewayStatus {
  status: "connected" | "disconnected" | "error";
  latency: number | null;
  port: number;
  lastChecked: string;
  error?: string;
}

interface GatewayConfig {
  token: string;
  port: number;
}

function getGatewayConfig(): GatewayConfig {
  const openclawDir = process.env.OPENCLAW_DIR || "/home/daniel/.openclaw";
  try {
    const configRaw = readFileSync(`${openclawDir}/openclaw.json`, "utf-8");
    const config = JSON.parse(configRaw);
    return {
      token: config.gateway?.auth?.token || "",
      port: config.gateway?.port || 18789,
    };
  } catch {
    return { token: "", port: 18789 };
  }
}

export async function GET(): Promise<NextResponse<GatewayStatus>> {
  const config = getGatewayConfig();
  const start = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(`http://localhost:${config.port}/health`, {
      headers: { Authorization: `Bearer ${config.token}` },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    return NextResponse.json({
      status: res.ok ? "connected" : "error",
      latency: Date.now() - start,
      port: config.port,
      lastChecked: new Date().toISOString(),
      error: res.ok ? undefined : res.statusText,
    });
  } catch (error) {
    return NextResponse.json({
      status: "disconnected",
      latency: null,
      port: config.port,
      lastChecked: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

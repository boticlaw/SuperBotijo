import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';

const OPENCLAW_CONFIG_PATH = path.join(os.homedir(), '.openclaw', 'openclaw.json');

export const dynamic = "force-dynamic";

interface OpenClawConfig {
  channels?: Record<string, { enabled?: boolean; name?: string }>;
  plugins?: {
    entries?: Record<string, { enabled?: boolean; name?: string }>;
  };
}

/**
 * PUT /api/integrations/[id]/toggle
 * Toggle enabled/disabled for a plugin or channel
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { enabled } = await request.json();

    if (!fs.existsSync(OPENCLAW_CONFIG_PATH)) {
      return NextResponse.json(
        { error: "OpenClaw config not found" },
        { status: 404 }
      );
    }

    const configContent = fs.readFileSync(OPENCLAW_CONFIG_PATH, 'utf-8');
    const config: OpenClawConfig = JSON.parse(configContent);

    // Try to toggle in channels first
    if (config.channels && config.channels[id]) {
      config.channels[id] = {
        ...config.channels[id],
        enabled,
      };
    }
    // Try to toggle in plugins
    else if (config.plugins?.entries && config.plugins.entries[id]) {
      config.plugins.entries[id] = {
        ...config.plugins.entries[id],
        enabled,
      };
    } else {
      return NextResponse.json(
        { error: `Integration ${id} not found in config` },
        { status: 404 }
      );
    }

    // Write back to config
    fs.writeFileSync(OPENCLAW_CONFIG_PATH, JSON.stringify(config, null, 2));

    return NextResponse.json({
      success: true,
      id,
      enabled,
    });
  } catch (error) {
    console.error("Failed to toggle integration:", error);
    return NextResponse.json(
      { error: "Failed to toggle integration" },
      { status: 500 }
    );
  }
}

import fs from "fs";

import { getAgentDefaults } from "@/lib/agent-auto-config";
import { OPENCLAW_CONFIG } from "@/lib/paths";
import {
  TELEMETRY_DEGRADATION_CODE,
  TELEMETRY_DEGRADATION_SECTION,
  type AgentIdentityTelemetry,
  type TelemetryDegradation,
} from "@/lib/telemetry/types";

interface OpenClawAgentConfigEntry {
  id: string;
  name?: string;
  model?: string;
}

interface OpenClawAgentDefaults {
  model?: {
    primary?: string;
  };
}

interface OpenClawAgentsConfig {
  list?: OpenClawAgentConfigEntry[];
  defaults?: OpenClawAgentDefaults;
}

interface OpenClawConfig {
  agents?: OpenClawAgentsConfig;
}

export interface AgentsConfigSourceResult {
  agents: AgentIdentityTelemetry[];
  degraded: TelemetryDegradation[];
}

export function parseOpenClawAgentsConfig(rawContent: string): AgentIdentityTelemetry[] {
  const parsed = JSON.parse(rawContent) as OpenClawConfig;
  const agents = parsed.agents?.list ?? [];
  const defaultModel = parsed.agents?.defaults?.model?.primary ?? "unknown";

  return agents
    .filter((agent) => Boolean(agent.id))
    .map((agent) => {
      const defaults = getAgentDefaults(agent.id, agent.name ?? agent.id);
      return {
        id: agent.id,
        name: agent.name ?? agent.id,
        emoji: defaults.emoji,
        color: defaults.color,
        model: agent.model ?? defaultModel,
      };
    });
}

export function getAgentsConfigTelemetry(configPath: string = OPENCLAW_CONFIG): AgentsConfigSourceResult {
  if (!fs.existsSync(configPath)) {
    return {
      agents: [],
      degraded: [
        {
          section: TELEMETRY_DEGRADATION_SECTION.AGENTS,
          code: TELEMETRY_DEGRADATION_CODE.SOURCE_UNAVAILABLE,
          retriable: false,
          message: `OpenClaw config not found at ${configPath}`,
        },
      ],
    };
  }

  try {
    const rawContent = fs.readFileSync(configPath, "utf-8");
    return {
      agents: parseOpenClawAgentsConfig(rawContent),
      degraded: [],
    };
  } catch (error) {
    return {
      agents: [],
      degraded: [
        {
          section: TELEMETRY_DEGRADATION_SECTION.AGENTS,
          code: TELEMETRY_DEGRADATION_CODE.PARSE_ERROR,
          retriable: false,
          message: error instanceof Error
            ? error.message
            : "Failed to parse OpenClaw config",
        },
      ],
    };
  }
}

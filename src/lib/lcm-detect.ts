/**
 * LCM (Lossless-Claw Memory) Detection
 * Checks whether the lossless-claw plugin is enabled and its database is accessible.
 */

import fs from "fs";
import { LCM_DB_PATH, OPENCLAW_CONFIG } from "@/lib/paths";

export interface LcmDetectionResult {
  available: boolean;
  dbPath: string;
}

/**
 * Check if Lossless-Claw Memory is available.
 * Returns available: true ONLY when both:
 * 1. openclaw.json has plugins.entries.lossless-claw.enabled === true
 * 2. lcm.db exists at LCM_DB_PATH
 */
export function isLcmAvailable(): LcmDetectionResult {
  const dbPath = LCM_DB_PATH;

  // Check DB file exists first (cheap check)
  if (!fs.existsSync(dbPath)) {
    return { available: false, dbPath };
  }

  // Check openclaw.json for plugin config
  try {
    if (!fs.existsSync(OPENCLAW_CONFIG)) {
      return { available: false, dbPath };
    }

    const configRaw = fs.readFileSync(OPENCLAW_CONFIG, "utf-8");
    const config = JSON.parse(configRaw) as {
      plugins?: {
        entries?: {
          "lossless-claw"?: {
            enabled?: boolean;
          };
        };
      };
    };

    const pluginEnabled =
      config?.plugins?.entries?.["lossless-claw"]?.enabled === true;

    return { available: pluginEnabled, dbPath };
  } catch {
    // Config file missing, malformed, or unreadable — NOT available
    return { available: false, dbPath };
  }
}

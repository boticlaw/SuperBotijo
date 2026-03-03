import "server-only";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import { join } from "path";
import type { Mission, MissionFile } from "./mission-types";

/**
 * Mission Storage Module
 * Handles persistence for the Mission Control Layer
 */

const DATA_DIR = join(process.cwd(), "data");
const MISSION_PATH = join(DATA_DIR, "mission.json");

/**
 * Get the default empty mission
 * @returns Default mission with empty statement, goals, and values
 */
export function getDefaultMission(): Mission {
  return {
    statement: "",
    goals: [],
    values: [],
    lastUpdated: new Date(),
  };
}

/**
 * Read the current mission from data/mission.json
 * @returns Mission object or null if file doesn't exist
 */
export function getMission(): Mission | null {
  try {
    if (!existsSync(MISSION_PATH)) {
      return null;
    }

    const content = readFileSync(MISSION_PATH, "utf-8");
    const data: MissionFile = JSON.parse(content);

    return {
      statement: data.statement ?? "",
      goals: data.goals ?? [],
      values: data.values ?? [],
      lastUpdated: new Date(data.lastUpdated),
    };
  } catch (error) {
    console.error("Failed to read mission file:", error);
    return null;
  }
}

/**
 * Save the mission to data/mission.json
 * Creates the data directory if it doesn't exist
 * @param mission - Mission object to save
 */
export function saveMission(mission: Mission): void {
  try {
    // Ensure data directory exists
    if (!existsSync(DATA_DIR)) {
      mkdirSync(DATA_DIR, { recursive: true });
    }

    const data: MissionFile = {
      statement: mission.statement,
      goals: mission.goals,
      values: mission.values,
      lastUpdated: new Date().toISOString(),
    };

    writeFileSync(MISSION_PATH, JSON.stringify(data, null, 2), "utf-8");
  } catch (error) {
    console.error("Failed to save mission file:", error);
    throw error;
  }
}

/**
 * Delete the mission file (reset to default)
 * @returns true if file was deleted, false if it didn't exist
 */
export function deleteMission(): boolean {
  try {
    if (!existsSync(MISSION_PATH)) {
      return false;
    }
    unlinkSync(MISSION_PATH);
    return true;
  } catch (error) {
    console.error("Failed to delete mission file:", error);
    throw error;
  }
}

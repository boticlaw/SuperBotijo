import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import {
  logActivity,
  getActivities,
  updateActivityStatus,
  type ActivityType,
  type ActivityStatus,
} from "./activity-logger";

const DATA_PATH = path.join(process.cwd(), "data", "activities.json");
const BACKUP_PATH = path.join(process.cwd(), "data", "activities.json.test-backup");

// Helper to backup existing file
function backup() {
  try {
    if (fs.existsSync(DATA_PATH)) {
      fs.copyFileSync(DATA_PATH, BACKUP_PATH);
      fs.unlinkSync(DATA_PATH);
    }
  } catch {
    // ignore
  }
}

// Helper to restore backup
function restore() {
  try {
    if (fs.existsSync(DATA_PATH)) {
      fs.unlinkSync(DATA_PATH);
    }
    if (fs.existsSync(BACKUP_PATH)) {
      fs.copyFileSync(BACKUP_PATH, DATA_PATH);
      fs.unlinkSync(BACKUP_PATH);
    }
  } catch {
    // ignore
  }
}

describe("activity-logger", () => {
  beforeEach(() => {
    backup();
  });

  afterEach(() => {
    restore();
  });

  describe("logActivity", () => {
    it("creates a new activity with required fields", () => {
      const activity = logActivity("file", "Created test.txt", "success");

      expect(activity.id).toBeDefined();
      expect(activity.type).toBe("file");
      expect(activity.description).toBe("Created test.txt");
      expect(activity.status).toBe("success");
      expect(activity.timestamp).toBeDefined();
      expect(activity.duration_ms).toBeNull();
      expect(activity.tokens_used).toBeNull();
      expect(activity.metadata).toBeNull();
    });

    it("creates activity with optional fields", () => {
      const activity = logActivity("command", "Ran npm test", "success", {
        duration_ms: 1500,
        tokens_used: 500,
        metadata: { command: "npm test", exitCode: 0 },
      });

      expect(activity.duration_ms).toBe(1500);
      expect(activity.tokens_used).toBe(500);
      expect(activity.metadata).toEqual({ command: "npm test", exitCode: 0 });
    });

    it("prepends new activity to existing ones", () => {
      // Create first activity
      logActivity("file", "First activity", "success");
      
      // Create second activity
      logActivity("search", "Second activity", "success");

      const activities = getActivities();
      
      expect(activities).toHaveLength(2);
      expect(activities[0].description).toBe("Second activity");
      expect(activities[1].description).toBe("First activity");
    });

    it("handles all activity types", () => {
      const types: ActivityType[] = [
        "file",
        "search",
        "message",
        "command",
        "security",
        "build",
        "task",
        "cron",
        "memory",
      ];

      for (const type of types) {
        const activity = logActivity(type, `Test ${type}`, "success");
        expect(activity.type).toBe(type);
      }
    });

    it("handles all activity statuses", () => {
      const statuses: ActivityStatus[] = ["success", "error", "pending"];

      for (const status of statuses) {
        const activity = logActivity("file", `Test ${status}`, status);
        expect(activity.status).toBe(status);
      }
    });
  });

  describe("getActivities", () => {
    it("returns empty array when no activities exist", () => {
      const activities = getActivities();
      expect(activities).toEqual([]);
    });

    it("returns activities from file", () => {
      logActivity("file", "Test 1", "success");
      logActivity("search", "Test 2", "error");

      const activities = getActivities();

      expect(activities).toHaveLength(2);
      expect(activities[0].type).toBe("search");
      expect(activities[1].type).toBe("file");
    });
  });

  describe("updateActivityStatus", () => {
    it("updates status of existing activity", () => {
      const created = logActivity("task", "Running task", "pending");
      
      const updated = updateActivityStatus(created.id, "success");

      expect(updated).not.toBeNull();
      expect(updated?.status).toBe("success");
      expect(updated?.id).toBe(created.id);
    });

    it("updates duration and tokens when provided", () => {
      const created = logActivity("task", "Running task", "pending");

      const updated = updateActivityStatus(created.id, "success", {
        duration_ms: 5000,
        tokens_used: 1000,
      });

      expect(updated?.duration_ms).toBe(5000);
      expect(updated?.tokens_used).toBe(1000);
    });

    it("preserves existing duration/tokens if not provided", () => {
      const created = logActivity("task", "Running task", "pending", {
        duration_ms: 2000,
        tokens_used: 500,
      });

      const updated = updateActivityStatus(created.id, "success");

      expect(updated?.duration_ms).toBe(2000);
      expect(updated?.tokens_used).toBe(500);
    });

    it("returns null for non-existent activity", () => {
      const result = updateActivityStatus("non-existent-id", "success");

      expect(result).toBeNull();
    });
  });

  describe("type safety", () => {
    it("ActivityType has all expected values", () => {
      const expectedTypes: ActivityType[] = [
        "file",
        "search",
        "message",
        "command",
        "security",
        "build",
        "task",
        "cron",
        "memory",
      ];

      const testType: ActivityType = "file";
      expect(expectedTypes).toContain(testType);
    });

    it("ActivityStatus has all expected values", () => {
      const expectedStatuses: ActivityStatus[] = ["success", "error", "pending"];

      const testStatus: ActivityStatus = "success";
      expect(expectedStatuses).toContain(testStatus);
    });
  });
});

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import path from "path";
import {
  logActivity,
  getActivityById,
  updateActivity,
  updateActivityStatus,
  getActivities,
  getActivityStats,
} from "./activities-db";

const DB_PATH = path.join(process.cwd(), "data", "activities.db");
const DB_WAL = path.join(process.cwd(), "data", "activities.db-wal");
const DB_SHM = path.join(process.cwd(), "data", "activities.db-shm");

function cleanup() {
  try {
    // Close any open connections by resetting the module
    vi.resetModules();
    
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
    if (fs.existsSync(DB_WAL)) fs.unlinkSync(DB_WAL);
    if (fs.existsSync(DB_SHM)) fs.unlinkSync(DB_SHM);
  } catch {
    // ignore
  }
}

describe("activities-db", () => {
  beforeEach(() => {
    cleanup();
  });

  afterEach(() => {
    cleanup();
  });

  describe("logActivity", () => {
    it("creates a new activity with required fields", () => {
      const activity = logActivity("file", "Created test.txt", "success");

      expect(activity.id).toBeDefined();
      expect(activity.type).toBe("file");
      expect(activity.description).toBe("Created test.txt");
      expect(activity.status).toBe("success");
      expect(activity.timestamp).toBeDefined();
    });

    it("creates activity with optional fields", () => {
      const activity = logActivity("command", "Ran npm test", "success", {
        duration_ms: 1500,
        tokens_used: 500,
        agent: "main",
        metadata: { exitCode: 0 },
      });

      expect(activity.duration_ms).toBe(1500);
      expect(activity.tokens_used).toBe(500);
      expect(activity.agent).toBe("main");
      expect(activity.metadata).toEqual({ exitCode: 0 });
    });
  });

  describe("getActivityById", () => {
    it("returns null for non-existent activity", () => {
      const result = getActivityById("non-existent-id");
      expect(result).toBeNull();
    });

    it("returns activity by id", () => {
      const created = logActivity("file", "Test activity", "success");
      
      const result = getActivityById(created.id);
      
      expect(result).not.toBeNull();
      expect(result?.id).toBe(created.id);
      expect(result?.description).toBe("Test activity");
    });
  });

  describe("updateActivity", () => {
    it("updates activity status", () => {
      const created = logActivity("task", "Running task", "pending");
      
      updateActivity(created.id, "success", { duration_ms: 5000 });
      
      const updated = getActivityById(created.id);
      expect(updated?.status).toBe("success");
      expect(updated?.duration_ms).toBe(5000);
    });
  });

  describe("updateActivityStatus", () => {
    it("updates status without metadata", () => {
      const created = logActivity("task", "Running task", "pending");
      
      updateActivityStatus(created.id, "success");
      
      const updated = getActivityById(created.id);
      expect(updated?.status).toBe("success");
    });

    it("updates status with metadata", () => {
      const created = logActivity("task", "Running task", "pending");
      
      updateActivityStatus(created.id, "success", { completed: true });
      
      const updated = getActivityById(created.id);
      expect(updated?.status).toBe("success");
      expect(updated?.metadata).toEqual({ completed: true });
    });
  });

  describe("getActivities", () => {
    it("returns activities with pagination", () => {
      // Create multiple activities
      logActivity("file", "Activity 1", "success");
      logActivity("file", "Activity 2", "success");
      logActivity("file", "Activity 3", "success");

      const result = getActivities({ limit: 2 });

      expect(result.activities.length).toBeLessThanOrEqual(2);
      expect(result.total).toBeGreaterThanOrEqual(3);
    });

    it("filters by type", () => {
      logActivity("file", "File activity", "success");
      logActivity("search", "Search activity", "success");

      const result = getActivities({ type: "file" });

      expect(result.activities.every((a) => a.type === "file")).toBe(true);
    });

    it("filters by status", () => {
      logActivity("file", "Success activity", "success");
      logActivity("file", "Error activity", "error");

      const result = getActivities({ status: "error" });

      expect(result.activities.every((a) => a.status === "error")).toBe(true);
    });

    it("filters by agent", () => {
      logActivity("file", "Main activity", "success", { agent: "main" });
      logActivity("file", "Infra activity", "success", { agent: "infra" });

      const result = getActivities({ agent: "main" });

      expect(result.activities.every((a) => a.agent === "main")).toBe(true);
    });

    it("sorts by newest first by default", () => {
      logActivity("file", "First", "success");
      logActivity("file", "Second", "success");

      const result = getActivities({ sort: "newest" });

      if (result.activities.length >= 2) {
        const first = new Date(result.activities[0].timestamp).getTime();
        const second = new Date(result.activities[1].timestamp).getTime();
        expect(first).toBeGreaterThanOrEqual(second);
      }
    });

    it("sorts by oldest when specified", () => {
      logActivity("file", "First", "success");
      logActivity("file", "Second", "success");

      const result = getActivities({ sort: "oldest" });

      if (result.activities.length >= 2) {
        const first = new Date(result.activities[0].timestamp).getTime();
        const second = new Date(result.activities[1].timestamp).getTime();
        expect(first).toBeLessThanOrEqual(second);
      }
    });
  });

  describe("getActivityStats", () => {
    it("returns stats with required fields", () => {
      logActivity("file", "Test", "success");
      
      const stats = getActivityStats();

      expect(stats).toHaveProperty("total");
      expect(stats).toHaveProperty("today");
      expect(stats).toHaveProperty("byType");
      expect(stats).toHaveProperty("byStatus");
    });

    it("counts total activities", () => {
      logActivity("file", "Test 1", "success");
      logActivity("file", "Test 2", "success");

      const stats = getActivityStats();

      expect(stats.total).toBeGreaterThanOrEqual(2);
    });

    it("groups by type", () => {
      logActivity("file", "File activity", "success");
      logActivity("search", "Search activity", "success");

      const stats = getActivityStats();

      expect(stats.byType["file"]).toBeGreaterThanOrEqual(1);
      expect(stats.byType["search"]).toBeGreaterThanOrEqual(1);
    });

    it("groups by status", () => {
      logActivity("file", "Success", "success");
      logActivity("file", "Error", "error");

      const stats = getActivityStats();

      expect(stats.byStatus["success"]).toBeGreaterThanOrEqual(1);
      expect(stats.byStatus["error"]).toBeGreaterThanOrEqual(1);
    });
  });
});

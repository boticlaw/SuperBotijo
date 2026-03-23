import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";

import { changePassword, clearActivityLog, getSystemData } from "./system-ops";

vi.mock("fs", () => ({
  default: {
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    existsSync: vi.fn(),
  },
}));

vi.mock("os", () => ({
  default: {
    homedir: () => "/home/test",
    platform: () => "linux",
    hostname: () => "testhost",
    totalmem: () => 1000000000,
    freemem: () => 500000000,
  },
}));

const mockFs = vi.mocked(fs);

describe("system-ops", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("changePassword", () => {
    it("returns error when .env.local cannot be read", () => {
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error("ENOENT");
      });

      const result = changePassword("old", "new");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Could not read configuration");
    });

    it("returns error when current password is incorrect", () => {
      mockFs.readFileSync.mockReturnValue("ADMIN_PASSWORD=correct\n");

      const result = changePassword("wrong", "new");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Current password is incorrect");
    });

    it("updates password when current password matches", () => {
      mockFs.readFileSync.mockReturnValue("ADMIN_PASSWORD=oldpass\nOTHER_VAR=value\n");
      mockFs.writeFileSync.mockImplementation(() => {});

      const result = changePassword("oldpass", "newpass");

      expect(result.success).toBe(true);
      expect(result.message).toBe("Password updated successfully");
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining("ADMIN_PASSWORD=newpass")
      );
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining("OTHER_VAR=value")
      );
    });
  });

  describe("clearActivityLog", () => {
    it("writes empty array to activities.json", () => {
      mockFs.writeFileSync.mockImplementation(() => {});

      const result = clearActivityLog();

      expect(result.success).toBe(true);
      expect(result.message).toBe("Activity log cleared");
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining("activities.json"),
        "[]"
      );
    });
  });

  describe("getSystemData", () => {
    it("returns system information with default values", async () => {
      mockFs.existsSync.mockReturnValue(false);

      const data = await getSystemData();

      expect(data).toHaveProperty("agent");
      expect(data).toHaveProperty("system");
      expect(data).toHaveProperty("integrations");
      expect(data).toHaveProperty("timestamp");
      expect(data.system).toHaveProperty("uptime");
      expect(data.system).toHaveProperty("nodeVersion");
      expect(data.system).toHaveProperty("platform");
    });
  });
});

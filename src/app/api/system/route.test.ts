import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import { GET, POST } from "./route";

vi.mock("@/operations/system-ops", () => ({
  getSystemData: vi.fn(),
  changePassword: vi.fn(),
  clearActivityLog: vi.fn(),
}));

const mockedOps = vi.hoisted(() => ({
  getSystemData: vi.fn(),
  changePassword: vi.fn(),
  clearActivityLog: vi.fn(),
}));

vi.mock("@/operations/system-ops", () => mockedOps);

describe("System API Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("GET", () => {
    it("delegates to getSystemData operation", async () => {
      const mockData = {
        agent: { name: "Test", creature: "Bot", emoji: "🤖" },
        system: {
          uptime: 100,
          uptimeFormatted: "1m",
          nodeVersion: "v20.0.0",
          model: "test-model",
          workspacePath: "/workspace",
          platform: "linux",
          hostname: "test",
          memory: { total: 1000, free: 500, used: 500 },
        },
        integrations: [],
        timestamp: "2024-01-01T00:00:00Z",
      };

      mockedOps.getSystemData.mockResolvedValue(mockData);

      const response = await GET();
      const json = await response.json();

      expect(mockedOps.getSystemData).toHaveBeenCalledTimes(1);
      expect(json).toEqual(mockData);
    });

    it("returns 500 when operation fails", async () => {
      mockedOps.getSystemData.mockRejectedValue(new Error("Failed"));

      const response = await GET();
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json).toHaveProperty("error");
    });
  });

  describe("POST", () => {
    it("delegates change_password to changePassword operation", async () => {
      mockedOps.changePassword.mockReturnValue({
        success: true,
        message: "Password updated successfully",
      });

      const request = new Request("http://localhost/api/system", {
        method: "POST",
        body: JSON.stringify({
          action: "change_password",
          data: { currentPassword: "old", newPassword: "new" },
        }),
      });

      const response = await POST(request);
      const json = await response.json();

      expect(mockedOps.changePassword).toHaveBeenCalledWith("old", "new");
      expect(json.success).toBe(true);
    });

    it("returns 401 when password change fails", async () => {
      mockedOps.changePassword.mockReturnValue({
        success: false,
        message: "",
        error: "Current password is incorrect",
      });

      const request = new Request("http://localhost/api/system", {
        method: "POST",
        body: JSON.stringify({
          action: "change_password",
          data: { currentPassword: "wrong", newPassword: "new" },
        }),
      });

      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(401);
      expect(json.error).toBe("Current password is incorrect");
    });

    it("delegates clear_activity_log to clearActivityLog operation", async () => {
      mockedOps.clearActivityLog.mockReturnValue({
        success: true,
        message: "Activity log cleared",
      });

      const request = new Request("http://localhost/api/system", {
        method: "POST",
        body: JSON.stringify({
          action: "clear_activity_log",
          data: {},
        }),
      });

      const response = await POST(request);
      const json = await response.json();

      expect(mockedOps.clearActivityLog).toHaveBeenCalledTimes(1);
      expect(json.success).toBe(true);
    });

    it("returns 400 for unknown action", async () => {
      const request = new Request("http://localhost/api/system", {
        method: "POST",
        body: JSON.stringify({
          action: "unknown_action",
          data: {},
        }),
      });

      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.error).toBe("Unknown action");
    });
  });
});

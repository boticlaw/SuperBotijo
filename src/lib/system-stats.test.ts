import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import os from "os";
import fs from "fs";

// Mock child_process with proper default export for ESM/CJS interop
vi.mock("child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("child_process")>();
  const mockExec = vi.fn();
  return {
    ...actual,
    default: { ...actual, exec: mockExec },
    exec: mockExec,
  };
});

// Mock better-sqlite3
vi.mock("better-sqlite3", () => ({
  default: vi.fn(() => {
    throw new Error("mocked — no db");
  }),
}));

// Static imports — mocks are applied before these resolve
import { exec } from "child_process";
import { getSystemStats, cachedSystemStats } from "./system-stats";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const execMock = exec as any as ReturnType<typeof vi.fn>;

/**
 * Helper: configure execMock to respond based on command substrings.
 */
function setupExecResponses(responses: Record<string, string>) {
  execMock.mockImplementation((cmd: string, callback?: (error: Error | null, result: { stdout: string; stderr: string }) => void) => {
    for (const [pattern, stdout] of Object.entries(responses)) {
      if (cmd.includes(pattern)) {
        if (callback) {
          callback(null, { stdout, stderr: "" });
        }
        return;
      }
    }
    if (callback) {
      callback(null, { stdout: "", stderr: "" });
    }
  });
}

/**
 * Helper: configure execMock to fail for specific command patterns.
 */
function setupExecFailure(failPatterns: string[]) {
  execMock.mockImplementation((cmd: string, callback?: (error: Error | null, result: { stdout: string; stderr: string }) => void) => {
    for (const pattern of failPatterns) {
      if (cmd.includes(pattern)) {
        if (callback) {
          callback(new Error(`Command failed: ${cmd}`), { stdout: "", stderr: "" });
        }
        return;
      }
    }
    if (callback) {
      callback(null, { stdout: "", stderr: "" });
    }
  });
}

describe("system-stats", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-15T10:00:00Z"));

    vi.spyOn(os, "loadavg").mockReturnValue([1.5, 1.2, 0.8]);
    vi.spyOn(os, "cpus").mockReturnValue(Array(4).fill({
      model: "test",
      speed: 2400,
      times: { user: 0, nice: 0, sys: 0, idle: 0, irq: 0 },
    }));
    vi.spyOn(os, "totalmem").mockReturnValue(16 * 1024 * 1024 * 1024);
    vi.spyOn(os, "freemem").mockReturnValue(8 * 1024 * 1024 * 1024);
    vi.spyOn(os, "uptime").mockReturnValue(90061);

    vi.spyOn(fs, "existsSync").mockReturnValue(false);

    // Invalidate cachedSystemStats to get fresh results per test
    cachedSystemStats.invalidate();

    setupExecResponses({
      "df -BG": "/dev/sda1 100G 45G 55G 45% /",
      "tailscale": "100.64.0.1 myhost  daniel   linux   -",
      "ufw status": "Status: active",
      "systemctl is-active superbotijo": "active",
      "systemctl is-active content-vault": "active",
      "systemctl is-active classvault": "inactive",
      "systemctl is-active creatoros": "active",
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    execMock.mockReset();
  });

  describe("getSystemStats", () => {
    it("returns response matching SystemStatsResponse shape", async () => {
      const stats = await getSystemStats();

      expect(stats).toEqual(
        expect.objectContaining({
          cpu: expect.objectContaining({
            load: expect.any(Number),
            loadAvg1: expect.any(Number),
            loadAvg5: expect.any(Number),
            loadAvg15: expect.any(Number),
          }),
          memory: expect.objectContaining({
            total: expect.any(Number),
            used: expect.any(Number),
            free: expect.any(Number),
          }),
          disk: expect.objectContaining({
            used: expect.any(Number),
            total: expect.any(Number),
          }),
          activeAgents: expect.any(Number),
          totalAgents: expect.any(Number),
          tokensToday: expect.any(Number),
          uptime: expect.any(String),
          vpnActive: expect.any(Boolean),
          firewallActive: expect.any(Boolean),
          activeServices: expect.any(Number),
          totalServices: expect.any(Number),
        })
      );
    });

    it("calculates CPU stats from os.loadavg()", async () => {
      const stats = await getSystemStats();

      // load = round((1.5 / 4) * 100) = 38
      expect(stats.cpu.load).toBe(38);
      expect(stats.cpu.loadAvg1).toBe(1.5);
      expect(stats.cpu.loadAvg5).toBe(1.2);
      expect(stats.cpu.loadAvg15).toBe(0.8);
    });

    it("calculates memory stats from os module", async () => {
      const stats = await getSystemStats();

      expect(stats.memory.total).toBe(16);
      expect(stats.memory.used).toBe(8);
      expect(stats.memory.free).toBe(8);
    });

    it("calculates uptime string correctly", async () => {
      const stats = await getSystemStats();

      // 90061s = 1d 1h 1m
      expect(stats.uptime).toBe("1d 1h 1m");
    });

    it("parses disk stats from df output", async () => {
      const stats = await getSystemStats();

      expect(stats.disk.total).toBe(100);
      expect(stats.disk.used).toBe(45);
    });

    it("parses VPN status correctly when active", async () => {
      const stats = await getSystemStats();

      expect(stats.vpnActive).toBe(true);
    });

    it("detects VPN as stopped when tailscale reports stopped", async () => {
      setupExecResponses({
        "df -BG": "/dev/sda1 100G 45G 55G 45% /",
        "tailscale": "Tailscale is stopped",
        "ufw status": "Status: active",
        "systemctl is-active superbotijo": "inactive",
        "systemctl is-active content-vault": "inactive",
        "systemctl is-active classvault": "inactive",
        "systemctl is-active creatoros": "inactive",
      });

      const stats = await getSystemStats();

      expect(stats.vpnActive).toBe(false);
    });

    it("parses firewall status correctly", async () => {
      const stats = await getSystemStats();

      expect(stats.firewallActive).toBe(true);
    });

    it("counts active systemd services", async () => {
      const stats = await getSystemStats();

      // superbotijo, content-vault, creatoros = 3 active
      expect(stats.activeServices).toBe(3);
      expect(stats.totalServices).toBe(4);
    });

    it("runs shell commands in parallel (7 total: df, tailscale, ufw, 4x systemctl)", async () => {
      const callOrder: string[] = [];

      execMock.mockImplementation((cmd: string, callback?: (error: Error | null, result: { stdout: string; stderr: string }) => void) => {
        callOrder.push(cmd);
        if (callback) {
          callback(null, { stdout: "", stderr: "" });
        }
      });

      await getSystemStats();

      expect(callOrder.length).toBe(7);
      expect(callOrder.some((c) => c.includes("df -BG"))).toBe(true);
      expect(callOrder.some((c) => c.includes("tailscale"))).toBe(true);
      expect(callOrder.some((c) => c.includes("ufw"))).toBe(true);
      expect(callOrder.filter((c) => c.includes("systemctl")).length).toBe(4);
    });

    it("handles graceful fallback when disk command fails", async () => {
      setupExecFailure(["df -BG"]);

      const stats = await getSystemStats();

      expect(stats.disk.used).toBe(0);
      expect(stats.disk.total).toBe(100);
    });

    it("handles graceful fallback when all shell commands fail", async () => {
      setupExecFailure(["df", "tailscale", "ufw", "systemctl"]);

      const stats = await getSystemStats();

      expect(stats.disk.used).toBe(0);
      expect(stats.disk.total).toBe(100);
      expect(stats.vpnActive).toBe(true);
      expect(stats.firewallActive).toBe(true);
      expect(stats.activeServices).toBe(0);
    });

    it("caps CPU load at 100%", async () => {
      vi.spyOn(os, "loadavg").mockReturnValue([20.0, 15.0, 10.0]);
      vi.spyOn(os, "cpus").mockReturnValue(Array(2).fill({
        model: "test",
        speed: 2400,
        times: { user: 0, nice: 0, sys: 0, idle: 0, irq: 0 },
      }));

      const stats = await getSystemStats();

      expect(stats.cpu.load).toBe(100);
    });
  });

  describe("cachedSystemStats", () => {
    it("second call within TTL returns cached result without recomputing", async () => {
      const first = await cachedSystemStats.get();
      const callsAfterFirst = execMock.mock.calls.length;

      const second = await cachedSystemStats.get();
      const callsAfterSecond = execMock.mock.calls.length;

      expect(second).toEqual(first);
      // No additional exec calls — served from cache
      expect(callsAfterSecond).toBe(callsAfterFirst);
    });

    it("recomputes after TTL (15 seconds) expires", async () => {
      await cachedSystemStats.get();
      const firstCallCount = execMock.mock.calls.length;

      // Advance past 15s TTL
      vi.advanceTimersByTime(16_000);

      await cachedSystemStats.get();
      const secondCallCount = execMock.mock.calls.length;

      expect(secondCallCount).toBeGreaterThan(firstCallCount);
    });
  });
});

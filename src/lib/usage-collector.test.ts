// @vitest-environment node

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import {
  extractSessionData,
  calculateSnapshot,
  initDatabase,
  saveSnapshot,
  type SessionData,
  type UsageSnapshot,
  type OpenClawStatus,
} from "./usage-collector";

const TEST_DB_PATH = path.join(process.cwd(), "data", "test-usage-collector.db");

function cleanup() {
  try {
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  } catch {
    // ignore
  }
}

describe("usage-collector", () => {
  beforeEach(() => {
    cleanup();
  });

  afterEach(() => {
    cleanup();
  });

  describe("extractSessionData", () => {
    it("returns empty array when no sessions exist", () => {
      const status: OpenClawStatus = {};
      const result = extractSessionData(status);
      expect(result).toEqual([]);
    });

    it("returns empty array when sessions.byAgent is undefined", () => {
      const status: OpenClawStatus = {
        sessions: {},
      };
      const result = extractSessionData(status);
      expect(result).toEqual([]);
    });

    it("extracts session data from status", () => {
      const status: OpenClawStatus = {
        sessions: {
          byAgent: [
            {
              agentId: "main",
              recent: [
                {
                  key: "session-1",
                  sessionId: "abc123",
                  model: "claude-sonnet-4-5",
                  inputTokens: 1000,
                  outputTokens: 500,
                  totalTokens: 1500,
                  updatedAt: "2024-01-15T10:30:00Z",
                  percentUsed: 15,
                },
              ],
            },
          ],
        },
      };

      const result = extractSessionData(status);

      expect(result).toHaveLength(1);
      expect(result[0].agentId).toBe("main");
      expect(result[0].sessionKey).toBe("session-1");
      expect(result[0].sessionId).toBe("abc123");
      expect(result[0].model).toBe("anthropic/claude-sonnet-4-5"); // normalized
      expect(result[0].inputTokens).toBe(1000);
      expect(result[0].outputTokens).toBe(500);
      expect(result[0].totalTokens).toBe(1500);
      expect(result[0].percentUsed).toBe(15);
    });

    it("handles multiple agents and sessions", () => {
      const status: OpenClawStatus = {
        sessions: {
          byAgent: [
            {
              agentId: "main",
              recent: [
                {
                  key: "session-1",
                  sessionId: "abc123",
                  model: "sonnet",
                  inputTokens: 1000,
                  outputTokens: 500,
                  totalTokens: 1500,
                },
              ],
            },
            {
              agentId: "infra",
              recent: [
                {
                  key: "session-2",
                  sessionId: "def456",
                  model: "haiku",
                  inputTokens: 500,
                  outputTokens: 200,
                  totalTokens: 700,
                },
              ],
            },
          ],
        },
      };

      const result = extractSessionData(status);

      expect(result).toHaveLength(2);
      expect(result.find((s) => s.agentId === "main")).toBeDefined();
      expect(result.find((s) => s.agentId === "infra")).toBeDefined();
    });

    it("handles missing optional fields with defaults", () => {
      const status: OpenClawStatus = {
        sessions: {
          byAgent: [
            {
              agentId: "main",
              recent: [
                {
                  key: "session-1",
                  sessionId: "abc123",
                  // model, tokens, etc. are missing
                },
              ],
            },
          ],
        },
      };

      const result = extractSessionData(status);

      expect(result).toHaveLength(1);
      expect(result[0].model).toBe("unknown"); // normalized unknown
      expect(result[0].inputTokens).toBe(0);
      expect(result[0].outputTokens).toBe(0);
      expect(result[0].totalTokens).toBe(0);
      expect(result[0].percentUsed).toBe(0);
    });

    it("normalizes model IDs", () => {
      const status: OpenClawStatus = {
        sessions: {
          byAgent: [
            {
              agentId: "main",
              recent: [
                { key: "s1", sessionId: "1", model: "opus" },
                { key: "s2", sessionId: "2", model: "claude-sonnet-4-5" },
                { key: "s3", sessionId: "3", model: "google/gemini-2.5-flash" },
              ],
            },
          ],
        },
      };

      const result = extractSessionData(status);

      expect(result[0].model).toBe("anthropic/claude-opus-4-6");
      expect(result[1].model).toBe("anthropic/claude-sonnet-4-5");
      expect(result[2].model).toBe("google/gemini-2.5-flash");
    });
  });

  describe("calculateSnapshot", () => {
    it("returns empty array for empty sessions", () => {
      const timestamp = Date.now();
      const result = calculateSnapshot([], timestamp);
      expect(result).toEqual([]);
    });

    it("groups sessions by agent and model", () => {
      const timestamp = new Date("2024-01-15T10:30:00Z").getTime();
      const sessions: SessionData[] = [
        {
          agentId: "main",
          sessionKey: "s1",
          sessionId: "1",
          model: "anthropic/claude-sonnet-4-5",
          inputTokens: 1000,
          outputTokens: 500,
          totalTokens: 1500,
          updatedAt: timestamp,
          percentUsed: 10,
        },
        {
          agentId: "main",
          sessionKey: "s2",
          sessionId: "2",
          model: "anthropic/claude-sonnet-4-5",
          inputTokens: 2000,
          outputTokens: 1000,
          totalTokens: 3000,
          updatedAt: timestamp,
          percentUsed: 20,
        },
      ];

      const result = calculateSnapshot(sessions, timestamp);

      // Should be grouped into 1 snapshot (same agent + model)
      expect(result).toHaveLength(1);
      expect(result[0].inputTokens).toBe(3000); // 1000 + 2000
      expect(result[0].outputTokens).toBe(1500); // 500 + 1000
      expect(result[0].totalTokens).toBe(4500); // 1500 + 3000
    });

    it("creates separate snapshots for different agents", () => {
      const timestamp = new Date("2024-01-15T10:30:00Z").getTime();
      const sessions: SessionData[] = [
        {
          agentId: "main",
          sessionKey: "s1",
          sessionId: "1",
          model: "anthropic/claude-sonnet-4-5",
          inputTokens: 1000,
          outputTokens: 500,
          totalTokens: 1500,
          updatedAt: timestamp,
          percentUsed: 10,
        },
        {
          agentId: "infra",
          sessionKey: "s2",
          sessionId: "2",
          model: "anthropic/claude-sonnet-4-5",
          inputTokens: 500,
          outputTokens: 200,
          totalTokens: 700,
          updatedAt: timestamp,
          percentUsed: 5,
        },
      ];

      const result = calculateSnapshot(sessions, timestamp);

      expect(result).toHaveLength(2);
      expect(result.find((s) => s.agentId === "main")).toBeDefined();
      expect(result.find((s) => s.agentId === "infra")).toBeDefined();
    });

    it("creates separate snapshots for different models", () => {
      const timestamp = new Date("2024-01-15T10:30:00Z").getTime();
      const sessions: SessionData[] = [
        {
          agentId: "main",
          sessionKey: "s1",
          sessionId: "1",
          model: "anthropic/claude-sonnet-4-5",
          inputTokens: 1000,
          outputTokens: 500,
          totalTokens: 1500,
          updatedAt: timestamp,
          percentUsed: 10,
        },
        {
          agentId: "main",
          sessionKey: "s2",
          sessionId: "2",
          model: "anthropic/claude-opus-4-6",
          inputTokens: 500,
          outputTokens: 200,
          totalTokens: 700,
          updatedAt: timestamp,
          percentUsed: 5,
        },
      ];

      const result = calculateSnapshot(sessions, timestamp);

      expect(result).toHaveLength(2);
      expect(result.find((s) => s.model.includes("sonnet"))).toBeDefined();
      expect(result.find((s) => s.model.includes("opus"))).toBeDefined();
    });

    it("calculates cost correctly", () => {
      const timestamp = new Date("2024-01-15T10:30:00Z").getTime();
      const sessions: SessionData[] = [
        {
          agentId: "main",
          sessionKey: "s1",
          sessionId: "1",
          model: "anthropic/claude-sonnet-4-5",
          inputTokens: 1000000, // 1M tokens
          outputTokens: 1000000, // 1M tokens
          totalTokens: 2000000,
          updatedAt: timestamp,
          percentUsed: 10,
        },
      ];

      const result = calculateSnapshot(sessions, timestamp);

      // Sonnet: $3/M input + $15/M output = $3 + $15 = $18
      expect(result[0].cost).toBeCloseTo(18, 1);
    });

    it("includes correct date and hour in snapshot", () => {
      const timestamp = new Date("2024-01-15T14:30:00Z").getTime();
      const sessions: SessionData[] = [
        {
          agentId: "main",
          sessionKey: "s1",
          sessionId: "1",
          model: "anthropic/claude-sonnet-4-5",
          inputTokens: 1000,
          outputTokens: 500,
          totalTokens: 1500,
          updatedAt: timestamp,
          percentUsed: 10,
        },
      ];

      const result = calculateSnapshot(sessions, timestamp);

      expect(result[0].date).toBe("2024-01-15");
      expect(result[0].hour).toBe(14);
    });
  });

  describe("initDatabase", () => {
    it("creates database file", () => {
      const db = initDatabase(TEST_DB_PATH);

      expect(fs.existsSync(TEST_DB_PATH)).toBe(true);
      expect(db).toBeDefined();

      db.close();
    });

    it("creates usage_snapshots table", () => {
      const db = initDatabase(TEST_DB_PATH);

      const table = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='usage_snapshots'"
        )
        .get();

      expect(table).toBeDefined();
      db.close();
    });

    it("creates required indexes", () => {
      const db = initDatabase(TEST_DB_PATH);

      const indexes = db
        .prepare("SELECT name FROM sqlite_master WHERE type='index'")
        .all() as Array<{ name: string }>;

      const indexNames = indexes.map((i) => i.name);
      expect(indexNames).toContain("idx_date");
      expect(indexNames).toContain("idx_agent");
      expect(indexNames).toContain("idx_model");
      expect(indexNames).toContain("idx_timestamp");

      db.close();
    });

    it("creates data directory if it doesn't exist", () => {
      const customPath = path.join(process.cwd(), "data-test-nested", "test.db");

      // Ensure directory doesn't exist
      try {
        fs.rmSync(path.dirname(customPath), { recursive: true });
      } catch {
        // ignore
      }

      const db = initDatabase(customPath);

      expect(fs.existsSync(path.dirname(customPath))).toBe(true);

      db.close();

      // Cleanup
      try {
        fs.rmSync(path.dirname(customPath), { recursive: true });
      } catch {
        // ignore
      }
    });
  });

  describe("saveSnapshot", () => {
    it("saves snapshot to database", () => {
      const db = initDatabase(TEST_DB_PATH);

      const snapshot: UsageSnapshot = {
        timestamp: Date.now(),
        date: "2024-01-15",
        hour: 14,
        agentId: "main",
        model: "anthropic/claude-sonnet-4-5",
        inputTokens: 1000,
        outputTokens: 500,
        totalTokens: 1500,
        cost: 0.015,
      };

      saveSnapshot(db, snapshot);

      const saved = db
        .prepare("SELECT * FROM usage_snapshots WHERE agent_id = ?")
        .get("main") as {
          timestamp: number;
          date: string;
          hour: number;
          agent_id: string;
          model: string;
          input_tokens: number;
          output_tokens: number;
          total_tokens: number;
          cost: number;
        };

      expect(saved).toBeDefined();
      expect(saved.date).toBe("2024-01-15");
      expect(saved.hour).toBe(14);
      expect(saved.agent_id).toBe("main");
      expect(saved.model).toBe("anthropic/claude-sonnet-4-5");
      expect(saved.input_tokens).toBe(1000);
      expect(saved.output_tokens).toBe(500);
      expect(saved.total_tokens).toBe(1500);
      expect(saved.cost).toBeCloseTo(0.015, 4);

      db.close();
    });

    it("can save multiple snapshots", () => {
      const db = initDatabase(TEST_DB_PATH);

      const snapshot1: UsageSnapshot = {
        timestamp: Date.now(),
        date: "2024-01-15",
        hour: 10,
        agentId: "main",
        model: "anthropic/claude-sonnet-4-5",
        inputTokens: 1000,
        outputTokens: 500,
        totalTokens: 1500,
        cost: 0.015,
      };

      const snapshot2: UsageSnapshot = {
        timestamp: Date.now(),
        date: "2024-01-15",
        hour: 11,
        agentId: "infra",
        model: "anthropic/claude-haiku-3-5",
        inputTokens: 500,
        outputTokens: 200,
        totalTokens: 700,
        cost: 0.002,
      };

      saveSnapshot(db, snapshot1);
      saveSnapshot(db, snapshot2);

      const count = db
        .prepare("SELECT COUNT(*) as count FROM usage_snapshots")
        .get() as { count: number };

      expect(count.count).toBe(2);

      db.close();
    });
  });

  describe("UsageSnapshot interface", () => {
    it("has all required properties", () => {
      const snapshot: UsageSnapshot = {
        timestamp: Date.now(),
        date: "2024-01-15",
        hour: 14,
        agentId: "main",
        model: "anthropic/claude-sonnet-4-5",
        inputTokens: 1000,
        outputTokens: 500,
        totalTokens: 1500,
        cost: 0.015,
      };

      expect(typeof snapshot.timestamp).toBe("number");
      expect(typeof snapshot.date).toBe("string");
      expect(typeof snapshot.hour).toBe("number");
      expect(typeof snapshot.agentId).toBe("string");
      expect(typeof snapshot.model).toBe("string");
      expect(typeof snapshot.inputTokens).toBe("number");
      expect(typeof snapshot.outputTokens).toBe("number");
      expect(typeof snapshot.totalTokens).toBe("number");
      expect(typeof snapshot.cost).toBe("number");
    });
  });
});

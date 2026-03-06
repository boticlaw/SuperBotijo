import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import {
  generateSuggestions,
  getSuggestions,
  dismissSuggestion,
  applySuggestion,
  getSuggestionById,
  type UsageData,
} from "./suggestions-engine";

const DATA_DIR = path.join(process.cwd(), "data");
const SUGGESTIONS_FILE = path.join(DATA_DIR, "suggestions.json");
const DISMISSED_FILE = path.join(DATA_DIR, "dismissed-suggestions.json");

function backup() {
  try {
    if (fs.existsSync(SUGGESTIONS_FILE)) {
      fs.copyFileSync(SUGGESTIONS_FILE, `${SUGGESTIONS_FILE}.test-backup`);
      fs.unlinkSync(SUGGESTIONS_FILE);
    }
    if (fs.existsSync(DISMISSED_FILE)) {
      fs.copyFileSync(DISMISSED_FILE, `${DISMISSED_FILE}.test-backup`);
      fs.unlinkSync(DISMISSED_FILE);
    }
  } catch {
    // ignore
  }
}

function restore() {
  try {
    if (fs.existsSync(SUGGESTIONS_FILE)) fs.unlinkSync(SUGGESTIONS_FILE);
    if (fs.existsSync(DISMISSED_FILE)) fs.unlinkSync(DISMISSED_FILE);
    if (fs.existsSync(`${SUGGESTIONS_FILE}.test-backup`)) {
      fs.copyFileSync(`${SUGGESTIONS_FILE}.test-backup`, SUGGESTIONS_FILE);
      fs.unlinkSync(`${SUGGESTIONS_FILE}.test-backup`);
    }
    if (fs.existsSync(`${DISMISSED_FILE}.test-backup`)) {
      fs.copyFileSync(`${DISMISSED_FILE}.test-backup`, DISMISSED_FILE);
      fs.unlinkSync(`${DISMISSED_FILE}.test-backup`);
    }
  } catch {
    // ignore
  }
}

describe("suggestions-engine", () => {
  beforeEach(() => {
    backup();
  });

  afterEach(() => {
    restore();
  });

  describe("generateSuggestions", () => {
    it("returns empty array when no issues detected", () => {
      const data: UsageData = {
        modelUsage: [],
        recentErrors: [],
        cronHealth: [],
        skillUsage: [],
        heartbeatFrequency: 60000,
      };

      const suggestions = generateSuggestions(data);
      expect(suggestions).toEqual([]);
    });

    it("detects expensive model usage", () => {
      const data: UsageData = {
        modelUsage: [
          { model: "anthropic/claude-opus-4-6", count: 100, totalTokens: 50000, totalCost: 5.0 },
        ],
        recentErrors: [],
        cronHealth: [],
        skillUsage: [],
        heartbeatFrequency: 60000,
      };

      const suggestions = generateSuggestions(data);

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].category).toBe("model");
      expect(suggestions[0].type).toBe("cost");
      expect(suggestions[0].impact).toBe("medium");
    });

    it("detects high impact for very expensive usage", () => {
      const data: UsageData = {
        modelUsage: [
          { model: "anthropic/claude-opus-4-6", count: 100, totalTokens: 50000, totalCost: 15.0 },
        ],
        recentErrors: [],
        cronHealth: [],
        skillUsage: [],
        heartbeatFrequency: 60000,
      };

      const suggestions = generateSuggestions(data);
      expect(suggestions[0].impact).toBe("high");
    });

    it("detects unhealthy cron jobs", () => {
      const data: UsageData = {
        modelUsage: [],
        recentErrors: [],
        cronHealth: [
          { name: "test-cron", successRate: 0.5, lastRun: new Date().toISOString() },
        ],
        skillUsage: [],
        heartbeatFrequency: 60000,
      };

      const suggestions = generateSuggestions(data);

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].category).toBe("cron");
      expect(suggestions[0].type).toBe("warning");
    });

    it("detects unused skills", () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 40); // 40 days ago

      const data: UsageData = {
        modelUsage: [],
        recentErrors: [],
        cronHealth: [],
        skillUsage: [
          { name: "unused-skill", lastUsed: oldDate.toISOString(), uses: 2 },
        ],
        heartbeatFrequency: 60000,
      };

      const suggestions = generateSuggestions(data);

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].category).toBe("skill");
      expect(suggestions[0].type).toBe("info");
    });

    it("detects recurring errors", () => {
      const data: UsageData = {
        modelUsage: [],
        recentErrors: [
          { message: "Connection timeout", count: 5, lastSeen: new Date().toISOString() },
        ],
        cronHealth: [],
        skillUsage: [],
        heartbeatFrequency: 60000,
      };

      const suggestions = generateSuggestions(data);

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].category).toBe("error");
      expect(suggestions[0].type).toBe("warning");
    });

    it("detects frequent heartbeat", () => {
      const data: UsageData = {
        modelUsage: [],
        recentErrors: [],
        cronHealth: [],
        skillUsage: [],
        heartbeatFrequency: 10000, // 10 seconds
      };

      const suggestions = generateSuggestions(data);

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].category).toBe("heartbeat");
      expect(suggestions[0].type).toBe("optimization");
    });
  });

  describe("getSuggestions", () => {
    it("returns empty array when no suggestions exist", () => {
      const suggestions = getSuggestions();
      expect(suggestions).toEqual([]);
    });

    it("returns only active suggestions (not dismissed or applied)", () => {
      // Generate some suggestions first
      const data: UsageData = {
        modelUsage: [
          { model: "anthropic/claude-opus-4-6", count: 100, totalTokens: 50000, totalCost: 5.0 },
        ],
        recentErrors: [],
        cronHealth: [],
        skillUsage: [],
        heartbeatFrequency: 60000,
      };

      generateSuggestions(data);
      const suggestions = getSuggestions();

      expect(suggestions.length).toBeGreaterThan(0);
      // All returned suggestions should be active
      for (const s of suggestions) {
        expect(s.dismissedAt).toBeUndefined();
        expect(s.appliedAt).toBeUndefined();
      }
    });
  });

  describe("dismissSuggestion", () => {
    it("returns false for non-existent suggestion", () => {
      const result = dismissSuggestion("non-existent-id");
      expect(result).toBe(false);
    });

    it("dismisses an existing suggestion", () => {
      // Create a suggestion first
      const data: UsageData = {
        modelUsage: [
          { model: "anthropic/claude-opus-4-6", count: 100, totalTokens: 50000, totalCost: 5.0 },
        ],
        recentErrors: [],
        cronHealth: [],
        skillUsage: [],
        heartbeatFrequency: 60000,
      };

      generateSuggestions(data);
      const suggestions = getSuggestions();
      const id = suggestions[0].id;

      const result = dismissSuggestion(id);
      expect(result).toBe(true);

      // Should not appear in active suggestions anymore
      const remaining = getSuggestions();
      expect(remaining.find((s) => s.id === id)).toBeUndefined();
    });
  });

  describe("applySuggestion", () => {
    it("returns false for non-existent suggestion", () => {
      const result = applySuggestion("non-existent-id");
      expect(result).toBe(false);
    });

    it("applies an existing suggestion", () => {
      // Create a suggestion first
      const data: UsageData = {
        modelUsage: [
          { model: "anthropic/claude-opus-4-6", count: 100, totalTokens: 50000, totalCost: 5.0 },
        ],
        recentErrors: [],
        cronHealth: [],
        skillUsage: [],
        heartbeatFrequency: 60000,
      };

      generateSuggestions(data);
      const suggestions = getSuggestions();
      const id = suggestions[0].id;

      const result = applySuggestion(id);
      expect(result).toBe(true);

      // Should not appear in active suggestions anymore
      const remaining = getSuggestions();
      expect(remaining.find((s) => s.id === id)).toBeUndefined();
    });
  });

  describe("getSuggestionById", () => {
    it("returns null for non-existent suggestion", () => {
      const result = getSuggestionById("non-existent-id");
      expect(result).toBeNull();
    });

    it("returns the suggestion by id", () => {
      const data: UsageData = {
        modelUsage: [
          { model: "anthropic/claude-opus-4-6", count: 100, totalTokens: 50000, totalCost: 5.0 },
        ],
        recentErrors: [],
        cronHealth: [],
        skillUsage: [],
        heartbeatFrequency: 60000,
      };

      generateSuggestions(data);
      const suggestions = getSuggestions();
      const id = suggestions[0].id;

      const result = getSuggestionById(id);
      expect(result).not.toBeNull();
      expect(result?.id).toBe(id);
    });
  });

  describe("suggestion structure", () => {
    it("creates suggestions with all required fields", () => {
      const data: UsageData = {
        modelUsage: [
          { model: "anthropic/claude-opus-4-6", count: 100, totalTokens: 50000, totalCost: 5.0 },
        ],
        recentErrors: [],
        cronHealth: [],
        skillUsage: [],
        heartbeatFrequency: 60000,
      };

      generateSuggestions(data);
      const suggestions = getSuggestions();

      expect(suggestions.length).toBeGreaterThan(0);
      const s = suggestions[0];

      expect(s.id).toBeDefined();
      expect(s.type).toBeDefined();
      expect(s.category).toBeDefined();
      expect(s.title).toBeDefined();
      expect(s.description).toBeDefined();
      expect(s.impact).toBeDefined();
      expect(s.createdAt).toBeDefined();
    });

    it("includes action when applicable", () => {
      const data: UsageData = {
        modelUsage: [
          { model: "anthropic/claude-opus-4-6", count: 100, totalTokens: 50000, totalCost: 5.0 },
        ],
        recentErrors: [],
        cronHealth: [],
        skillUsage: [],
        heartbeatFrequency: 60000,
      };

      generateSuggestions(data);
      const suggestions = getSuggestions();

      const withAction = suggestions.find((s) => s.action);
      expect(withAction?.action?.label).toBeDefined();
      expect(withAction?.action?.type).toBeDefined();
    });
  });
});

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import { parseMemoryFiles, type KnowledgeGraph } from "./memory-parser";

const OPENCLAW_DIR = process.env.OPENCLAW_DIR || "/home/daniel/.openclaw";
const WORKSPACE = path.join(OPENCLAW_DIR, "workspace");
const MEMORY_DIR = path.join(WORKSPACE, "memory");

// Store original env
const ORIGINAL_OPENCLAW_DIR = process.env.OPENCLAW_DIR;

function setupTestFiles() {
  // Create test memory directory
  if (!fs.existsSync(MEMORY_DIR)) {
    fs.mkdirSync(MEMORY_DIR, { recursive: true });
  }

  // Create test MEMORY.md
  const memoryContent = `# Memory

This is a test memory file with some important concepts.

## Projects

Working on SuperBotijo and OpenClaw projects.
Using React and Next.js for frontend.

## People

Daniel is the main developer.
`;
  fs.writeFileSync(path.join(WORKSPACE, "MEMORY.md"), memoryContent);
}

function cleanup() {
  // Restore original env
  process.env.OPENCLAW_DIR = ORIGINAL_OPENCLAW_DIR;
}

describe("memory-parser", () => {
  beforeEach(() => {
    cleanup();
    try {
      setupTestFiles();
    } catch {
      // ignore if can't set up
    }
  });

  afterEach(() => {
    cleanup();
  });

  describe("parseMemoryFiles", () => {
    it("returns a KnowledgeGraph object", () => {
      const result = parseMemoryFiles();

      expect(result).toHaveProperty("entities");
      expect(result).toHaveProperty("relations");
      expect(result).toHaveProperty("stats");
    });

    it("returns entities as an array", () => {
      const result = parseMemoryFiles();

      expect(Array.isArray(result.entities)).toBe(true);
    });

    it("returns relations as an array", () => {
      const result = parseMemoryFiles();

      expect(Array.isArray(result.relations)).toBe(true);
    });

    it("includes stats with expected properties", () => {
      const result = parseMemoryFiles();

      expect(result.stats).toHaveProperty("totalTokens");
      expect(result.stats).toHaveProperty("totalEntities");
      expect(result.stats).toHaveProperty("totalRelations");
      expect(result.stats).toHaveProperty("typesDistribution");
    });

    it("limits entities to 150 max", () => {
      const result = parseMemoryFiles();

      expect(result.entities.length).toBeLessThanOrEqual(150);
    });

    it("limits relations to 300 max", () => {
      const result = parseMemoryFiles();

      expect(result.relations.length).toBeLessThanOrEqual(300);
    });

    it("sorts entities by mentions (descending)", () => {
      const result = parseMemoryFiles();

      for (let i = 1; i < result.entities.length; i++) {
        expect(result.entities[i - 1].mentions).toBeGreaterThanOrEqual(
          result.entities[i].mentions
        );
      }
    });

    it("includes type distribution for all types", () => {
      const result = parseMemoryFiles();

      const types = [
        "person",
        "tool",
        "project",
        "resource",
        "date",
        "concept",
        "action",
        "location",
      ];

      for (const type of types) {
        expect(result.stats.typesDistribution).toHaveProperty(type);
      }
    });
  });

  describe("Entity structure", () => {
    it("entities have required properties", () => {
      const result = parseMemoryFiles();

      if (result.entities.length > 0) {
        const entity = result.entities[0];

        expect(entity).toHaveProperty("id");
        expect(entity).toHaveProperty("name");
        expect(entity).toHaveProperty("type");
        expect(entity).toHaveProperty("mentions");
        expect(entity).toHaveProperty("firstSeen");
        expect(entity).toHaveProperty("lastSeen");
        expect(entity).toHaveProperty("sources");
        expect(entity).toHaveProperty("contexts");
        expect(entity).toHaveProperty("metadata");
      }
    });
  });

  describe("Relation structure", () => {
    it("relations have required properties", () => {
      const result = parseMemoryFiles();

      if (result.relations.length > 0) {
        const relation = result.relations[0];

        expect(relation).toHaveProperty("id");
        expect(relation).toHaveProperty("source");
        expect(relation).toHaveProperty("target");
        expect(relation).toHaveProperty("type");
        expect(relation).toHaveProperty("weight");
        expect(relation).toHaveProperty("context");
      }
    });
  });

  describe("type inference", () => {
    it("entities have valid types", () => {
      const validTypes = [
        "person",
        "tool",
        "project",
        "resource",
        "date",
        "concept",
        "action",
        "location",
      ];

      const result = parseMemoryFiles();

      for (const entity of result.entities) {
        expect(validTypes).toContain(entity.type);
      }
    });

    it("relations have valid types", () => {
      const validTypes = ["appears_with", "mentions", "related_to", "uses", "created"];

      const result = parseMemoryFiles();

      for (const relation of result.relations) {
        expect(validTypes).toContain(relation.type);
      }
    });
  });
});

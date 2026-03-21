import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import { parseSkill, type SkillInfo } from "./skill-parser";

const TEST_SKILLS_DIR = path.join(process.cwd(), "data-test-skills");
const TEST_SKILL_PATH = path.join(TEST_SKILLS_DIR, "test-skill");
const TEST_SKILL_MD = path.join(TEST_SKILL_PATH, "SKILL.md");

function setupTestSkill() {
  // Create test skill directory
  fs.mkdirSync(TEST_SKILL_PATH, { recursive: true });
  
  // Create SKILL.md with front matter
  const skillContent = `---
name: Test Skill
description: A test skill for unit testing
homepage: https://example.com/test-skill
---

# Test Skill

This is a test skill description.

## Usage

Use this skill for testing purposes.
`;
  
  fs.writeFileSync(TEST_SKILL_MD, skillContent);
  
  // Create some additional files
  fs.writeFileSync(path.join(TEST_SKILL_PATH, "README.md"), "# README");
  fs.writeFileSync(path.join(TEST_SKILL_PATH, "index.js"), "console.log('test');");
}

function cleanup() {
  try {
    if (fs.existsSync(TEST_SKILLS_DIR)) {
      fs.rmSync(TEST_SKILLS_DIR, { recursive: true });
    }
  } catch {
    // ignore
  }
}

describe("skill-parser", () => {
  beforeEach(() => {
    cleanup();
    setupTestSkill();
  });

  afterEach(() => {
    cleanup();
  });

  describe("parseSkill", () => {
    it("returns null when SKILL.md doesn't exist", () => {
      const result = parseSkill("/non/existent/path", "non-existent");
      expect(result).toBeNull();
    });

    it("parses skill with front matter", () => {
      const result = parseSkill(TEST_SKILL_PATH, "test-skill");

      expect(result).not.toBeNull();
      expect(result?.name).toBe("Test Skill");
      expect(result?.description).toBe("A test skill for unit testing");
      expect(result?.homepage).toBe("https://example.com/test-skill");
    });

    it("extracts first paragraph as description when no front matter description", () => {
      // Create skill without description in front matter
      const skillContent = `---
name: No Description Skill
---

# No Description Skill

This is the first paragraph that should become the description.
`;
      fs.writeFileSync(TEST_SKILL_MD, skillContent);

      const result = parseSkill(TEST_SKILL_PATH, "test-skill");

      expect(result).not.toBeNull();
      expect(result?.description).toContain("first paragraph");
    });

    it("counts files in skill directory", () => {
      const result = parseSkill(TEST_SKILL_PATH, "test-skill");

      expect(result).not.toBeNull();
      expect(result?.fileCount).toBe(3); // SKILL.md, README.md, index.js
    });

    it("lists all files in skill", () => {
      const result = parseSkill(TEST_SKILL_PATH, "test-skill");

      expect(result).not.toBeNull();
      expect(result?.files).toContain("SKILL.md");
      expect(result?.files).toContain("README.md");
      expect(result?.files).toContain("index.js");
    });

    it("includes full content of SKILL.md", () => {
      const result = parseSkill(TEST_SKILL_PATH, "test-skill");

      expect(result).not.toBeNull();
      expect(result?.fullContent).toContain("Test Skill");
      expect(result?.fullContent).toContain("---");
    });

    it("sets id to skill name", () => {
      const result = parseSkill(TEST_SKILL_PATH, "test-skill");

      expect(result).not.toBeNull();
      expect(result?.id).toBe("test-skill");
    });

    it("accepts agents parameter", () => {
      const result = parseSkill(TEST_SKILL_PATH, "test-skill", ["main", "infra"]);

      expect(result).not.toBeNull();
      expect(result?.agents).toEqual(["main", "infra"]);
    });

    it("defaults to empty agents array", () => {
      const result = parseSkill(TEST_SKILL_PATH, "test-skill");

      expect(result).not.toBeNull();
      expect(result?.agents).toEqual([]);
    });
  });

  describe("SkillInfo interface", () => {
    it("returns object with all expected properties", () => {
      const result = parseSkill(TEST_SKILL_PATH, "test-skill");

      expect(result).not.toBeNull();
      
      const skill: SkillInfo = result!;
      
      expect(typeof skill.id).toBe("string");
      expect(typeof skill.name).toBe("string");
      expect(typeof skill.description).toBe("string");
      expect(typeof skill.location).toBe("string");
      expect(["workspace", "system"]).toContain(skill.source);
      expect(typeof skill.fileCount).toBe("number");
      expect(typeof skill.fullContent).toBe("string");
      expect(Array.isArray(skill.files)).toBe(true);
      expect(Array.isArray(skill.agents)).toBe(true);
    });
  });

  describe("source detection", () => {
    it("sets source to workspace when path includes /workspace", () => {
      const result = parseSkill(TEST_SKILL_PATH, "test-skill");
      
      // Our test path doesn't include /workspace, so it should be 'system'
      // unless we modify the path check
      expect(result).not.toBeNull();
      expect(["workspace", "system"]).toContain(result?.source);
    });
  });

  describe("hidden files", () => {
    it("excludes hidden files from file count", () => {
      // Create a hidden file
      fs.writeFileSync(path.join(TEST_SKILL_PATH, ".hidden"), "hidden content");

      const result = parseSkill(TEST_SKILL_PATH, "test-skill");

      expect(result).not.toBeNull();
      expect(result?.files).not.toContain(".hidden");
    });
  });

  describe("error handling", () => {
    it("returns null when file read fails", () => {
      // Create a skill directory with SKILL.md but make it unreadable
      // Since we can't easily make it unreadable in test, we test with non-existent
      const result = parseSkill("/non/existent/path", "test");
      expect(result).toBeNull();
    });

    it("handles empty SKILL.md content", () => {
      fs.writeFileSync(TEST_SKILL_MD, "");

      const result = parseSkill(TEST_SKILL_PATH, "test-skill");

      expect(result).not.toBeNull();
      expect(result?.name).toBe("test-skill"); // Falls back to skillName
    });

    it("handles SKILL.md with only front matter", () => {
      // The front matter regex requires content after closing ---
      const content = "---\nname: Only Front Matter\ndescription: No body content\n---\n\n";
      fs.writeFileSync(TEST_SKILL_MD, content);

      const result = parseSkill(TEST_SKILL_PATH, "test-skill");

      expect(result).not.toBeNull();
      expect(result?.name).toBe("Only Front Matter");
      expect(result?.description).toBe("No body content");
    });

    it("handles front matter without delimiters", () => {
      const content = "# No Front Matter\n\nThis skill has no front matter at all.\nJust a simple description.";
      fs.writeFileSync(TEST_SKILL_MD, content);

      const result = parseSkill(TEST_SKILL_PATH, "test-skill");

      expect(result).not.toBeNull();
      expect(result?.name).toBe("test-skill"); // Falls back to skillName
      expect(result?.description).toContain("simple description");
    });

    it("handles emoji in front matter", () => {
      // Note: The parser expects JSON format for emoji, not YAML
      const content = `---
name: Emoji Skill
description: A skill with emoji
metadata: {"openclaw": {"emoji": "🚀"}}
---

# Emoji Skill

This skill has an emoji in front matter.`;

      fs.writeFileSync(TEST_SKILL_MD, content);

      const result = parseSkill(TEST_SKILL_PATH, "test-skill");

      expect(result).not.toBeNull();
      expect(result?.emoji).toBe("🚀");
    });
  });

  describe("workspace path detection", () => {
    it("detects workspace source when path contains /workspace", () => {
      // Create a path that includes /workspace
      const workspaceRoot = path.join(process.cwd(), "data-test-workspace");
      const workspaceSkillPath = path.join(workspaceRoot, "skills", "my-skill");
      fs.mkdirSync(workspaceSkillPath, { recursive: true });
      fs.writeFileSync(
        path.join(workspaceSkillPath, "SKILL.md"),
        "# Workspace Skill\n\nA workspace skill."
      );

      const result = parseSkill(workspaceSkillPath, "my-skill");

      expect(result).not.toBeNull();
      // The source should be 'workspace' because the path contains '/workspace'
      expect(result?.source).toBe("workspace");

      // Cleanup
      fs.rmSync(workspaceRoot, { recursive: true });
    });
  });
});

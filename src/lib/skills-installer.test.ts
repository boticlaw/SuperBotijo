import { describe, it, expect } from "vitest";
import type { Skill, InstallResult, EligibilityCheck, InstallProgress } from "./skills-installer";

describe("skills-installer types", () => {
  it("should have correct Skill interface", () => {
    const skill: Skill = {
      id: "test-skill",
      name: "Test Skill",
      version: "1.0.0",
      description: "A test skill",
      author: "Test Author",
      dependencies: ["dep1", "dep2"],
      compatibleModels: ["claude-3", "claude-3.5"],
      requiredCapabilities: ["filesystem", "network"],
      location: "/path/to/skill",
      enabled: true,
      installedAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-02T00:00:00Z",
    };

    expect(skill.id).toBe("test-skill");
    expect(skill.enabled).toBe(true);
    expect(skill.dependencies).toHaveLength(2);
    expect(skill.compatibleModels).toContain("claude-3");
  });

  it("should have correct InstallProgress interface", () => {
    const progress: InstallProgress = {
      step: "downloading",
      message: "Downloading skill...",
      progress: 50,
      details: "Processing...",
    };

    expect(progress.step).toBe("downloading");
    expect(progress.progress).toBe(50);
  });

  it("should have correct InstallResult interface - success", () => {
    const result: InstallResult = {
      success: true,
      skill: {
        id: "test",
        name: "Test",
        version: "1.0",
        description: "",
        dependencies: [],
        compatibleModels: [],
        requiredCapabilities: [],
        location: "/path",
        enabled: true,
      },
      warnings: ["Warning 1"],
    };

    expect(result.success).toBe(true);
    expect(result.skill).toBeDefined();
    expect(result.warnings).toHaveLength(1);
  });

  it("should have correct InstallResult interface - failure", () => {
    const result: InstallResult = {
      success: false,
      error: "Installation failed",
      rollbackPerformed: true,
      warnings: ["Warning 1", "Warning 2"],
    };

    expect(result.success).toBe(false);
    expect(result.error).toBe("Installation failed");
    expect(result.rollbackPerformed).toBe(true);
  });

  it("should have correct EligibilityCheck interface", () => {
    const check: EligibilityCheck = {
      eligible: true,
      issues: [],
      warnings: ["Warning 1"],
      missingDependencies: ["dep1"],
      incompatibleModels: ["model1"],
    };

    expect(check.eligible).toBe(true);
    expect(check.issues).toHaveLength(0);
    expect(check.missingDependencies).toContain("dep1");
  });

  describe("InstallProgress step values", () => {
    const steps: InstallProgress["step"][] = [
      "checking",
      "downloading",
      "installing",
      "validating",
      "complete",
      "error",
      "rollback",
    ];

    it("should have all valid step values", () => {
      expect(steps).toContain("checking");
      expect(steps).toContain("downloading");
      expect(steps).toContain("installing");
      expect(steps).toContain("validating");
      expect(steps).toContain("complete");
      expect(steps).toContain("error");
      expect(steps).toContain("rollback");
    });
  });
});

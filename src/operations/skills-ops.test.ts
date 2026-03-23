import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

let mergeSkills: typeof import("@/operations/skills-ops").mergeSkills;

beforeAll(async () => {
  ({ mergeSkills } = await import("@/operations/skills-ops"));
});

describe("mergeSkills", () => {
  it("merges scanned and installed entries by id", () => {
    const merged = mergeSkills(
      [
        {
          id: "skill-a",
          name: "Skill A",
          description: "From scanner",
          location: "/skills/skill-a",
          source: "workspace",
          fileCount: 1,
          fullContent: "# Skill A",
          files: ["SKILL.md"],
          agents: ["main"],
        },
      ],
      [
        {
          id: "skill-a",
          name: "Skill A Installed",
          version: "installed",
          description: "From installer",
          dependencies: [],
          compatibleModels: [],
          requiredCapabilities: [],
          location: "/skills/skill-a",
          enabled: true,
        },
      ]
    );

    expect(merged).toHaveLength(1);
    expect(merged[0]?.id).toBe("skill-a");
    expect(merged[0]?.installed).toBe(true);
    expect(merged[0]?.version).toBe("installed");
    expect(merged[0]?.description).toBe("From installer");
  });

  it("creates fallback entry when only installed skill exists", () => {
    const merged = mergeSkills([], [
      {
        id: "skill-b",
        name: "Skill B",
        version: "installed",
        description: "Installer only",
        dependencies: [],
        compatibleModels: [],
        requiredCapabilities: [],
        location: "/skills/skill-b",
        enabled: true,
      },
    ]);

    expect(merged).toHaveLength(1);
    expect(merged[0]?.id).toBe("skill-b");
    expect(merged[0]?.source).toBe("workspace");
    expect(merged[0]?.installed).toBe(true);
  });
});

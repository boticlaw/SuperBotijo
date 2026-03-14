import { describe, expect, it } from "vitest";

import { parseOpenClawAgentsConfig } from "@/lib/telemetry/sources/agents-config";

describe("parseOpenClawAgentsConfig", () => {
  it("normalizes agent identities from OpenClaw config", () => {
    const rawConfig = JSON.stringify({
      agents: {
        defaults: {
          model: {
            primary: "anthropic/claude-sonnet-4",
          },
        },
        list: [
          {
            id: "main",
            name: "Main Agent",
          },
          {
            id: "memo",
            model: "anthropic/claude-haiku-4",
          },
        ],
      },
    });

    const agents = parseOpenClawAgentsConfig(rawConfig);

    expect(agents).toHaveLength(2);
    expect(agents[0].id).toBe("main");
    expect(agents[0].name).toBe("Main Agent");
    expect(agents[0].model).toBe("anthropic/claude-sonnet-4");
    expect(agents[0].emoji.length).toBeGreaterThan(0);
    expect(agents[0].color).toMatch(/^#/);

    expect(agents[1].id).toBe("memo");
    expect(agents[1].name).toBe("memo");
    expect(agents[1].model).toBe("anthropic/claude-haiku-4");
  });

  it("ignores entries without agent id", () => {
    const rawConfig = JSON.stringify({
      agents: {
        list: [
          { id: "dev" },
          { name: "No ID" },
        ],
      },
    });

    const agents = parseOpenClawAgentsConfig(rawConfig);

    expect(agents).toHaveLength(1);
    expect(agents[0].id).toBe("dev");
  });
});

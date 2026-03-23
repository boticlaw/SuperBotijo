import fs from "fs";
import os from "os";
import path from "path";

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

function createTempStatePath(): { dir: string; filePath: string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "superbotijo-agent-state-"));
  return {
    dir,
    filePath: path.join(dir, "agent-runtime-state.json"),
  };
}

afterEach(() => {
  delete process.env.SUPERBOTIJO_AGENT_STATE_PATH;
  vi.resetModules();
});

describe("agent-state-store", () => {
  it("persists custom agents across reads", async () => {
    const { dir, filePath } = createTempStatePath();
    process.env.SUPERBOTIJO_AGENT_STATE_PATH = filePath;

    const store = await import("@/lib/agent-state-store");

    store.addPersistedCustomAgent({
      id: "agent-demo",
      name: "Demo Agent",
      model: "anthropic/claude-sonnet-4",
      emoji: ":robot:",
      color: "#00ff99",
      workspace: "/tmp/workspace/agent-demo",
      createdAt: new Date().toISOString(),
    });

    const agents = store.getPersistedCustomAgents();
    expect(agents).toHaveLength(1);
    expect(agents[0]?.id).toBe("agent-demo");

    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("cleans runtime state when custom agent is removed", async () => {
    const { dir, filePath } = createTempStatePath();
    process.env.SUPERBOTIJO_AGENT_STATE_PATH = filePath;

    const store = await import("@/lib/agent-state-store");

    store.addPersistedCustomAgent({
      id: "agent-ops",
      name: "Ops Agent",
      model: "anthropic/claude-sonnet-4",
      emoji: ":tools:",
      color: "#ff6b6b",
      workspace: "/tmp/workspace/agent-ops",
      createdAt: new Date().toISOString(),
    });
    store.setPersistedStatusOverride("agent-ops", {
      status: store.AGENT_RUNTIME_STATUS.paused,
      currentTask: "maintenance",
      lastActivity: new Date().toISOString(),
    });

    store.removePersistedCustomAgent("agent-ops");

    expect(store.getPersistedCustomAgents()).toHaveLength(0);
    expect(store.getPersistedStatusOverride("agent-ops")).toBeUndefined();

    fs.rmSync(dir, { recursive: true, force: true });
  });
});

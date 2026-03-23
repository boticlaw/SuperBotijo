import fs from "fs";
import os from "os";
import path from "path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

let tempDir: string;
let tempDbPath: string;

beforeEach(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "superbotijo-agent-config-"));
  tempDbPath = path.join(tempDir, "test-configs.db");
  process.env.SUPERBOTIJO_CONFIG_DB_PATH = tempDbPath;
  vi.resetModules();
});

afterEach(async () => {
  const store = await import("@/lib/agent-config-store");
  store.closeDb();
  delete process.env.SUPERBOTIJO_CONFIG_DB_PATH;
  vi.resetModules();
  if (tempDir && fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

describe("agent-config-store", () => {
  it("returns null for non-existent config", async () => {
    const store = await import("@/lib/agent-config-store");
    const config = store.getAgentConfig("non-existent-agent");
    expect(config).toBeNull();
  });

  it("sets and gets agent config", async () => {
    const store = await import("@/lib/agent-config-store");

    const config = store.setAgentConfig("test-agent", {
      model: "claude-3-opus",
      temperature: 0.5,
    });

    expect(config.agentId).toBe("test-agent");
    expect(config.model).toBe("claude-3-opus");
    expect(config.temperature).toBe(0.5);
    expect(config.maxTokens).toBe(store.DEFAULT_CONFIG.maxTokens);

    const retrieved = store.getAgentConfig("test-agent");
    expect(retrieved).toEqual(config);
  });

  it("merges updates with existing config", async () => {
    const store = await import("@/lib/agent-config-store");

    store.setAgentConfig("merge-agent", {
      model: "model-a",
      temperature: 0.3,
    });

    store.setAgentConfig("merge-agent", {
      maxTokens: 8192,
    });

    const config = store.getAgentConfig("merge-agent");
    expect(config?.model).toBe("model-a");
    expect(config?.temperature).toBe(0.3);
    expect(config?.maxTokens).toBe(8192);
  });

  it("deletes agent config", async () => {
    const store = await import("@/lib/agent-config-store");

    store.setAgentConfig("delete-agent", { model: "test-model" });
    expect(store.getAgentConfig("delete-agent")).not.toBeNull();

    const deleted = store.deleteAgentConfig("delete-agent");
    expect(deleted).toBe(true);
    expect(store.getAgentConfig("delete-agent")).toBeNull();
  });

  it("returns false when deleting non-existent config", async () => {
    const store = await import("@/lib/agent-config-store");
    const deleted = store.deleteAgentConfig("never-existed");
    expect(deleted).toBe(false);
  });

  it("persists skills array as JSON", async () => {
    const store = await import("@/lib/agent-config-store");

    store.setAgentConfig("skills-agent", {
      skills: ["skill-a", "skill-b"],
    });

    const config = store.getAgentConfig("skills-agent");
    expect(config?.skills).toEqual(["skill-a", "skill-b"]);
  });

  it("resets config to defaults", async () => {
    const store = await import("@/lib/agent-config-store");

    store.setAgentConfig("reset-agent", {
      model: "custom-model",
      temperature: 1.5,
      maxTokens: 50000,
    });

    const reset = store.resetAgentConfigToDefault("reset-agent");

    expect(reset.model).toBe(store.DEFAULT_CONFIG.model);
    expect(reset.temperature).toBe(store.DEFAULT_CONFIG.temperature);
    expect(reset.maxTokens).toBe(store.DEFAULT_CONFIG.maxTokens);
  });

  it("getAllAgentConfigs returns all configs", async () => {
    const store = await import("@/lib/agent-config-store");

    store.setAgentConfig("agent-1", { model: "model-1" });
    store.setAgentConfig("agent-2", { model: "model-2" });

    const all = store.getAllAgentConfigs();
    expect(all.length).toBeGreaterThanOrEqual(2);
    expect(all.map((c) => c.agentId)).toContain("agent-1");
    expect(all.map((c) => c.agentId)).toContain("agent-2");
  });

  it("persists config across reconnections", async () => {
    const store = await import("@/lib/agent-config-store");

    store.setAgentConfig("persist-agent", {
      model: "persistent-model",
      temperature: 0.9,
    });

    store.closeDb();

    const store2 = await import("@/lib/agent-config-store");
    const config = store2.getAgentConfig("persist-agent");
    expect(config?.model).toBe("persistent-model");
    expect(config?.temperature).toBe(0.9);
  });
});

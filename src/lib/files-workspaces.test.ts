import { promises as fs } from "fs";
import os from "os";
import path from "path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_OPENCLAW_DIR = process.env.OPENCLAW_DIR;
const ORIGINAL_ALLOWLIST = process.env.FILES_WORKSPACE_ALLOWLIST;

async function importFilesWorkspaces() {
  vi.resetModules();
  return import("./files-workspaces");
}

describe("files-workspaces", () => {
  let openclawDir = "";

  beforeEach(async () => {
    openclawDir = await fs.mkdtemp(path.join(os.tmpdir(), "superbotijo-workspaces-"));
    process.env.OPENCLAW_DIR = openclawDir;
    delete process.env.FILES_WORKSPACE_ALLOWLIST;

    await fs.mkdir(path.join(openclawDir, "workspace"), { recursive: true });
  });

  afterEach(async () => {
    if (ORIGINAL_OPENCLAW_DIR === undefined) {
      delete process.env.OPENCLAW_DIR;
    } else {
      process.env.OPENCLAW_DIR = ORIGINAL_OPENCLAW_DIR;
    }

    if (ORIGINAL_ALLOWLIST === undefined) {
      delete process.env.FILES_WORKSPACE_ALLOWLIST;
    } else {
      process.env.FILES_WORKSPACE_ALLOWLIST = ORIGINAL_ALLOWLIST;
    }

    vi.resetModules();
    vi.restoreAllMocks();
    await fs.rm(openclawDir, { recursive: true, force: true });
  });

  it("blocks path traversal and absolute paths", async () => {
    const { resolveWorkspacePath } = await importFilesWorkspaces();

    await expect(resolveWorkspacePath("workspace", "../secret.txt")).resolves.toBeNull();
    await expect(resolveWorkspacePath("workspace", "/tmp/secret.txt")).resolves.toBeNull();
  });

  it("blocks escaping workspace through symlink", async () => {
    const outsideDir = await fs.mkdtemp(path.join(os.tmpdir(), "superbotijo-outside-"));

    try {
      await fs.writeFile(path.join(outsideDir, "secret.txt"), "secret");
      await fs.symlink(outsideDir, path.join(openclawDir, "workspace", "escape"), "dir");

      const { resolveWorkspacePath } = await importFilesWorkspaces();
      await expect(resolveWorkspacePath("workspace", "escape/secret.txt")).resolves.toBeNull();
    } finally {
      await fs.rm(outsideDir, { recursive: true, force: true });
    }
  });

  it("honors FILES_WORKSPACE_ALLOWLIST and rejects invalid entries", async () => {
    process.env.FILES_WORKSPACE_ALLOWLIST = "docs:workspace-docs,badAbs:/tmp/out,badTraversal:../etc";
    await fs.mkdir(path.join(openclawDir, "workspace-docs"), { recursive: true });

    const { listAvailableWorkspaces, resolveWorkspaceDirectory } = await importFilesWorkspaces();

    const workspaces = await listAvailableWorkspaces();
    const ids = workspaces.map((workspace) => workspace.id);

    expect(ids).toContain("docs");
    expect(ids).not.toContain("badAbs");
    expect(ids).not.toContain("badTraversal");

    await expect(resolveWorkspaceDirectory("docs")).resolves.toMatchObject({
      workspaceId: "docs",
      workspacePath: await fs.realpath(path.join(openclawDir, "workspace-docs")),
    });
  });

  it("resolves legacy aliases superbotijo and openclaw", async () => {
    await fs.mkdir(path.join(openclawDir, "workspace", "superbotijo"), { recursive: true });

    const { resolveWorkspaceDirectory } = await importFilesWorkspaces();

    await expect(resolveWorkspaceDirectory("openclaw")).resolves.toMatchObject({
      workspaceId: "openclaw",
      workspacePath: await fs.realpath(openclawDir),
    });

    await expect(resolveWorkspaceDirectory("superbotijo")).resolves.toMatchObject({
      workspaceId: "superbotijo",
      workspacePath: await fs.realpath(path.join(openclawDir, "workspace", "superbotijo")),
    });
  });

  it("auto-detects workspace and workspace-* directories", async () => {
    await fs.mkdir(path.join(openclawDir, "workspace-frontend"), { recursive: true });
    await fs.mkdir(path.join(openclawDir, "workspace-backend"), { recursive: true });
    await fs.mkdir(path.join(openclawDir, "not-a-workspace"), { recursive: true });

    const { listAvailableWorkspaces, resolveWorkspaceDirectory } = await importFilesWorkspaces();

    const workspaces = await listAvailableWorkspaces();
    const ids = workspaces.map((workspace) => workspace.id);

    expect(ids).toContain("workspace");
    expect(ids).toContain("workspace-frontend");
    expect(ids).toContain("workspace-backend");
    expect(ids).not.toContain("not-a-workspace");

    await expect(resolveWorkspaceDirectory("workspace-frontend")).resolves.toMatchObject({
      workspaceId: "workspace-frontend",
      workspacePath: await fs.realpath(path.join(openclawDir, "workspace-frontend")),
    });
  });
});

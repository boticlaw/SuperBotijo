import { mkdtempSync, mkdirSync, rmSync, symlinkSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { describe, expect, it } from "vitest";

import { validatePath } from "@/lib/safe-exec";

describe("validatePath", () => {
  function withTempWorkspace(run: (workspace: string, root: string) => void): void {
    const root = mkdtempSync(path.join(tmpdir(), "safe-exec-"));
    const workspace = path.join(root, "workspace");
    mkdirSync(workspace, { recursive: true });

    try {
      run(workspace, root);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }

  it("allows paths inside base path", () => {
    withTempWorkspace((workspace) => {
      const repo = path.join(workspace, "repo-a");
      mkdirSync(repo, { recursive: true });
      expect(validatePath(repo, workspace)).toBe(true);
    });
  });

  it("blocks sibling prefix bypasses", () => {
    withTempWorkspace((workspace, root) => {
      const evil = path.join(root, "workspace-evil", "repo-a");
      mkdirSync(evil, { recursive: true });
      expect(validatePath(evil, workspace)).toBe(false);
    });
  });

  it("blocks symlink escapes outside base path", () => {
    withTempWorkspace((workspace, root) => {
      const outside = path.join(root, "outside-repo");
      mkdirSync(outside, { recursive: true });

      const linkInsideWorkspace = path.join(workspace, "repo-link");
      symlinkSync(outside, linkInsideWorkspace, "dir");

      expect(validatePath(linkInsideWorkspace, workspace)).toBe(false);
    });
  });

  it("blocks traversal outside of base path", () => {
    withTempWorkspace((workspace) => {
      const traversal = path.join(workspace, "..", "etc");
      mkdirSync(path.resolve(traversal), { recursive: true });
      expect(validatePath(traversal, workspace)).toBe(false);
    });
  });

  it("blocks null-byte payloads", () => {
    expect(validatePath("/tmp/workspace/repo\0.git", "/tmp/workspace")).toBe(false);
  });
});

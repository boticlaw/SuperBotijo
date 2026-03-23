import { describe, expect, it } from "vitest";

import { validatePath } from "@/lib/safe-exec";

describe("validatePath", () => {
  it("allows paths inside base path", () => {
    expect(validatePath("/tmp/workspace/repo-a", "/tmp/workspace")).toBe(true);
  });

  it("blocks sibling prefix bypasses", () => {
    expect(validatePath("/tmp/workspace-evil/repo-a", "/tmp/workspace")).toBe(false);
  });

  it("blocks traversal outside of base path", () => {
    expect(validatePath("/tmp/workspace/../etc", "/tmp/workspace")).toBe(false);
  });

  it("blocks null-byte payloads", () => {
    expect(validatePath("/tmp/workspace/repo\0.git", "/tmp/workspace")).toBe(false);
  });
});

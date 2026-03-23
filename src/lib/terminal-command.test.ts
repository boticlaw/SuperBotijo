import { describe, expect, it } from "vitest";

import { validateTerminalCommand } from "@/lib/terminal-command";

describe("validateTerminalCommand", () => {
  it("accepts allowlisted command and flags", () => {
    const result = validateTerminalCommand("ls -la /tmp");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.executable).toBe("ls");
      expect(result.args).toEqual(["-la", "/tmp"]);
    }
  });

  it("rejects shell chaining and multiline operators", () => {
    const chained = validateTerminalCommand("ls && id");
    const multiline = validateTerminalCommand("ls\nid");

    expect(chained.ok).toBe(false);
    expect(multiline.ok).toBe(false);
  });

  it("rejects subshell and backticks", () => {
    const subshell = validateTerminalCommand("echo $(id)");
    const backticks = validateTerminalCommand("echo `id`");

    expect(subshell.ok).toBe(false);
    expect(backticks.ok).toBe(false);
  });

  it("rejects redirections", () => {
    const redirect = validateTerminalCommand("ls > out.txt");

    expect(redirect.ok).toBe(false);
    if (!redirect.ok) {
      expect(redirect.status).toBe(400);
    }
  });

  it("rejects disallowed command", () => {
    const result = validateTerminalCommand("node -e \"console.log(1)\"");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
    }
  });

  it("rejects disallowed flag", () => {
    const result = validateTerminalCommand("ls --color=always");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
    }
  });

  it("requires allowed git subcommands", () => {
    const blocked = validateTerminalCommand("git clone https://example.com/repo.git");
    const allowed = validateTerminalCommand("git status --short");

    expect(blocked.ok).toBe(false);
    expect(allowed.ok).toBe(true);
  });
});

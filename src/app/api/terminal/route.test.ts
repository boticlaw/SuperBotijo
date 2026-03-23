import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { POST } from "./route";

function createRequest(command: string): NextRequest {
  return new NextRequest(new URL("http://localhost/api/terminal"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ command }),
  });
}

describe("/api/terminal POST", () => {
  it("executes a simple allowlisted command", async () => {
    const response = await POST(createRequest("echo terminal-ok"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.output).toContain("terminal-ok");
  });

  it("rejects shell operator injection", async () => {
    const response = await POST(createRequest("echo safe; id"));
    expect(response.status).toBe(400);
  });

  it("rejects ampersand chaining payload", async () => {
    const response = await POST(createRequest("ls & id"));
    expect(response.status).toBe(400);
  });

  it("rejects multiline payload", async () => {
    const response = await POST(createRequest("ls\nid"));
    expect(response.status).toBe(400);
  });

  it("rejects pipe payload", async () => {
    const response = await POST(createRequest("ls | wc -l"));
    expect(response.status).toBe(400);
  });

  it("rejects backtick payload", async () => {
    const response = await POST(createRequest("echo `id`"));
    expect(response.status).toBe(400);
  });

  it("rejects redirect payload", async () => {
    const response = await POST(createRequest("ls > /tmp/output"));
    expect(response.status).toBe(400);
  });

  it("rejects command substitution payloads", async () => {
    const response = await POST(createRequest("echo $(id)"));
    expect(response.status).toBe(400);
  });

  it("rejects non-allowlisted base command", async () => {
    const response = await POST(createRequest("node -e \"console.log(1)\""));
    expect(response.status).toBe(403);
  });

  it("rejects non-allowlisted flag for allowed command", async () => {
    const response = await POST(createRequest("ls --color=always"));
    expect(response.status).toBe(403);
  });

  it("executes allowlisted command with allowlisted flags", async () => {
    const response = await POST(createRequest("ls -la"));
    expect(response.status).toBe(200);
  });
});

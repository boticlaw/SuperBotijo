import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { GET } from "./route";
import { resetAgentKeysCache } from "@/lib/agent-auth";
import { clearAllDataForTesting, createTask } from "@/lib/kanban-db";

const previousAgentKeys = process.env.OPENCLAW_AGENT_KEYS;

function createRequest(
  query = "",
  headers: Record<string, string> = {}
): NextRequest {
  return new NextRequest(new URL(`http://localhost/api/heartbeat/tasks${query}`), {
    headers,
  });
}

describe("/api/heartbeat/tasks GET", () => {
  beforeEach(() => {
    clearAllDataForTesting();
    process.env.OPENCLAW_AGENT_KEYS = "agent-a:key-agent-a";
    resetAgentKeysCache();
  });

  afterEach(() => {
    clearAllDataForTesting();

    if (previousAgentKeys === undefined) {
      delete process.env.OPENCLAW_AGENT_KEYS;
    } else {
      process.env.OPENCLAW_AGENT_KEYS = previousAgentKeys;
    }

    resetAgentKeysCache();
  });

  it("requires agent authentication headers", async () => {
    const response = await GET(createRequest());
    expect(response.status).toBe(401);
  });

  it("returns tasks for authenticated agent", async () => {
    createTask({ title: "Task for agent-a", assignee: "agent-a", status: "in_progress" });
    createTask({ title: "Task for agent-b", assignee: "agent-b", status: "in_progress" });

    const response = await GET(createRequest("?agentName=agent-a", {
      "X-Agent-Id": "agent-a",
      "X-Agent-Key": "key-agent-a",
    }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.count).toBe(1);
    expect(data.tasks[0].title).toBe("Task for agent-a");
  });

  it("rejects mismatched agentName query parameter", async () => {
    const response = await GET(createRequest("?agentName=agent-b", {
      "X-Agent-Id": "agent-a",
      "X-Agent-Key": "key-agent-a",
    }));

    expect(response.status).toBe(403);
  });
});

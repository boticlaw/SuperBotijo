import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { PATCH } from "./route";
import { clearAllDataForTesting, createTask, listTaskComments } from "@/lib/kanban-db";
import { resetAgentKeysCache } from "@/lib/agent-auth";

function createMockRequest(
  url: string,
  options?: { method?: string; body?: unknown; headers?: Record<string, string> }
): NextRequest {
  const fullUrl = new URL(url, "http://localhost");
  return new NextRequest(fullUrl, {
    method: options?.method ?? "PATCH",
    body: options?.body ? JSON.stringify(options.body) : undefined,
    headers: {
      ...(options?.body ? { "Content-Type": "application/json" } : {}),
      ...(options?.headers ?? {}),
    },
  });
}

function createParams(id: string): Promise<{ id: string }> {
  return Promise.resolve({ id });
}

describe("/api/kanban/agent/tasks/[id] PATCH", () => {
  const previousAgentKeys = process.env.OPENCLAW_AGENT_KEYS;
  const previousRequireCommentFlag = process.env.FEATURE_REQUIRE_COMMENT_ON_STATUS;

  beforeEach(() => {
    clearAllDataForTesting();
    process.env.OPENCLAW_AGENT_KEYS = "boti:key-boti";
    process.env.FEATURE_REQUIRE_COMMENT_ON_STATUS = "true";
    resetAgentKeysCache();
  });

  afterEach(() => {
    clearAllDataForTesting();

    if (previousAgentKeys === undefined) {
      delete process.env.OPENCLAW_AGENT_KEYS;
    } else {
      process.env.OPENCLAW_AGENT_KEYS = previousAgentKeys;
    }

    if (previousRequireCommentFlag === undefined) {
      delete process.env.FEATURE_REQUIRE_COMMENT_ON_STATUS;
    } else {
      process.env.FEATURE_REQUIRE_COMMENT_ON_STATUS = previousRequireCommentFlag;
    }

    resetAgentKeysCache();
  });

  it("requires comment on critical transition when feature flag is enabled", async () => {
    const task = createTask({ title: "Agent task", status: "in_progress", createdBy: "boti" });
    const request = createMockRequest(`/api/kanban/agent/tasks/${task.id}`, {
      body: { status: "done" },
      headers: {
        "X-Agent-Id": "boti",
        "X-Agent-Key": "key-boti",
      },
    });

    const response = await PATCH(request, { params: createParams(task.id) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("comment is required");
  });

  it("creates status-change comment when transition includes comment", async () => {
    const task = createTask({ title: "Agent task", status: "in_progress", createdBy: "boti" });
    const request = createMockRequest(`/api/kanban/agent/tasks/${task.id}`, {
      body: { status: "review", comment: "PR is ready" },
      headers: {
        "X-Agent-Id": "boti",
        "X-Agent-Key": "key-boti",
      },
    });

    const response = await PATCH(request, { params: createParams(task.id) });

    expect(response.status).toBe(200);

    const comments = listTaskComments({ taskId: task.id, limit: 10 });
    expect(comments.length).toBe(1);
    expect(comments[0].commentType).toBe("status_change");
    expect(comments[0].body).toBe("PR is ready");
    expect(comments[0].statusFrom).toBe("in_progress");
    expect(comments[0].statusTo).toBe("review");
  });
});

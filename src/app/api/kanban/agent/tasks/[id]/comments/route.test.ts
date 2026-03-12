import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "./route";
import { clearAllDataForTesting, createTask } from "@/lib/kanban-db";
import { resetAgentKeysCache } from "@/lib/agent-auth";
import { resetCommentRateLimitForTesting } from "@/lib/kanban-comments";

function createMockRequest(
  url: string,
  options?: { method?: string; body?: unknown; headers?: Record<string, string> }
): NextRequest {
  const fullUrl = new URL(url, "http://localhost");
  return new NextRequest(fullUrl, {
    method: options?.method ?? "GET",
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

describe("/api/kanban/agent/tasks/[id]/comments", () => {
  const previousAgentKeys = process.env.OPENCLAW_AGENT_KEYS;

  beforeEach(() => {
    clearAllDataForTesting();
    resetCommentRateLimitForTesting();
    process.env.OPENCLAW_AGENT_KEYS = "boti:key-boti,leo:key-leo";
    resetAgentKeysCache();
  });

  afterEach(() => {
    clearAllDataForTesting();
    resetCommentRateLimitForTesting();
    if (previousAgentKeys === undefined) {
      delete process.env.OPENCLAW_AGENT_KEYS;
    } else {
      process.env.OPENCLAW_AGENT_KEYS = previousAgentKeys;
    }
    resetAgentKeysCache();
  });

  it("returns 401 when auth headers are missing", async () => {
    const task = createTask({ title: "Task" });
    const request = createMockRequest(`/api/kanban/agent/tasks/${task.id}/comments`);
    const response = await GET(request, { params: createParams(task.id) });

    expect(response.status).toBe(401);
  });

  it("returns 403 when agent is not creator, assignee, or claimer", async () => {
    const task = createTask({ title: "Task", createdBy: "memo" });
    const request = createMockRequest(`/api/kanban/agent/tasks/${task.id}/comments`, {
      headers: {
        "X-Agent-Id": "boti",
        "X-Agent-Key": "key-boti",
      },
    });

    const response = await GET(request, { params: createParams(task.id) });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toContain("Not authorized");
  });

  it("creates and lists comments for authorized agent", async () => {
    const task = createTask({ title: "Task", createdBy: "boti" });

    const postRequest = createMockRequest(`/api/kanban/agent/tasks/${task.id}/comments`, {
      method: "POST",
      body: {
        type: "progress",
        content: "Working on this",
        evidence: "Log trace #42",
        nextAction: "Open PR",
      },
      headers: {
        "X-Agent-Id": "boti",
        "X-Agent-Key": "key-boti",
      },
    });

    const postResponse = await POST(postRequest, { params: createParams(task.id) });
    const postData = await postResponse.json();

    expect(postResponse.status).toBe(201);
    expect(postData.comment.authorType).toBe("agent");
    expect(postData.comment.authorId).toBe("boti");
    expect(postData.comment.metadata.commentType).toBe("progress");

    const getRequest = createMockRequest(`/api/kanban/agent/tasks/${task.id}/comments`, {
      headers: {
        "X-Agent-Id": "boti",
        "X-Agent-Key": "key-boti",
      },
    });

    const getResponse = await GET(getRequest, { params: createParams(task.id) });
    const getData = await getResponse.json();

    expect(getResponse.status).toBe(200);
    expect(getData.comments.length).toBe(1);
    expect(getData.comments[0].body).toBe("Working on this");
  });

  it("rejects comments with potential secrets", async () => {
    const task = createTask({ title: "Task", createdBy: "boti" });

    const request = createMockRequest(`/api/kanban/agent/tasks/${task.id}/comments`, {
      method: "POST",
      body: {
        content: "-----BEGIN PRIVATE KEY-----",
      },
      headers: {
        "X-Agent-Id": "boti",
        "X-Agent-Key": "key-boti",
      },
    });

    const response = await POST(request, { params: createParams(task.id) });
    expect(response.status).toBe(400);
  });

  it("enforces agent comment rate limit", async () => {
    const task = createTask({ title: "Task", createdBy: "boti" });

    for (let i = 0; i < 24; i++) {
      const request = createMockRequest(`/api/kanban/agent/tasks/${task.id}/comments`, {
        method: "POST",
        body: { content: `update ${i}` },
        headers: {
          "X-Agent-Id": "boti",
          "X-Agent-Key": "key-boti",
        },
      });

      const response = await POST(request, { params: createParams(task.id) });
      expect(response.status).toBe(201);
    }

    const blockedRequest = createMockRequest(`/api/kanban/agent/tasks/${task.id}/comments`, {
      method: "POST",
      body: { content: "too many" },
      headers: {
        "X-Agent-Id": "boti",
        "X-Agent-Key": "key-boti",
      },
    });

    const blockedResponse = await POST(blockedRequest, { params: createParams(task.id) });
    expect(blockedResponse.status).toBe(429);
  });
});

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "./route";
import { clearAllDataForTesting, createTask } from "@/lib/kanban-db";
import { resetCommentRateLimitForTesting } from "@/lib/kanban-comments";
import { sessionStore } from "@/lib/session-store";

let authToken = "";
const previousAuthSecret = process.env.AUTH_SECRET;

function createMockRequest(
  url: string,
  options?: { method?: string; body?: unknown; headers?: Record<string, string> }
): NextRequest {
  const fullUrl = new URL(url, "http://localhost");
  return new NextRequest(fullUrl, {
    method: options?.method ?? "GET",
    body: options?.body ? JSON.stringify(options.body) : undefined,
    headers: {
      Authorization: `Bearer ${authToken}`,
      ...(options?.body ? { "Content-Type": "application/json" } : {}),
      ...(options?.headers ?? {}),
    },
  });
}

function createParams(id: string): Promise<{ id: string }> {
  return Promise.resolve({ id });
}

describe("/api/kanban/tasks/[id]/comments", () => {
  beforeEach(async () => {
    clearAllDataForTesting();
    resetCommentRateLimitForTesting();
    process.env.AUTH_SECRET = "test-secret-123456789012345678901234567890";
    authToken = await sessionStore.generateToken();
  });

  afterEach(() => {
    clearAllDataForTesting();
    resetCommentRateLimitForTesting();
    sessionStore.clearRevoked();

    if (previousAuthSecret === undefined) {
      delete process.env.AUTH_SECRET;
    } else {
      process.env.AUTH_SECRET = previousAuthSecret;
    }
  });

  it("creates and lists comments for a task", async () => {
    const task = createTask({ title: "Task with comments" });

    const postRequest = createMockRequest(`/api/kanban/tasks/${task.id}/comments`, {
      method: "POST",
      body: {
        type: "progress",
        content: "Looks good",
        evidence: "PR #123",
        nextAction: "Wait for review",
      },
    });

    const postResponse = await POST(postRequest, { params: createParams(task.id) });
    expect(postResponse).toBeDefined();
    const postData = await postResponse!.json();

    expect(postResponse!.status).toBe(201);
    expect(postData.comment.body).toBe("Looks good");
    expect(postData.comment.metadata.commentType).toBe("progress");

    const getRequest = createMockRequest(`/api/kanban/tasks/${task.id}/comments?limit=10`);
    const getResponse = await GET(getRequest, { params: createParams(task.id) });
    expect(getResponse).toBeDefined();
    const getData = await getResponse!.json();

    expect(getResponse!.status).toBe(200);
    expect(getData.comments.length).toBe(1);
    expect(getData.comments[0].body).toBe("Looks good");
  });

  it("returns 404 for unknown task", async () => {
    const request = createMockRequest("/api/kanban/tasks/missing/comments");
    const response = await GET(request, { params: createParams("missing") });
    expect(response).toBeDefined();
    const data = await response!.json();

    expect(response!.status).toBe(404);
    expect(data.error).toBe("Task not found");
  });

  it("rejects comments that contain secrets", async () => {
    const task = createTask({ title: "Task with comments" });

    const request = createMockRequest(`/api/kanban/tasks/${task.id}/comments`, {
      method: "POST",
      body: {
        type: "note",
        content: "token=sk-supersecretvalue123456789",
      },
    });

    const response = await POST(request, { params: createParams(task.id) });
    expect(response).toBeDefined();
    const data = await response!.json();

    expect(response!.status).toBe(400);
    expect(data.error).toContain("Comment rejected");
  });

  it("applies rate limit to comment creation", async () => {
    const task = createTask({ title: "Task with comments" });

    for (let i = 0; i < 12; i++) {
      const request = createMockRequest(`/api/kanban/tasks/${task.id}/comments`, {
        method: "POST",
        body: { content: `comment ${i}` },
      });

      const response = await POST(request, { params: createParams(task.id) });
      expect(response).toBeDefined();
      expect(response!.status).toBe(201);
    }

    const blockedRequest = createMockRequest(`/api/kanban/tasks/${task.id}/comments`, {
      method: "POST",
      body: { content: "this should fail" },
    });

    const blockedResponse = await POST(blockedRequest, { params: createParams(task.id) });
    expect(blockedResponse).toBeDefined();
    expect(blockedResponse!.status).toBe(429);
  });
});

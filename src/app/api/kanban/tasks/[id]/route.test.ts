import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, PUT, DELETE } from "./route";
import { clearAllDataForTesting, createTask, listTaskComments } from "@/lib/kanban-db";

function createMockRequest(url: string, options?: { method?: string; body?: unknown }): NextRequest {
  const fullUrl = new URL(url, "http://localhost");
  return new NextRequest(fullUrl, {
    method: options?.method ?? "GET",
    body: options?.body ? JSON.stringify(options.body) : undefined,
    headers: options?.body ? { "Content-Type": "application/json" } : undefined,
  });
}

function createParams(id: string): Promise<{ id: string }> {
  return Promise.resolve({ id });
}

describe("/api/kanban/tasks/[id]", () => {
  const previousRequireCommentFlag = process.env.FEATURE_REQUIRE_COMMENT_ON_STATUS;

  beforeEach(() => {
    clearAllDataForTesting();
    delete process.env.FEATURE_REQUIRE_COMMENT_ON_STATUS;
  });

  afterEach(() => {
    clearAllDataForTesting();
    if (previousRequireCommentFlag === undefined) {
      delete process.env.FEATURE_REQUIRE_COMMENT_ON_STATUS;
    } else {
      process.env.FEATURE_REQUIRE_COMMENT_ON_STATUS = previousRequireCommentFlag;
    }
  });

  describe("GET", () => {
    it("returns task by id", async () => {
      const task = createTask({ title: "Test task" });
      const request = createMockRequest(`/api/kanban/tasks/${task.id}`);
      const response = await GET(request, { params: createParams(task.id) });
      expect(response).toBeDefined();
      const data = await response!.json();

      expect(response!.status).toBe(200);
      expect(data.task.id).toBe(task.id);
      expect(data.task.title).toBe("Test task");
    });

    it("returns 404 for non-existent task", async () => {
      const request = createMockRequest("/api/kanban/tasks/non-existent-id");
      const response = await GET(request, { params: createParams("non-existent-id") });
      expect(response).toBeDefined();
      const data = await response!.json();

      expect(response!.status).toBe(404);
      expect(data.error).toBe("Task not found");
    });
  });

  describe("PUT", () => {
    it("updates task title", async () => {
      const task = createTask({ title: "Test task" });
      const request = createMockRequest(`/api/kanban/tasks/${task.id}`, {
        method: "PUT",
        body: { title: "Updated title" },
      });
      const response = await PUT(request, { params: createParams(task.id) });
      expect(response).toBeDefined();
      const data = await response!.json();

      expect(response!.status).toBe(200);
      expect(data.task.title).toBe("Updated title");
    });

    it("updates task description", async () => {
      const task = createTask({ title: "Test task" });
      const request = createMockRequest(`/api/kanban/tasks/${task.id}`, {
        method: "PUT",
        body: { description: "New description" },
      });
      const response = await PUT(request, { params: createParams(task.id) });
      expect(response).toBeDefined();
      const data = await response!.json();

      expect(response!.status).toBe(200);
      expect(data.task.description).toBe("New description");
    });

    it("updates task status", async () => {
      const task = createTask({ title: "Test task" });
      const request = createMockRequest(`/api/kanban/tasks/${task.id}`, {
        method: "PUT",
        body: { status: "done" },
      });
      const response = await PUT(request, { params: createParams(task.id) });
      expect(response).toBeDefined();
      const data = await response!.json();

      expect(response!.status).toBe(200);
      expect(data.task.status).toBe("done");
    });

    it("updates task priority", async () => {
      const task = createTask({ title: "Test task" });
      const request = createMockRequest(`/api/kanban/tasks/${task.id}`, {
        method: "PUT",
        body: { priority: "critical" },
      });
      const response = await PUT(request, { params: createParams(task.id) });
      expect(response).toBeDefined();
      const data = await response!.json();

      expect(response!.status).toBe(200);
      expect(data.task.priority).toBe("critical");
    });

    it("updates task assignee", async () => {
      const task = createTask({ title: "Test task" });
      const request = createMockRequest(`/api/kanban/tasks/${task.id}`, {
        method: "PUT",
        body: { assignee: "Jane Doe" },
      });
      const response = await PUT(request, { params: createParams(task.id) });
      expect(response).toBeDefined();
      const data = await response!.json();

      expect(response!.status).toBe(200);
      expect(data.task.assignee).toBe("Jane Doe");
    });

    it("updates task labels", async () => {
      const task = createTask({ title: "Test task" });
      const request = createMockRequest(`/api/kanban/tasks/${task.id}`, {
        method: "PUT",
        body: { labels: [{ name: "feature", color: "#00ff00" }] },
      });
      const response = await PUT(request, { params: createParams(task.id) });
      expect(response).toBeDefined();
      const data = await response!.json();

      expect(response!.status).toBe(200);
      expect(data.task.labels).toEqual([{ name: "feature", color: "#00ff00" }]);
    });

    it("updates multiple fields at once", async () => {
      const task = createTask({ title: "Test task" });
      const request = createMockRequest(`/api/kanban/tasks/${task.id}`, {
        method: "PUT",
        body: {
          title: "Multi update",
          description: "New desc",
          status: "review",
          priority: "high",
        },
      });
      const response = await PUT(request, { params: createParams(task.id) });
      expect(response).toBeDefined();
      const data = await response!.json();

      expect(response!.status).toBe(200);
      expect(data.task.title).toBe("Multi update");
      expect(data.task.description).toBe("New desc");
      expect(data.task.status).toBe("review");
      expect(data.task.priority).toBe("high");
    });

    it("returns 404 for non-existent task", async () => {
      const request = createMockRequest("/api/kanban/tasks/non-existent-id", {
        method: "PUT",
        body: { title: "New title" },
      });
      const response = await PUT(request, { params: createParams("non-existent-id") });
      expect(response).toBeDefined();
      const data = await response!.json();

      expect(response!.status).toBe(404);
      expect(data.error).toBe("Task not found");
    });

    it("returns 400 when title is empty string", async () => {
      const task = createTask({ title: "Test task" });
      const request = createMockRequest(`/api/kanban/tasks/${task.id}`, {
        method: "PUT",
        body: { title: "" },
      });
      const response = await PUT(request, { params: createParams(task.id) });
      expect(response).toBeDefined();
      const data = await response!.json();

      expect(response!.status).toBe(400);
      expect(data.error).toBe("Title must be a non-empty string");
    });

    it("returns 400 when title exceeds 200 characters", async () => {
      const task = createTask({ title: "Test task" });
      const request = createMockRequest(`/api/kanban/tasks/${task.id}`, {
        method: "PUT",
        body: { title: "a".repeat(201) },
      });
      const response = await PUT(request, { params: createParams(task.id) });
      expect(response).toBeDefined();
      const data = await response!.json();

      expect(response!.status).toBe(400);
      expect(data.error).toBe("Title must be 200 characters or less");
    });

    it("returns 400 when priority is invalid", async () => {
      const task = createTask({ title: "Test task" });
      const request = createMockRequest(`/api/kanban/tasks/${task.id}`, {
        method: "PUT",
        body: { priority: "invalid" },
      });
      const response = await PUT(request, { params: createParams(task.id) });
      expect(response).toBeDefined();
      const data = await response!.json();

      expect(response!.status).toBe(400);
      expect(data.error).toContain("Invalid priority");
    });

    it("returns unchanged task when no updates provided", async () => {
      const task = createTask({ title: "Test task" });
      const request = createMockRequest(`/api/kanban/tasks/${task.id}`, {
        method: "PUT",
        body: {},
      });
      const response = await PUT(request, { params: createParams(task.id) });
      expect(response).toBeDefined();
      const data = await response!.json();

      expect(response!.status).toBe(200);
      expect(data.task.title).toBe("Test task");
    });

    it("requires comment for critical status transition when feature flag is enabled", async () => {
      process.env.FEATURE_REQUIRE_COMMENT_ON_STATUS = "true";

      const task = createTask({ title: "Test task", status: "in_progress" });
      const request = createMockRequest(`/api/kanban/tasks/${task.id}`, {
        method: "PUT",
        body: { status: "done" },
      });
      const response = await PUT(request, { params: createParams(task.id) });
      expect(response).toBeDefined();
      const data = await response!.json();

      expect(response!.status).toBe(400);
      expect(data.error).toContain("comment is required");
    });

    it("stores transition comment when moving to critical status", async () => {
      process.env.FEATURE_REQUIRE_COMMENT_ON_STATUS = "true";

      const task = createTask({ title: "Test task", status: "in_progress" });
      const request = createMockRequest(`/api/kanban/tasks/${task.id}`, {
        method: "PUT",
        body: { status: "review", comment: "Ready for review" },
      });
      const response = await PUT(request, { params: createParams(task.id) });
      expect(response).toBeDefined();
      const data = await response!.json();

      expect(response!.status).toBe(200);
      expect(data.task.status).toBe("review");

      const comments = listTaskComments({ taskId: task.id, limit: 10 });
      expect(comments.length).toBe(1);
      expect(comments[0].body).toBe("Ready for review");
      expect(comments[0].commentType).toBe("status_change");
      expect(comments[0].statusFrom).toBe("in_progress");
      expect(comments[0].statusTo).toBe("review");
    });
  });

  describe("DELETE", () => {
    it("deletes an existing task", async () => {
      const task = createTask({ title: "Test task" });
      const request = createMockRequest(`/api/kanban/tasks/${task.id}`, {
        method: "DELETE",
      });
      const response = await DELETE(request, { params: createParams(task.id) });
      expect(response).toBeDefined();
      const data = await response!.json();

      expect(response!.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.deleted).toBe(task.id);
    });

    it("returns 404 for non-existent task", async () => {
      const request = createMockRequest("/api/kanban/tasks/non-existent-id", {
        method: "DELETE",
      });
      const response = await DELETE(request, { params: createParams("non-existent-id") });
      expect(response).toBeDefined();
      const data = await response!.json();

      expect(response!.status).toBe(404);
      expect(data.error).toBe("Task not found");
    });

    it("task is actually deleted from database", async () => {
      const task = createTask({ title: "Test task" });
      const request = createMockRequest(`/api/kanban/tasks/${task.id}`, {
        method: "DELETE",
      });
      await DELETE(request, { params: createParams(task.id) });

      const getRequest = createMockRequest(`/api/kanban/tasks/${task.id}`);
      const getResponse = await GET(getRequest, { params: createParams(task.id) });
      expect(getResponse).toBeDefined();

      expect(getResponse!.status).toBe(404);
    });
  });
});

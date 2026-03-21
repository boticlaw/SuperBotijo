import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { clearAllDataForTesting, createTask } from "@/lib/kanban-db";

function createMockRequest(url: string, options?: { method?: string; body?: unknown }): NextRequest {
  const fullUrl = new URL(url, "http://localhost");
  return new NextRequest(fullUrl, {
    method: options?.method ?? "POST",
    body: options?.body ? JSON.stringify(options.body) : undefined,
    headers: options?.body ? { "Content-Type": "application/json" } : undefined,
  });
}

function createParams(id: string): Promise<{ id: string }> {
  return Promise.resolve({ id });
}

describe("/api/kanban/tasks/[id]/move", () => {
  beforeEach(() => {
    clearAllDataForTesting();
  });

  afterEach(() => {
    clearAllDataForTesting();
  });

  describe("POST", () => {
    it("moves task to different column", async () => {
      const task = createTask({ title: "Test task", status: "backlog" });
      const request = createMockRequest(`/api/kanban/tasks/${task.id}/move`, {
        method: "POST",
        body: { targetColumnId: "done" },
      });
      const response = await POST(request, { params: createParams(task.id) });
      expect(response).toBeDefined();
      const data = await response!.json();

      expect(response!.status).toBe(200);
      expect(data.task.status).toBe("done");
    });

    it("moves task to same column at different position", async () => {
      const task = createTask({ title: "Test task", status: "backlog" });
      const request = createMockRequest(`/api/kanban/tasks/${task.id}/move`, {
        method: "POST",
        body: { targetColumnId: "backlog", targetOrder: 500 },
      });
      const response = await POST(request, { params: createParams(task.id) });
      expect(response).toBeDefined();
      const data = await response!.json();

      expect(response!.status).toBe(200);
      expect(data.task.status).toBe("backlog");
    });

    it("moves task with explicit target order", async () => {
      const task = createTask({ title: "Test task", status: "backlog" });
      const request = createMockRequest(`/api/kanban/tasks/${task.id}/move`, {
        method: "POST",
        body: { targetColumnId: "in_progress", targetOrder: 1500 },
      });
      const response = await POST(request, { params: createParams(task.id) });
      expect(response).toBeDefined();
      const data = await response!.json();

      expect(response!.status).toBe(200);
      expect(data.task.status).toBe("in_progress");
    });

    it("returns 404 for non-existent task", async () => {
      const request = createMockRequest("/api/kanban/tasks/non-existent/move", {
        method: "POST",
        body: { targetColumnId: "done" },
      });
      const response = await POST(request, { params: createParams("non-existent") });
      expect(response).toBeDefined();
      const data = await response!.json();

      expect(response!.status).toBe(404);
      expect(data.error).toBe("Task or target column not found");
    });

    it("returns 404 for non-existent target column", async () => {
      const task = createTask({ title: "Test task" });
      const request = createMockRequest(`/api/kanban/tasks/${task.id}/move`, {
        method: "POST",
        body: { targetColumnId: "non-existent-column" },
      });
      const response = await POST(request, { params: createParams(task.id) });
      expect(response).toBeDefined();
      const data = await response!.json();

      expect(response!.status).toBe(404);
      expect(data.error).toBe("Task or target column not found");
    });

    it("returns 400 when targetColumnId is missing", async () => {
      const task = createTask({ title: "Test task" });
      const request = createMockRequest(`/api/kanban/tasks/${task.id}/move`, {
        method: "POST",
        body: {},
      });
      const response = await POST(request, { params: createParams(task.id) });
      expect(response).toBeDefined();
      const data = await response!.json();

      expect(response!.status).toBe(400);
      expect(data.error).toBe("targetColumnId is required");
    });

    it("returns 400 when targetColumnId is not a string", async () => {
      const task = createTask({ title: "Test task" });
      const request = createMockRequest(`/api/kanban/tasks/${task.id}/move`, {
        method: "POST",
        body: { targetColumnId: 123 },
      });
      const response = await POST(request, { params: createParams(task.id) });
      expect(response).toBeDefined();
      const data = await response!.json();

      expect(response!.status).toBe(400);
      expect(data.error).toBe("targetColumnId is required");
    });

    it("returns 400 when targetOrder is not a number", async () => {
      const task = createTask({ title: "Test task" });
      const request = createMockRequest(`/api/kanban/tasks/${task.id}/move`, {
        method: "POST",
        body: { targetColumnId: "done", targetOrder: "not-a-number" },
      });
      const response = await POST(request, { params: createParams(task.id) });
      expect(response).toBeDefined();
      const data = await response!.json();

      expect(response!.status).toBe(400);
      expect(data.error).toBe("targetOrder must be a number if provided");
    });

    it("accepts targetOrder as 0", async () => {
      const task = createTask({ title: "Test task" });
      const request = createMockRequest(`/api/kanban/tasks/${task.id}/move`, {
        method: "POST",
        body: { targetColumnId: "done", targetOrder: 0 },
      });
      const response = await POST(request, { params: createParams(task.id) });
      expect(response).toBeDefined();
      const data = await response!.json();

      expect(response!.status).toBe(200);
      expect(data.task.status).toBe("done");
    });

    it("appends at end when targetOrder is not provided", async () => {
      createTask({ status: "done", title: "Existing task" });
      
      const task = createTask({ status: "backlog", title: "To move" });
      const request = createMockRequest(`/api/kanban/tasks/${task.id}/move`, {
        method: "POST",
        body: { targetColumnId: "done" },
      });
      const response = await POST(request, { params: createParams(task.id) });
      expect(response).toBeDefined();
      const data = await response!.json();

      expect(response!.status).toBe(200);
      expect(data.task.status).toBe("done");
      expect(data.task.order).toBeGreaterThan(1000);
    });
  });
});

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "./route";
import { clearAllDataForTesting } from "@/lib/kanban-db";
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

describe("/api/kanban/tasks", () => {
  beforeEach(async () => {
    clearAllDataForTesting();
    process.env.AUTH_SECRET = "test-secret-123456789012345678901234567890";
    authToken = await sessionStore.generateToken();
  });

  afterEach(() => {
    clearAllDataForTesting();
    sessionStore.clearRevoked();

    if (previousAuthSecret === undefined) {
      delete process.env.AUTH_SECRET;
    } else {
      process.env.AUTH_SECRET = previousAuthSecret;
    }
  });

  describe("GET", () => {
    it("returns empty tasks array when no tasks exist", async () => {
      const request = createMockRequest("/api/kanban/tasks");
      const response = await GET(request);
      expect(response).toBeDefined();
      const data = await response!.json();

      expect(response!.status).toBe(200);
      expect(data.tasks).toEqual([]);
    });

    it("returns all tasks", async () => {
      const createRequest1 = createMockRequest("/api/kanban/tasks", {
        method: "POST",
        body: { title: "Task 1" },
      });
      const createRequest2 = createMockRequest("/api/kanban/tasks", {
        method: "POST",
        body: { title: "Task 2" },
      });
      await POST(createRequest1);
      await POST(createRequest2);

      const request = createMockRequest("/api/kanban/tasks");
      const response = await GET(request);
      expect(response).toBeDefined();
      const data = await response!.json();

      expect(response!.status).toBe(200);
      expect(data.tasks.length).toBe(2);
    });

    it("filters by status", async () => {
      const createRequest1 = createMockRequest("/api/kanban/tasks", {
        method: "POST",
        body: { title: "Backlog task", status: "backlog" },
      });
      const createRequest2 = createMockRequest("/api/kanban/tasks", {
        method: "POST",
        body: { title: "Done task", status: "done" },
      });
      await POST(createRequest1);
      await POST(createRequest2);

      const request = createMockRequest("/api/kanban/tasks?status=backlog");
      const response = await GET(request);
      expect(response).toBeDefined();
      const data = await response!.json();

      expect(data.tasks.length).toBe(1);
      expect(data.tasks[0].status).toBe("backlog");
    });

    it("filters by columnId (alias for status)", async () => {
      const createRequest = createMockRequest("/api/kanban/tasks", {
        method: "POST",
        body: { title: "Task", status: "in_progress" },
      });
      await POST(createRequest);

      const request = createMockRequest("/api/kanban/tasks?columnId=in_progress");
      const response = await GET(request);
      expect(response).toBeDefined();
      const data = await response!.json();

      expect(data.tasks.length).toBe(1);
      expect(data.tasks[0].status).toBe("in_progress");
    });

    it("filters by assignee", async () => {
      const createRequest1 = createMockRequest("/api/kanban/tasks", {
        method: "POST",
        body: { title: "John's task", assignee: "John" },
      });
      const createRequest2 = createMockRequest("/api/kanban/tasks", {
        method: "POST",
        body: { title: "Jane's task", assignee: "Jane" },
      });
      await POST(createRequest1);
      await POST(createRequest2);

      const request = createMockRequest("/api/kanban/tasks?assignee=John");
      const response = await GET(request);
      expect(response).toBeDefined();
      const data = await response!.json();

      expect(data.tasks.length).toBe(1);
      expect(data.tasks[0].assignee).toBe("John");
    });

    it("filters by priority", async () => {
      const createRequest1 = createMockRequest("/api/kanban/tasks", {
        method: "POST",
        body: { title: "High task", priority: "high" },
      });
      const createRequest2 = createMockRequest("/api/kanban/tasks", {
        method: "POST",
        body: { title: "Low task", priority: "low" },
      });
      await POST(createRequest1);
      await POST(createRequest2);

      const request = createMockRequest("/api/kanban/tasks?priority=high");
      const response = await GET(request);
      expect(response).toBeDefined();
      const data = await response!.json();

      expect(data.tasks.length).toBe(1);
      expect(data.tasks[0].priority).toBe("high");
    });

    it("filters by search term", async () => {
      const createRequest1 = createMockRequest("/api/kanban/tasks", {
        method: "POST",
        body: { title: "Fix authentication bug" },
      });
      const createRequest2 = createMockRequest("/api/kanban/tasks", {
        method: "POST",
        body: { title: "Add new feature" },
      });
      await POST(createRequest1);
      await POST(createRequest2);

      const request = createMockRequest("/api/kanban/tasks?search=bug");
      const response = await GET(request);
      expect(response).toBeDefined();
      const data = await response!.json();

      expect(data.tasks.length).toBe(1);
      expect(data.tasks[0].title).toBe("Fix authentication bug");
    });

    it("combines multiple filters", async () => {
      const createRequest1 = createMockRequest("/api/kanban/tasks", {
        method: "POST",
        body: { title: "Bug in auth", status: "backlog", priority: "high" },
      });
      const createRequest2 = createMockRequest("/api/kanban/tasks", {
        method: "POST",
        body: { title: "Bug in UI", status: "in_progress", priority: "high" },
      });
      await POST(createRequest1);
      await POST(createRequest2);

      const request = createMockRequest("/api/kanban/tasks?status=backlog&priority=high");
      const response = await GET(request);
      expect(response).toBeDefined();
      const data = await response!.json();

      expect(data.tasks.length).toBe(1);
      expect(data.tasks[0].title).toBe("Bug in auth");
    });
  });

  describe("POST", () => {
    it("creates a task with required fields only", async () => {
      const request = createMockRequest("/api/kanban/tasks", {
        method: "POST",
        body: { title: "New task" },
      });
      const response = await POST(request);
      expect(response).toBeDefined();
      const data = await response!.json();

      expect(response!.status).toBe(201);
      expect(data.task.id).toBeDefined();
      expect(data.task.title).toBe("New task");
      expect(data.task.status).toBe("backlog");
      expect(data.task.priority).toBe("medium");
    });

    it("creates a task with all optional fields", async () => {
      const request = createMockRequest("/api/kanban/tasks", {
        method: "POST",
        body: {
          title: "Full task",
          description: "Description",
          status: "in_progress",
          priority: "high",
          assignee: "John Doe",
          labels: [{ name: "bug", color: "#ff0000" }],
        },
      });
      const response = await POST(request);
      expect(response).toBeDefined();
      const data = await response!.json();

      expect(response!.status).toBe(201);
      expect(data.task.title).toBe("Full task");
      expect(data.task.description).toBe("Description");
      expect(data.task.status).toBe("in_progress");
      expect(data.task.priority).toBe("high");
      expect(data.task.assignee).toBe("John Doe");
      expect(data.task.labels).toEqual([{ name: "bug", color: "#ff0000" }]);
    });

    it("returns 400 when title is missing", async () => {
      const request = createMockRequest("/api/kanban/tasks", {
        method: "POST",
        body: {},
      });
      const response = await POST(request);
      expect(response).toBeDefined();
      const data = await response!.json();

      expect(response!.status).toBe(400);
      expect(data.error).toBe("Validation error");
      expect(data.details).toBeDefined();
    });

    it("returns 400 when title is not a string", async () => {
      const request = createMockRequest("/api/kanban/tasks", {
        method: "POST",
        body: { title: 123 },
      });
      const response = await POST(request);
      expect(response).toBeDefined();
      const data = await response!.json();

      expect(response!.status).toBe(400);
      expect(data.error).toBe("Validation error");
      expect(data.details).toBeDefined();
    });

    it("returns 400 when title exceeds 200 characters", async () => {
      const request = createMockRequest("/api/kanban/tasks", {
        method: "POST",
        body: { title: "a".repeat(201) },
      });
      const response = await POST(request);
      expect(response).toBeDefined();
      const data = await response!.json();

      expect(response!.status).toBe(400);
      expect(data.error).toBe("Validation error");
      expect(data.details).toBeDefined();
    });

    it("returns 400 when priority is invalid", async () => {
      const request = createMockRequest("/api/kanban/tasks", {
        method: "POST",
        body: { title: "Task", priority: "invalid" },
      });
      const response = await POST(request);
      expect(response).toBeDefined();
      const data = await response!.json();

      expect(response!.status).toBe(400);
      expect(data.error).toBe("Validation error");
      expect(data.details).toBeDefined();
    });

    it("accepts all valid priority levels", async () => {
      const priorities = ["low", "medium", "high", "critical"];

      for (const priority of priorities) {
        const request = createMockRequest("/api/kanban/tasks", {
          method: "POST",
          body: { title: `Task ${priority}`, priority },
        });
        const response = await POST(request);
        expect(response).toBeDefined();
        const data = await response!.json();

        expect(response!.status).toBe(201);
        expect(data.task.priority).toBe(priority);
      }
    });
  });
});

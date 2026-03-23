import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { POST, DELETE } from "./route";
import { clearAllDataForTesting, createTask, claimTask } from "@/lib/kanban-db";
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

describe("/api/kanban/tasks/[id]/claim", () => {
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

  describe("POST", () => {
    it("returns 200 and claims task successfully", async () => {
      const task = createTask({ title: "Test task" });
      const request = createMockRequest(`/api/kanban/tasks/${task.id}/claim`, {
        method: "POST",
        body: { agentName: "agent-1" },
      });

      const response = await POST(request, { params: createParams(task.id) });
      expect(response).toBeDefined();
      const data = await response!.json();

      expect(response!.status).toBe(200);
      expect(data.task.claimedBy).toBe("agent-1");
      expect(data.task.claimedAt).toBeDefined();
    });

    it("returns 404 for non-existent task", async () => {
      const request = createMockRequest(
        "/api/kanban/tasks/non-existent/claim",
        {
          method: "POST",
          body: { agentName: "agent-1" },
        }
      );

      const response = await POST(request, {
        params: createParams("non-existent"),
      });
      expect(response).toBeDefined();
      const data = await response!.json();

      expect(response!.status).toBe(404);
      expect(data.error).toBe("Task not found");
    });

    it("returns 409 when task already claimed by another agent", async () => {
      const task = createTask({ title: "Test task" });
      claimTask(task.id, "agent-1");

      const request = createMockRequest(`/api/kanban/tasks/${task.id}/claim`, {
        method: "POST",
        body: { agentName: "agent-2" },
      });

      const response = await POST(request, { params: createParams(task.id) });
      expect(response).toBeDefined();
      const data = await response!.json();

      expect(response!.status).toBe(409);
      expect(data.error).toBe("Task already claimed by another agent");
      expect(data.claimedBy).toBe("agent-1");
    });

    it("returns 200 when same agent re-claims (idempotent)", async () => {
      const task = createTask({ title: "Test task" });
      claimTask(task.id, "agent-1");

      const request = createMockRequest(`/api/kanban/tasks/${task.id}/claim`, {
        method: "POST",
        body: { agentName: "agent-1" },
      });

      const response = await POST(request, { params: createParams(task.id) });
      expect(response).toBeDefined();
      const data = await response!.json();

      expect(response!.status).toBe(200);
      expect(data.task.claimedBy).toBe("agent-1");
    });

    it("returns 400 when agentName is missing", async () => {
      const task = createTask({ title: "Test task" });
      const request = createMockRequest(`/api/kanban/tasks/${task.id}/claim`, {
        method: "POST",
        body: {},
      });

      const response = await POST(request, { params: createParams(task.id) });
      expect(response).toBeDefined();
      const data = await response!.json();

      expect(response!.status).toBe(400);
      expect(data.error).toBe("agentName is required and must be a string");
    });

    it("returns 400 when agentName is not a string", async () => {
      const task = createTask({ title: "Test task" });
      const request = createMockRequest(`/api/kanban/tasks/${task.id}/claim`, {
        method: "POST",
        body: { agentName: 123 },
      });

      const response = await POST(request, { params: createParams(task.id) });
      expect(response).toBeDefined();
      const data = await response!.json();

      expect(response!.status).toBe(400);
      expect(data.error).toBe("agentName is required and must be a string");
    });

    it("returns 400 when task id is missing", async () => {
      const request = createMockRequest("/api/kanban/tasks//claim", {
        method: "POST",
        body: { agentName: "agent-1" },
      });

      const response = await POST(request, { params: createParams("") });
      expect(response).toBeDefined();
      const data = await response!.json();

      expect(response!.status).toBe(400);
      expect(data.error).toBe("Task ID is required");
    });
  });

  describe("DELETE", () => {
    it("returns 200 and releases claim successfully", async () => {
      const task = createTask({ title: "Test task" });
      claimTask(task.id, "agent-1");

      const request = createMockRequest(
        `/api/kanban/tasks/${task.id}/claim`,
        {
          method: "DELETE",
          body: { agentName: "agent-1" },
        }
      );

      const response = await DELETE(request, {
        params: createParams(task.id),
      });
      expect(response).toBeDefined();
      const data = await response!.json();

      expect(response!.status).toBe(200);
      expect(data.task.claimedBy).toBeNull();
      expect(data.task.claimedAt).toBeNull();
    });

    it("returns 404 for non-existent task", async () => {
      const request = createMockRequest(
        "/api/kanban/tasks/non-existent/claim",
        {
          method: "DELETE",
          body: { agentName: "agent-1" },
        }
      );

      const response = await DELETE(request, {
        params: createParams("non-existent"),
      });
      expect(response).toBeDefined();
      const data = await response!.json();

      expect(response!.status).toBe(404);
      expect(data.error).toBe("Task not found");
    });

    it("returns 403 when different agent tries to release", async () => {
      const task = createTask({ title: "Test task" });
      claimTask(task.id, "agent-1");

      const request = createMockRequest(
        `/api/kanban/tasks/${task.id}/claim`,
        {
          method: "DELETE",
          body: { agentName: "agent-2" },
        }
      );

      const response = await DELETE(request, {
        params: createParams(task.id),
      });
      expect(response).toBeDefined();
      const data = await response!.json();

      expect(response!.status).toBe(403);
      expect(data.error).toBe("Cannot release claim owned by another agent");
    });

    it("returns 400 when task is not claimed", async () => {
      const task = createTask({ title: "Test task" });

      const request = createMockRequest(
        `/api/kanban/tasks/${task.id}/claim`,
        {
          method: "DELETE",
          body: { agentName: "agent-1" },
        }
      );

      const response = await DELETE(request, {
        params: createParams(task.id),
      });
      expect(response).toBeDefined();
      const data = await response!.json();

      expect(response!.status).toBe(400);
      expect(data.error).toBe("Task is not currently claimed");
    });

    it("returns 400 when agentName is missing", async () => {
      const task = createTask({ title: "Test task" });
      const request = createMockRequest(
        `/api/kanban/tasks/${task.id}/claim`,
        {
          method: "DELETE",
          body: {},
        }
      );

      const response = await DELETE(request, {
        params: createParams(task.id),
      });
      expect(response).toBeDefined();
      const data = await response!.json();

      expect(response!.status).toBe(400);
      expect(data.error).toBe("agentName is required and must be a string");
    });

    it("returns 400 when task id is missing", async () => {
      const request = createMockRequest("/api/kanban/tasks//claim", {
        method: "DELETE",
        body: { agentName: "agent-1" },
      });

      const response = await DELETE(request, { params: createParams("") });
      expect(response).toBeDefined();
      const data = await response!.json();

      expect(response!.status).toBe(400);
      expect(data.error).toBe("Task ID is required");
    });
  });

  describe("full workflow", () => {
    it("supports claim -> release -> claim cycle via API", async () => {
      const task = createTask({ title: "Workflow task" });

      const claimRequest = createMockRequest(
        `/api/kanban/tasks/${task.id}/claim`,
        {
          method: "POST",
          body: { agentName: "agent-1" },
        }
      );
      const claimResponse = await POST(claimRequest, {
        params: createParams(task.id),
      });
      expect(claimResponse).toBeDefined();
      const claimData = await claimResponse!.json();

      expect(claimResponse!.status).toBe(200);
      expect(claimData.task.claimedBy).toBe("agent-1");

      const releaseRequest = createMockRequest(
        `/api/kanban/tasks/${task.id}/claim`,
        {
          method: "DELETE",
          body: { agentName: "agent-1" },
        }
      );
      const releaseResponse = await DELETE(releaseRequest, {
        params: createParams(task.id),
      });
      expect(releaseResponse).toBeDefined();
      const releaseData = await releaseResponse!.json();

      expect(releaseResponse!.status).toBe(200);
      expect(releaseData.task.claimedBy).toBeNull();

      const reclaimRequest = createMockRequest(
        `/api/kanban/tasks/${task.id}/claim`,
        {
          method: "POST",
          body: { agentName: "agent-2" },
        }
      );
      const reclaimResponse = await POST(reclaimRequest, {
        params: createParams(task.id),
      });
      expect(reclaimResponse).toBeDefined();
      const reclaimData = await reclaimResponse!.json();

      expect(reclaimResponse!.status).toBe(200);
      expect(reclaimData.task.claimedBy).toBe("agent-2");
    });

    it("prevents agent B from releasing agent A's claim", async () => {
      const task = createTask({ title: "Protected task" });

      const claimRequest = createMockRequest(
        `/api/kanban/tasks/${task.id}/claim`,
        {
          method: "POST",
          body: { agentName: "agent-A" },
        }
      );
      await POST(claimRequest, { params: createParams(task.id) });

      const releaseRequest = createMockRequest(
        `/api/kanban/tasks/${task.id}/claim`,
        {
          method: "DELETE",
          body: { agentName: "agent-B" },
        }
      );
      const response = await DELETE(releaseRequest, {
        params: createParams(task.id),
      });
      expect(response).toBeDefined();
      const data = await response!.json();

      expect(response!.status).toBe(403);
      expect(data.error).toContain("another agent");
    });
  });
});

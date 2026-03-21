import { describe, it, expect } from "vitest";
import {
  resolveDependencies,
  getBlockedTasks,
  getExecutableTasks,
} from "./dependency-resolver";
import type { KanbanTask } from "./kanban-db";

function createMockTask(overrides: Partial<KanbanTask> = {}): KanbanTask {
  return {
    id: "task-" + Math.random().toString(36).slice(2),
    title: "Test Task",
    description: null,
    status: "backlog",
    priority: "medium",
    assignee: null,
    labels: [],
    order: 1000,
    projectId: null,
    domain: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    dueDate: null,
    dependsOn: null,
    executionStatus: null,
    executionResult: null,
    blockedBy: null,
    waitingFor: null,
    claimedBy: null,
    claimedAt: null,
    createdBy: null,
    archived: false,
    archivedAt: null,
    doneAt: null,
    ...overrides,
  };
}

describe("dependency-resolver", () => {
  describe("resolveDependencies", () => {
    it("returns empty array for empty input", () => {
      const result = resolveDependencies([]);
      expect(result).toEqual([]);
    });

    it("marks tasks without dependencies as executable", () => {
      const tasks = [createMockTask({ id: "task-1" })];
      const result = resolveDependencies(tasks);

      expect(result).toHaveLength(1);
      expect(result[0].isExecutable).toBe(true);
      expect(result[0].blockedReason).toBeNull();
    });

    it("marks task as blocked when dependency is pending", () => {
      const task1 = createMockTask({ id: "task-1" });
      const task2 = createMockTask({
        id: "task-2",
        dependsOn: ["task-1"],
      });

      const result = resolveDependencies([task1, task2]);

      const resolved2 = result.find((t) => t.id === "task-2");
      expect(resolved2?.isExecutable).toBe(false);
      expect(resolved2?.blockedReason).toBe("dependency_pending");
    });

    it("marks task as executable when dependency succeeded", () => {
      const task1 = createMockTask({
        id: "task-1",
        executionStatus: "success",
      });
      const task2 = createMockTask({
        id: "task-2",
        dependsOn: ["task-1"],
      });

      const result = resolveDependencies([task1, task2]);

      const resolved2 = result.find((t) => t.id === "task-2");
      expect(resolved2?.isExecutable).toBe(true);
      expect(resolved2?.blockedReason).toBeNull();
    });

    it("marks task as blocked when dependency failed", () => {
      const task1 = createMockTask({
        id: "task-1",
        executionStatus: "error",
      });
      const task2 = createMockTask({
        id: "task-2",
        dependsOn: ["task-1"],
      });

      const result = resolveDependencies([task1, task2]);

      const resolved2 = result.find((t) => t.id === "task-2");
      expect(resolved2?.isExecutable).toBe(false);
      expect(resolved2?.blockedReason).toBe("dependency_failed");
    });

    it("marks task as blocked when dependency was skipped", () => {
      const task1 = createMockTask({
        id: "task-1",
        executionStatus: "skipped",
      });
      const task2 = createMockTask({
        id: "task-2",
        dependsOn: ["task-1"],
      });

      const result = resolveDependencies([task1, task2]);

      const resolved2 = result.find((t) => t.id === "task-2");
      expect(resolved2?.isExecutable).toBe(false);
      expect(resolved2?.blockedReason).toBe("dependency_failed");
    });

    it("handles multiple dependencies - all must succeed", () => {
      const task1 = createMockTask({
        id: "task-1",
        executionStatus: "success",
      });
      const task2 = createMockTask({
        id: "task-2",
        executionStatus: "pending",
      });
      const task3 = createMockTask({
        id: "task-3",
        dependsOn: ["task-1", "task-2"],
      });

      const result = resolveDependencies([task1, task2, task3]);

      const resolved3 = result.find((t) => t.id === "task-3");
      expect(resolved3?.isExecutable).toBe(false);
      expect(resolved3?.blockedReason).toBe("dependency_pending");
    });

    it("allows task when all dependencies succeeded", () => {
      const task1 = createMockTask({
        id: "task-1",
        executionStatus: "success",
      });
      const task2 = createMockTask({
        id: "task-2",
        executionStatus: "success",
      });
      const task3 = createMockTask({
        id: "task-3",
        dependsOn: ["task-1", "task-2"],
      });

      const result = resolveDependencies([task1, task2, task3]);

      const resolved3 = result.find((t) => t.id === "task-3");
      expect(resolved3?.isExecutable).toBe(true);
      expect(resolved3?.blockedReason).toBeNull();
    });

    it("ignores non-existent dependencies", () => {
      const task = createMockTask({
        id: "task-1",
        dependsOn: ["non-existent-task"],
      });

      const result = resolveDependencies([task]);

      expect(result[0].isExecutable).toBe(true);
      expect(result[0].blockedReason).toBeNull();
    });

    it("handles running dependency as pending", () => {
      const task1 = createMockTask({
        id: "task-1",
        executionStatus: "running",
      });
      const task2 = createMockTask({
        id: "task-2",
        dependsOn: ["task-1"],
      });

      const result = resolveDependencies([task1, task2]);

      const resolved2 = result.find((t) => t.id === "task-2");
      expect(resolved2?.isExecutable).toBe(false);
      expect(resolved2?.blockedReason).toBe("dependency_pending");
    });
  });

  describe("circular dependency detection", () => {
    it("detects direct circular dependency (A -> A)", () => {
      const task1 = createMockTask({
        id: "task-1",
        dependsOn: ["task-1"],
      });

      const result = resolveDependencies([task1]);

      expect(result[0].isExecutable).toBe(false);
      expect(result[0].blockedReason).toBe("circular");
    });

    it("detects indirect circular dependency (A -> B -> A)", () => {
      const task1 = createMockTask({
        id: "task-1",
        dependsOn: ["task-2"],
      });
      const task2 = createMockTask({
        id: "task-2",
        dependsOn: ["task-1"],
      });

      const result = resolveDependencies([task1, task2]);

      const resolved1 = result.find((t) => t.id === "task-1");

      expect(resolved1?.isExecutable).toBe(false);
      expect(resolved1?.blockedReason).toBe("circular");
    });

    it("detects longer circular dependency chain (A -> B -> C -> A)", () => {
      const task1 = createMockTask({
        id: "task-1",
        dependsOn: ["task-2"],
      });
      const task2 = createMockTask({
        id: "task-2",
        dependsOn: ["task-3"],
      });
      const task3 = createMockTask({
        id: "task-3",
        dependsOn: ["task-1"],
      });

      const result = resolveDependencies([task1, task2, task3]);

      const resolved1 = result.find((t) => t.id === "task-1");
      expect(resolved1?.isExecutable).toBe(false);
      expect(resolved1?.blockedReason).toBe("circular");
    });

    it("does not mark non-circular chains as circular", () => {
      const task1 = createMockTask({
        id: "task-1",
        executionStatus: "success",
      });
      const task2 = createMockTask({
        id: "task-2",
        dependsOn: ["task-1"],
      });
      const task3 = createMockTask({
        id: "task-3",
        dependsOn: ["task-2"],
      });

      const result = resolveDependencies([task1, task2, task3]);

      const resolved3 = result.find((t) => t.id === "task-3");
      expect(resolved3?.isExecutable).toBe(false);
      expect(resolved3?.blockedReason).toBe("dependency_pending");
    });
  });

  describe("getExecutableTasks", () => {
    it("returns only tasks without blocking dependencies", () => {
      const task1 = createMockTask({ id: "task-1" });
      const task2 = createMockTask({
        id: "task-2",
        dependsOn: ["task-1"],
      });
      const task3 = createMockTask({ id: "task-3" });

      const result = getExecutableTasks([task1, task2, task3]);

      expect(result).toHaveLength(2);
      expect(result.map((t) => t.id)).toContain("task-1");
      expect(result.map((t) => t.id)).toContain("task-3");
    });

    it("returns empty array when all tasks are blocked", () => {
      const task1 = createMockTask({
        id: "task-1",
        dependsOn: ["task-2"],
      });
      const task2 = createMockTask({
        id: "task-2",
        dependsOn: ["task-1"],
      });

      const result = getExecutableTasks([task1, task2]);

      expect(result).toHaveLength(0);
    });

    it("returns all tasks when none have dependencies", () => {
      const tasks = [
        createMockTask({ id: "task-1" }),
        createMockTask({ id: "task-2" }),
        createMockTask({ id: "task-3" }),
      ];

      const result = getExecutableTasks(tasks);

      expect(result).toHaveLength(3);
    });
  });

  describe("getBlockedTasks", () => {
    it("returns only tasks with blocking dependencies", () => {
      const task1 = createMockTask({ id: "task-1" });
      const task2 = createMockTask({
        id: "task-2",
        dependsOn: ["task-1"],
      });
      const task3 = createMockTask({ id: "task-3" });

      const result = getBlockedTasks([task1, task2, task3]);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("task-2");
    });

    it("returns empty array when no tasks are blocked", () => {
      const tasks = [
        createMockTask({ id: "task-1" }),
        createMockTask({ id: "task-2" }),
      ];

      const result = getBlockedTasks(tasks);

      expect(result).toHaveLength(0);
    });

    it("includes tasks blocked by failed dependencies", () => {
      const task1 = createMockTask({
        id: "task-1",
        executionStatus: "error",
      });
      const task2 = createMockTask({
        id: "task-2",
        dependsOn: ["task-1"],
      });

      const result = getBlockedTasks([task1, task2]);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("task-2");
    });

    it("includes tasks with circular dependencies", () => {
      const task1 = createMockTask({
        id: "task-1",
        dependsOn: ["task-1"],
      });

      const result = getBlockedTasks([task1]);

      expect(result).toHaveLength(1);
    });
  });

  describe("complex scenarios", () => {
    it("handles diamond dependency pattern", () => {
      const root = createMockTask({
        id: "root",
        executionStatus: "success",
      });
      const left = createMockTask({
        id: "left",
        dependsOn: ["root"],
      });
      const right = createMockTask({
        id: "right",
        dependsOn: ["root"],
      });
      const bottom = createMockTask({
        id: "bottom",
        dependsOn: ["left", "right"],
      });

      const result = resolveDependencies([root, left, right, bottom]);

      const resolvedRoot = result.find((t) => t.id === "root");
      const resolvedLeft = result.find((t) => t.id === "left");
      const resolvedRight = result.find((t) => t.id === "right");
      const resolvedBottom = result.find((t) => t.id === "bottom");

      expect(resolvedRoot?.isExecutable).toBe(true);
      expect(resolvedLeft?.isExecutable).toBe(false);
      expect(resolvedRight?.isExecutable).toBe(false);
      expect(resolvedBottom?.isExecutable).toBe(false);
    });

    it("handles deep chain with partial completion", () => {
      const tasks: KanbanTask[] = [];
      for (let i = 0; i < 5; i++) {
        tasks.push(
          createMockTask({
            id: `task-${i}`,
            executionStatus: i < 3 ? "success" : null,
            dependsOn: i > 0 ? [`task-${i - 1}`] : null,
          })
        );
      }

      const result = resolveDependencies(tasks);

      expect(result[0].isExecutable).toBe(true);
      expect(result[1].isExecutable).toBe(true);
      expect(result[2].isExecutable).toBe(true);
      expect(result[3].isExecutable).toBe(false);
      expect(result[3].blockedReason).toBe("dependency_pending");
      expect(result[4].isExecutable).toBe(false);
    });

    it("preserves original task properties in resolved output", () => {
      const task = createMockTask({
        id: "task-1",
        title: "Important Task",
        description: "Do something important",
        status: "in_progress",
        priority: "critical",
        assignee: "agent-1",
      });

      const result = resolveDependencies([task]);

      expect(result[0].id).toBe("task-1");
      expect(result[0].title).toBe("Important Task");
      expect(result[0].description).toBe("Do something important");
      expect(result[0].status).toBe("in_progress");
      expect(result[0].priority).toBe("critical");
      expect(result[0].assignee).toBe("agent-1");
    });
  });
});

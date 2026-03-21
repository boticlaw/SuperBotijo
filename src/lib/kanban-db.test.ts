import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  TASK_COMMENT_TYPE,
  createTask,
  createTaskComment,
  getTask,
  updateTask,
  deleteTask,
  listTasks,
  listTaskComments,
  getTasksByColumn,
  getTasksStats,
  getColumns,
  getColumn,
  createColumn,
  updateColumn,
  deleteColumn,
  moveTask,
  clearAllDataForTesting,
  type KanbanTask as KanbanTaskType,
} from "./kanban-db";

describe("kanban-db", () => {
  beforeEach(() => {
    clearAllDataForTesting();
  });

  afterEach(() => {
    clearAllDataForTesting();
  });

describe("kanban-db", () => {
  beforeEach(() => {
    clearAllDataForTesting();
  });

  afterEach(() => {
    clearAllDataForTesting();
  });

  // ============================================================================
    // Task CRUD Operations
    // ============================================================================

    describe("createTask", () => {
      it("creates a task with required fields only", () => {
        const task = createTask({ title: "Test task" });

        expect(task.id).toBeDefined();
        expect(task.title).toBe("Test task");
        expect(task.description).toBeNull();
        expect(task.status).toBe("backlog");
        expect(task.priority).toBe("medium");
        expect(task.assignee).toBeNull();
        expect(task.labels).toEqual([]);
        expect(task.order).toBeGreaterThan(0);
        expect(task.created_at).toBeDefined();
        expect(task.updated_at).toBeDefined();
      });

      it("creates a task with all optional fields", () => {
        const task = createTask({
          title: "Full task",
          description: "A detailed description",
          status: "in_progress",
          priority: "high",
          assignee: "John Doe",
          labels: [{ name: "bug", color: "#ff0000" }],
        });

        expect(task.title).toBe("Full task");
        expect(task.description).toBe("A detailed description");
        expect(task.status).toBe("in_progress");
        expect(task.priority).toBe("high");
        expect(task.assignee).toBe("John Doe");
        expect(task.labels).toEqual([{ name: "bug", color: "#ff0000" }]);
      });

      it("throws error when title exceeds 200 characters", () => {
        const longTitle = "a".repeat(201);
        expect(() => createTask({ title: longTitle })).toThrow("Title must be 200 characters or less");
      });

      it("appends task at the end of the column", () => {
        const task1 = createTask({ title: "First", status: "backlog" });
        const task2 = createTask({ title: "Second", status: "backlog" });

        expect(task2.order).toBeGreaterThan(task1.order);
      });

      it("creates task with all priority levels", () => {
        const lowTask = createTask({ title: "Low", priority: "low" });
        const mediumTask = createTask({ title: "Medium", priority: "medium" });
        const highTask = createTask({ title: "High", priority: "high" });
        const criticalTask = createTask({ title: "Critical", priority: "critical" });

        expect(lowTask.priority).toBe("low");
        expect(mediumTask.priority).toBe("medium");
        expect(highTask.priority).toBe("high");
        expect(criticalTask.priority).toBe("critical");
      });
    });

    describe("getTask", () => {
      it("returns null for non-existent task", () => {
        const result = getTask("non-existent-id");
        expect(result).toBeNull();
      });

      it("returns task by id", () => {
        const created = createTask({ title: "Test task" });
        const result = getTask(created.id);

        expect(result).not.toBeNull();
        expect(result?.id).toBe(created.id);
        expect(result?.title).toBe("Test task");
      });
    });

    describe("updateTask", () => {
      it("returns null for non-existent task", () => {
        const result = updateTask("non-existent-id", { title: "New title" });
        expect(result).toBeNull();
      });

      it("updates task title", () => {
        const created = createTask({ title: "Original" });
        const updated = updateTask(created.id, { title: "Updated" });

        expect(updated?.title).toBe("Updated");
      });

      it("updates task description", () => {
        const created = createTask({ title: "Task" });
        const updated = updateTask(created.id, { description: "New description" });

        expect(updated?.description).toBe("New description");
      });

      it("updates task status", () => {
        const created = createTask({ title: "Task" });
        const updated = updateTask(created.id, { status: "done" });

        expect(updated?.status).toBe("done");
      });

      it("updates task priority", () => {
        const created = createTask({ title: "Task" });
        const updated = updateTask(created.id, { priority: "critical" });
        expect(updated?.priority).toBe("critical");
      });

      it("updates task assignee", () => {
        const created = createTask({ title: "Task" });
        const updated = updateTask(created.id, { assignee: "Jane Doe" });
        expect(updated?.assignee).toBe("Jane Doe");
      });

      it("updates task labels", () => {
        const created = createTask({ title: "Task" });
        const updated = updateTask(created.id, {
          labels: [{ name: "feature", color: "#00ff00" }],
        });
        expect(updated?.labels).toEqual([{ name: "feature", color: "#00ff00" }]);
      });

      it("updates task order", () => {
        const created = createTask({ title: "Task" });
        const updated = updateTask(created.id, { order: 5000 });
        expect(updated?.order).toBe(5000);
      });

      it("throws error when title exceeds 200 characters", () => {
        const created = createTask({ title: "Task" });
        const longTitle = "a".repeat(201);

        expect(() => updateTask(created.id, { title: longTitle })).toThrow(
          "Title must be 200 characters or less"
        );
      });

      it("returns unchanged task when no updates provided", () => {
        const created = createTask({ title: "Task" });
        const updated = updateTask(created.id, {});

        expect(updated?.id).toBe(created.id);
        expect(updated?.title).toBe("Task");
      });

      it("updates updated_at timestamp", async () => {
        const created = createTask({ title: "Task" });
        // Small delay to ensure timestamp differs
        await new Promise((resolve) => setTimeout(resolve, 10));
        const updated = updateTask(created.id, { title: "Updated" });

        expect(updated?.updated_at).not.toBe(created.updated_at);
      });
    });

    describe("deleteTask", () => {
      it("returns false for non-existent task", () => {
        const result = deleteTask("non-existent-id");
        expect(result).toBe(false);
      });

      it("deletes an existing task and returns true", () => {
        const created = createTask({ title: "To delete" });
        const result = deleteTask(created.id);

        expect(result).toBe(true);
        expect(getTask(created.id)).toBeNull();
      });
    });

    describe("listTasks", () => {
      it("returns empty array when no tasks exist", () => {
        // Clear all tasks
        clearAllDataForTesting();
        const tasks = listTasks();
        expect(tasks).toEqual([]);
      });

      it("returns all tasks ordered by order field", () => {
        createTask({ title: "First", status: "backlog" });
        createTask({ title: "Second", status: "backlog" });
        createTask({ title: "Third", status: "backlog" });

        const tasks = listTasks();

        expect(tasks.length).toBe(3);
        // Tasks should be ordered by their order field
        const orders = tasks.map((t) => t.order);
        expect(orders).toEqual([...orders].sort((a, b) => a - b));
      });

      it("filters by status", () => {
        createTask({ title: "Backlog task", status: "backlog" });
        createTask({ title: "Done task", status: "done" });

        const tasks = listTasks({ status: "backlog" });

        expect(tasks.length).toBe(1);
        expect(tasks[0].title).toBe("Backlog task");
      });

      it("filters by assignee", () => {
        createTask({ title: "John's task", assignee: "John" });
        createTask({ title: "Jane's task", assignee: "Jane" });

        const tasks = listTasks({ assignee: "John" });

        expect(tasks.length).toBe(1);
        expect(tasks[0].title).toBe("John's task");
      });

      it("filters by priority", () => {
        createTask({ title: "Low task", priority: "low" });
        createTask({ title: "High task", priority: "high" });

        const tasks = listTasks({ priority: "high" });

        expect(tasks.length).toBe(1);
        expect(tasks[0].title).toBe("High task");
      });

      it("filters by search term in title", () => {
        createTask({ title: "Fix bug in auth" });
        createTask({ title: "Add new feature" });

        const tasks = listTasks({ search: "bug" });

        expect(tasks.length).toBe(1);
        expect(tasks[0].title).toBe("Fix bug in auth");
      });

      it("filters by search term in description", () => {
        createTask({ title: "Task 1", description: "This is about authentication" });
        createTask({ title: "Task 2", description: "This is about database" });

        const tasks = listTasks({ search: "database" });

        expect(tasks.length).toBe(1);
        expect(tasks[0].title).toBe("Task 2");
      });

      it("combines multiple filters", () => {
        createTask({ title: "Bug in auth", status: "backlog", priority: "high" });
        createTask({ title: "Bug in UI", status: "in_progress", priority: "high" });
        createTask({ title: "Feature", status: "backlog", priority: "low" });

        const tasks = listTasks({ status: "backlog", priority: "high" });
        expect(tasks.length).toBe(1);
        expect(tasks[0].title).toBe("Bug in auth");
      });
    });

    describe("task comments", () => {
      it("creates and lists comments with latest-first deterministic order", async () => {
        const task = createTask({ title: "Task with comments" });
        const first = createTaskComment({
          taskId: task.id,
          authorType: "agent",
          authorId: "boti",
          body: "First comment",
        });

        await new Promise((resolve) => setTimeout(resolve, 5));

        const second = createTaskComment({
          taskId: task.id,
          authorType: "human",
          authorId: "user",
          body: "Second comment",
          commentType: TASK_COMMENT_TYPE.STATUS_CHANGE,
          statusFrom: "in_progress",
          statusTo: "review",
        });

        const comments = listTaskComments({ taskId: task.id, limit: 10 });

        expect(comments.length).toBe(2);
        expect(comments[0].id).toBe(second.id);
        expect(comments[1].id).toBe(first.id);
      });

      it("supports legacy body fallback through parseCommentRow compatibility", () => {
        const task = createTask({ title: "Legacy comment task" });
        const created = createTaskComment({
          taskId: task.id,
          authorType: "agent",
          authorId: "legacy-agent",
          body: "Legacy-compatible comment",
        });

        const comments = listTaskComments({ taskId: task.id });
        expect(comments[0].id).toBe(created.id);
        expect(comments[0].body).toBe("Legacy-compatible comment");
        expect(comments[0].authorId).toBe("legacy-agent");
      });

      it("validates required body and maximum length", () => {
        const task = createTask({ title: "Invalid comment task" });

        expect(() => {
          createTaskComment({
            taskId: task.id,
            body: "",
          });
        }).toThrow("body is required");

        expect(() => {
          createTaskComment({
            taskId: task.id,
            body: "a".repeat(5001),
          });
        }).toThrow("body must be 5000 characters or less");
      });

      it("enforces list limit boundaries", () => {
        const task = createTask({ title: "Comment limit task" });

        for (let i = 0; i < 3; i++) {
          createTaskComment({
            taskId: task.id,
            body: `Comment ${i}`,
            authorType: "human",
            authorId: "user",
          });
        }

        const comments = listTaskComments({ taskId: task.id, limit: 1 });
        expect(comments.length).toBe(1);
      });

      it("includes commentCount in listTasks rows", () => {
        const task = createTask({ title: "Comment counter task" });

        createTaskComment({
          taskId: task.id,
          body: "First",
          authorType: "human",
          authorId: "user",
        });

        createTaskComment({
          taskId: task.id,
          body: "Second",
          authorType: "agent",
          authorId: "boti",
        });

        const tasks = listTasks();
        const withComments = tasks.find((candidate) => candidate.id === task.id);

        expect(withComments?.commentCount).toBe(2);
      });
    });

    describe("getTasksByColumn", () => {
      it("returns empty object when no tasks exist", () => {
        clearAllDataForTesting();
        const result = getTasksByColumn();
        expect(result).toEqual({});
      });

      it("groups tasks by status", () => {
        createTask({ title: "Task 1", status: "backlog" });
        createTask({ title: "Task 2", status: "backlog" });
        createTask({ title: "Task 3", status: "done" });
        const result = getTasksByColumn();
        expect(result["backlog"].length).toBe(2);
        expect(result["done"].length).toBe(1);
      });
    });

    describe("getTasksStats", () => {
      it("returns stats with required fields", () => {
        const stats = getTasksStats();
        expect(stats).toHaveProperty("total");
        expect(stats).toHaveProperty("byStatus");
        expect(stats).toHaveProperty("byPriority");
      });

      it("counts total tasks", () => {
        createTask({ title: "Task 1" });
        createTask({ title: "Task 2" });
        const stats = getTasksStats();
        expect(stats.total).toBe(2);
      });

      it("groups by status", () => {
        createTask({ title: "Task 1", status: "backlog" });
        createTask({ title: "Task 2", status: "backlog" });
        createTask({ title: "Task 3", status: "done" });
        const stats = getTasksStats();
        expect(stats.byStatus["backlog"]).toBe(2);
        expect(stats.byStatus["done"]).toBe(1);
      });

      it("groups by priority", () => {
        createTask({ title: "Task 1", priority: "low" });
        createTask({ title: "Task 2", priority: "high" });
        createTask({ title: "Task 3", priority: "high" });
        const stats = getTasksStats();
        expect(stats.byPriority["low"]).toBe(1);
        expect(stats.byPriority["high"]).toBe(2);
      });
    });

    // ============================================================================
    // Column CRUD Operations
    // ============================================================================

    describe("getColumns", () => {
      it("returns default columns on first run", () => {
        const columns = getColumns();
        expect(columns.length).toBe(4);
        expect(columns.map((c) => c.id)).toContain("backlog");
        expect(columns.map((c) => c.id)).toContain("in_progress");
        expect(columns.map((c) => c.id)).toContain("review");
        expect(columns.map((c) => c.id)).toContain("done");
      });

      it("returns columns ordered by order field", () => {
        const columns = getColumns();
        const orders = columns.map((c) => c.order);
        expect(orders).toEqual([...orders].sort((a, b) => a - b));
      });
    });

    describe("getColumn", () => {
      it("returns null for non-existent column", () => {
        const result = getColumn("non-existent");
        expect(result).toBeNull();
      });

      it("returns column by id", () => {
        const result = getColumn("backlog");
        expect(result).not.toBeNull();
        expect(result?.id).toBe("backlog");
        expect(result?.name).toBe("Backlog");
      });
    });

    describe("createColumn", () => {
      it("creates a column with required fields", () => {
        const column = createColumn({ id: "testing", name: "Testing" });
        expect(column.id).toBe("testing");
        expect(column.name).toBe("Testing");
        expect(column.color).toBe("#6b7280");
        expect(column.limit).toBeNull();
        expect(column.order).toBeGreaterThan(0);
      });

      it("creates a column with optional fields", () => {
        const column = createColumn({
          id: "blocked",
          name: "Blocked",
          color: "#ff0000",
          limit: 5,
        });
        expect(column.color).toBe("#ff0000");
        expect(column.limit).toBe(5);
      });

      it("appends column at the end", () => {
        const col1 = createColumn({ id: "col1", name: "Column 1" });
        const col2 = createColumn({ id: "col2", name: "Column 2" });
        expect(col2.order).toBeGreaterThan(col1.order);
      });
    });

    describe("updateColumn", () => {
      it("returns null for non-existent column", () => {
        const result = updateColumn("non-existent", { name: "New name" });
        expect(result).toBeNull();
      });

      it("updates column name", () => {
        createColumn({ id: "test", name: "Original" });
        const updated = updateColumn("test", { name: "Updated" });
        expect(updated?.name).toBe("Updated");
      });

      it("updates column color", () => {
        createColumn({ id: "test", name: "Test" });
        const updated = updateColumn("test", { color: "#00ff00" });
        expect(updated?.color).toBe("#00ff00");
      });

      it("updates column limit", () => {
        createColumn({ id: "test", name: "Test" });
        const updated = updateColumn("test", { limit: 10 });
        expect(updated?.limit).toBe(10);
      });

      it("updates column order", () => {
        createColumn({ id: "test", name: "Test" });
        const updated = updateColumn("test", { order: 500 });
        expect(updated?.order).toBe(500);
      });

      it("returns unchanged column when no updates provided", () => {
        createColumn({ id: "test", name: "Test" });
        const updated = updateColumn("test", {});
        expect(updated?.name).toBe("Test");
      });
    });

    describe("deleteColumn", () => {
      it("returns false for non-existent column", () => {
        const result = deleteColumn("non-existent");
        expect(result).toBe(false);
      });

      it("deletes empty column and returns true", () => {
        createColumn({ id: "to-delete", name: "To Delete" });
        const result = deleteColumn("to-delete");
        expect(result).toBe(true);
        expect(getColumn("to-delete")).toBeNull();
      });

      it("throws error when column has tasks", () => {
        createColumn({ id: "with-tasks", name: "With Tasks" });
        createTask({ title: "Task", status: "with-tasks" });

        expect(() => deleteColumn("with-tasks")).toThrow(
          "Cannot delete column with 1 tasks"
        );
      });
    });

    // ============================================================================
    // Move Task Logic (Float Ordering)
    // ============================================================================

    describe("moveTask", () => {
      it("returns null for non-existent task", () => {
        const result = moveTask("non-existent", "backlog");
        expect(result).toBeNull();
      });

      it("returns null for non-existent target column", () => {
        const task = createTask({ title: "Task" });
        const result = moveTask(task.id, "non-existent-column");
        expect(result).toBeNull();
      });

      it("moves task to different column without target order (appends)", () => {
        createTask({ title: "Existing", status: "done" });
        const task = createTask({ title: "To move", status: "backlog" });
        const result = moveTask(task.id, "done");
        expect(result).not.toBeNull();
        expect(result?.status).toBe("done");
        // Should be appended after existing task
        const existing = listTasks({ status: "done" })[0];
        expect(result?.order).toBeGreaterThanOrEqual(existing.order);
      });

      it("moves task to same column at different position", () => {
        const task1 = createTask({ title: "Task 1", status: "backlog" });
        createTask({ title: "Task 2", status: "backlog" });
        createTask({ title: "Task 3", status: "backlog" });
        // Move task1 to position after task2
        const result = moveTask(task1.id, "backlog", 1500);
        expect(result).not.toBeNull();
        expect(result?.status).toBe("backlog");
      });

      it("calculates midpoint order when moving between tasks", () => {
        const task1 = createTask({ title: "Task 1", status: "backlog" });
        createTask({ title: "Task 2", status: "backlog" });
        // Move task1 to position between task1 and task2
        const result = moveTask(task1.id, "backlog", task1.order + 250);
        expect(result).not.toBeNull();
        // Order should be between original positions
        expect(result?.order).toBeGreaterThan(0);
      });

      it("moves task to beginning of column", () => {
        createTask({ title: "Existing", status: "done" });
        const task = createTask({ title: "To move", status: "backlog" });
        const result = moveTask(task.id, "done", 100);
        expect(result?.status).toBe("done");
        expect(result?.order).toBeLessThan(1000);
      });

      it("handles same position move gracefully", () => {
        const task = createTask({ title: "Task", status: "backlog" });
        // Move to same column with order that matches its current position
        const result = moveTask(task.id, "backlog", task.order);
        expect(result).not.toBeNull();
        expect(result?.status).toBe("backlog");
      });
    });

    describe("float ordering reindex", () => {
      it("handles many moves without order collision", () => {
        // Create many tasks
        const tasks: KanbanTaskType[] = [];
        for (let i = 0; i < 20; i++) {
          tasks.push(createTask({ title: `Task ${i}`, status: "backlog" }));
        }
        // Move first task to end multiple times
        for (let i = 0; i < 5; i++) {
          const result = moveTask(tasks[0].id, "backlog", 50000);
          expect(result).not.toBeNull();
        }
        // All tasks should still be retrievable
        const allTasks = listTasks();
        expect(allTasks.length).toBe(20);
      });
    });
  });
});

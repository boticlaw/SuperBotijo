/**
 * SQLite-backed Kanban Board Storage
 * Stores tasks and columns with float-based ordering for drag & drop
 */
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";
import { logActivity } from "@/lib/activities-db";

const DB_PATH = path.join(process.cwd(), "data", "kanban.db");

// ============================================================================
// Types
// ============================================================================

export type TaskPriority = "low" | "medium" | "high" | "critical";

export interface KanbanLabel {
  name: string;
  color: string;
}

export interface KanbanTask {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: TaskPriority;
  assignee: string | null;
  labels: KanbanLabel[];
  order: number;
  created_at: string;
  updated_at: string;
}

export interface KanbanColumn {
  id: string;
  name: string;
  color: string;
  order: number;
  limit: number | null;
}

export interface CreateTaskInput {
  title: string;
  description?: string | null;
  status?: string;
  priority?: TaskPriority;
  assignee?: string | null;
  labels?: KanbanLabel[];
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  status?: string;
  priority?: TaskPriority;
  assignee?: string | null;
  labels?: KanbanLabel[];
  order?: number;
}

export interface CreateColumnInput {
  id: string;
  name: string;
  color?: string;
  limit?: number | null;
}

export interface UpdateColumnInput {
  name?: string;
  color?: string;
  order?: number;
  limit?: number | null;
}

export interface ListTasksFilters {
  status?: string;
  assignee?: string;
  priority?: TaskPriority;
  search?: string;
}

export interface TasksStats {
  total: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
}

// ============================================================================
// Database Setup
// ============================================================================

let _db: Database.Database | null = null;

/**
 * Get the database connection singleton
 * Creates tables and seeds default columns on first run
 */
function getDb(): Database.Database {
  if (_db) return _db;

  // Ensure data directory exists
  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  _db = new Database(DB_PATH);

  // WAL mode for better concurrency
  _db.pragma("journal_mode = WAL");
  _db.pragma("synchronous = NORMAL");

  // Create tables
  _db.exec(`
    CREATE TABLE IF NOT EXISTS kanban_columns (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#6b7280',
      "order" REAL NOT NULL DEFAULT 0,
      "limit" INTEGER
    );

    CREATE TABLE IF NOT EXISTS kanban_tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'backlog',
      priority TEXT NOT NULL DEFAULT 'medium',
      assignee TEXT,
      labels TEXT,
      "order" REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_kanban_tasks_status ON kanban_tasks(status);
    CREATE INDEX IF NOT EXISTS idx_kanban_tasks_priority ON kanban_tasks(priority);
    CREATE INDEX IF NOT EXISTS idx_kanban_tasks_order ON kanban_tasks("order");
    CREATE INDEX IF NOT EXISTS idx_kanban_tasks_assignee ON kanban_tasks(assignee);
    CREATE INDEX IF NOT EXISTS idx_kanban_columns_order ON kanban_columns("order");
  `);

  // Seed default columns if empty
  const columnCount = (_db.prepare("SELECT COUNT(*) as n FROM kanban_columns").get() as { n: number }).n;
  if (columnCount === 0) {
    const defaultColumns = [
      { id: "backlog", name: "Backlog", color: "#6b7280", order: 0, limit: null },
      { id: "in_progress", name: "In Progress", color: "#3b82f6", order: 1, limit: null },
      { id: "review", name: "Review", color: "#f59e0b", order: 2, limit: null },
      { id: "done", name: "Done", color: "#22c55e", order: 3, limit: null },
    ];

    const insertColumn = _db.prepare(`
      INSERT INTO kanban_columns (id, name, color, "order", "limit")
      VALUES (@id, @name, @color, @order, @limit)
    `);

    const insertMany = _db.transaction((columns: typeof defaultColumns) => {
      for (const col of columns) {
        insertColumn.run(col);
      }
    });

    insertMany(defaultColumns);
    console.log("[kanban-db] Seeded 4 default columns");
  }

  return _db;
}

// ============================================================================
// Task CRUD Operations
// ============================================================================

/**
 * Create a new task
 * @param input - Task creation data
 * @returns The created task
 * @throws Error if title exceeds 200 characters
 */
export function createTask(input: CreateTaskInput): KanbanTask {
  if (input.title.length > 200) {
    throw new Error("Title must be 200 characters or less");
  }

  const db = getDb();
  const id = randomUUID();
  const now = new Date().toISOString();
  const status = input.status ?? "backlog";
  const priority = input.priority ?? "medium";
  const labels = input.labels ?? [];

  // Get the max order in the target column to append at the end
  const maxOrder = (db.prepare(`
    SELECT COALESCE(MAX("order"), 0) as maxOrder FROM kanban_tasks WHERE status = ?
  `).get(status) as { maxOrder: number }).maxOrder;

  const order = maxOrder + 1000;

  db.prepare(`
    INSERT INTO kanban_tasks (id, title, description, status, priority, assignee, labels, "order", created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.title,
    input.description ?? null,
    status,
    priority,
    input.assignee ?? null,
    JSON.stringify(labels),
    order,
    now,
    now
  );

  // Log activity
  logActivity(
    "task",
    `Created task "${input.title}" in ${status}`,
    "success",
    {
      metadata: {
        taskId: id,
        taskTitle: input.title,
        column: status,
        priority,
      },
    }
  );

  return {
    id,
    title: input.title,
    description: input.description ?? null,
    status,
    priority,
    assignee: input.assignee ?? null,
    labels,
    order,
    created_at: now,
    updated_at: now,
  };
}

/**
 * Get a task by ID
 * @param id - Task UUID
 * @returns The task or null if not found
 */
export function getTask(id: string): KanbanTask | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM kanban_tasks WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  return row ? parseTaskRow(row) : null;
}

/**
 * Update a task
 * @param id - Task UUID
 * @param updates - Fields to update
 * @returns The updated task or null if not found
 * @throws Error if title exceeds 200 characters
 */
export function updateTask(id: string, updates: UpdateTaskInput): KanbanTask | null {
  if (updates.title !== undefined && updates.title.length > 200) {
    throw new Error("Title must be 200 characters or less");
  }

  const db = getDb();
  const existing = getTask(id);
  if (!existing) return null;

  const now = new Date().toISOString();
  const fields: string[] = [];
  const values: unknown[] = [];

  if (updates.title !== undefined) {
    fields.push("title = ?");
    values.push(updates.title);
  }
  if (updates.description !== undefined) {
    fields.push("description = ?");
    values.push(updates.description);
  }
  if (updates.status !== undefined) {
    fields.push("status = ?");
    values.push(updates.status);
  }
  if (updates.priority !== undefined) {
    fields.push("priority = ?");
    values.push(updates.priority);
  }
  if (updates.assignee !== undefined) {
    fields.push("assignee = ?");
    values.push(updates.assignee);
  }
  if (updates.labels !== undefined) {
    fields.push("labels = ?");
    values.push(JSON.stringify(updates.labels));
  }
  if (updates.order !== undefined) {
    fields.push('"order" = ?');
    values.push(updates.order);
  }

  if (fields.length === 0) return existing;

  fields.push("updated_at = ?");
  values.push(now);
  values.push(id);

  db.prepare(`UPDATE kanban_tasks SET ${fields.join(", ")} WHERE id = ?`).run(...values);

  return getTask(id);
}

/**
 * Delete a task
 * @param id - Task UUID
 * @returns True if deleted, false if not found
 */
export function deleteTask(id: string): boolean {
  const db = getDb();
  
  // Get task before deletion for logging
  const task = getTask(id);
  
  const result = db.prepare("DELETE FROM kanban_tasks WHERE id = ?").run(id);
  
  if (result.changes > 0 && task) {
    // Log activity
    logActivity(
      "task",
      `Deleted task "${task.title}"`,
      "success",
      {
        metadata: {
          taskId: id,
          taskTitle: task.title,
          column: task.status,
        },
      }
    );
  }
  
  return result.changes > 0;
}

/**
 * List tasks with optional filters
 * @param filters - Optional filters for status, assignee, priority, and search
 * @returns Array of tasks ordered by their order field
 */
export function listTasks(filters?: ListTasksFilters): KanbanTask[] {
  const db = getDb();

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters?.status) {
    conditions.push("status = ?");
    params.push(filters.status);
  }

  if (filters?.assignee) {
    conditions.push("assignee = ?");
    params.push(filters.assignee);
  }

  if (filters?.priority) {
    conditions.push("priority = ?");
    params.push(filters.priority);
  }

  if (filters?.search) {
    conditions.push("(title LIKE ? OR description LIKE ?)");
    const searchPattern = `%${filters.search}%`;
    params.push(searchPattern, searchPattern);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const rows = db.prepare(`SELECT * FROM kanban_tasks ${where} ORDER BY "order" ASC`).all(...params) as Record<string, unknown>[];

  return rows.map(parseTaskRow);
}

/**
 * Get all tasks grouped by column
 * @returns Record mapping column IDs to arrays of tasks
 */
export function getTasksByColumn(): Record<string, KanbanTask[]> {
  const tasks = listTasks();
  const result: Record<string, KanbanTask[]> = {};

  for (const task of tasks) {
    if (!result[task.status]) {
      result[task.status] = [];
    }
    result[task.status].push(task);
  }

  return result;
}

/**
 * Get task statistics
 * @returns Stats object with totals by status and priority
 */
export function getTasksStats(): TasksStats {
  const db = getDb();

  const total = (db.prepare("SELECT COUNT(*) as n FROM kanban_tasks").get() as { n: number }).n;

  const statusRows = db.prepare("SELECT status, COUNT(*) as n FROM kanban_tasks GROUP BY status").all() as Array<{ status: string; n: number }>;
  const byStatus: Record<string, number> = {};
  for (const r of statusRows) byStatus[r.status] = r.n;

  const priorityRows = db.prepare("SELECT priority, COUNT(*) as n FROM kanban_tasks GROUP BY priority").all() as Array<{ priority: string; n: number }>;
  const byPriority: Record<string, number> = {};
  for (const r of priorityRows) byPriority[r.priority] = r.n;

  return { total, byStatus, byPriority };
}

// ============================================================================
// Column Management Operations
// ============================================================================

/**
 * Get all columns ordered by their order field
 * @returns Array of columns
 */
export function getColumns(): KanbanColumn[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM kanban_columns ORDER BY "order" ASC').all() as Record<string, unknown>[];
  return rows.map(parseColumnRow);
}

/**
 * Get a column by ID
 * @param id - Column identifier
 * @returns The column or null if not found
 */
export function getColumn(id: string): KanbanColumn | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM kanban_columns WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  return row ? parseColumnRow(row) : null;
}

/**
 * Create a new column
 * @param input - Column creation data
 * @returns The created column
 */
export function createColumn(input: CreateColumnInput): KanbanColumn {
  const db = getDb();

  // Get max order to append at the end
  const maxOrder = (db.prepare('SELECT COALESCE(MAX("order"), 0) as maxOrder FROM kanban_columns').get() as { maxOrder: number }).maxOrder;
  const order = maxOrder + 1000;

  const color = input.color ?? "#6b7280";
  const limit = input.limit ?? null;

  db.prepare(`
    INSERT INTO kanban_columns (id, name, color, "order", "limit")
    VALUES (?, ?, ?, ?, ?)
  `).run(input.id, input.name, color, order, limit);

  return {
    id: input.id,
    name: input.name,
    color,
    order,
    limit,
  };
}

/**
 * Update a column
 * @param id - Column identifier
 * @param updates - Fields to update
 * @returns The updated column or null if not found
 */
export function updateColumn(id: string, updates: UpdateColumnInput): KanbanColumn | null {
  const db = getDb();
  const existing = getColumn(id);
  if (!existing) return null;

  const fields: string[] = [];
  const values: unknown[] = [];

  if (updates.name !== undefined) {
    fields.push("name = ?");
    values.push(updates.name);
  }
  if (updates.color !== undefined) {
    fields.push("color = ?");
    values.push(updates.color);
  }
  if (updates.order !== undefined) {
    fields.push('"order" = ?');
    values.push(updates.order);
  }
  if (updates.limit !== undefined) {
    fields.push('"limit" = ?');
    values.push(updates.limit);
  }

  if (fields.length === 0) return existing;

  values.push(id);

  db.prepare(`UPDATE kanban_columns SET ${fields.join(", ")} WHERE id = ?`).run(...values);

  return getColumn(id);
}

/**
 * Delete a column
 * @param id - Column identifier
 * @returns True if deleted, false if not found
 * @throws Error if column has tasks
 */
export function deleteColumn(id: string): boolean {
  const db = getDb();

  // Check if column has tasks
  const taskCount = (db.prepare("SELECT COUNT(*) as n FROM kanban_tasks WHERE status = ?").get(id) as { n: number }).n;
  if (taskCount > 0) {
    throw new Error(`Cannot delete column with ${taskCount} tasks. Move or delete tasks first.`);
  }

  const result = db.prepare("DELETE FROM kanban_columns WHERE id = ?").run(id);
  return result.changes > 0;
}

// ============================================================================
// Move Task Logic (Float Ordering)
// ============================================================================

const MIN_GAP = 0.5;

/**
 * Move a task to a new position with float-based ordering
 * @param taskId - Task UUID
 * @param targetColumnId - Target column identifier
 * @param targetOrder - Optional target order position (if null, appends at end)
 * @returns The updated task or null if not found
 */
export function moveTask(taskId: string, targetColumnId: string, targetOrder?: number): KanbanTask | null {
  const db = getDb();
  const task = getTask(taskId);
  if (!task) return null;

  // Verify target column exists
  const targetColumn = getColumn(targetColumnId);
  if (!targetColumn) return null;

  const fromColumn = task.status;
  const isSameColumn = task.status === targetColumnId;

  // If no target order specified, append at end of column
  if (targetOrder === undefined) {
    const maxOrder = (db.prepare(`
      SELECT COALESCE(MAX("order"), 0) as maxOrder FROM kanban_tasks WHERE status = ?
    `).get(targetColumnId) as { maxOrder: number }).maxOrder;

    const updatedTask = updateTask(taskId, {
      status: targetColumnId,
      order: maxOrder + 1000,
    });

    // Log activity if moved to different column
    if (!isSameColumn && updatedTask) {
      logActivity(
        "task",
        `Moved task "${task.title}" from ${fromColumn} to ${targetColumnId}`,
        "success",
        {
          metadata: {
            taskId,
            taskTitle: task.title,
            fromColumn,
            toColumn: targetColumnId,
          },
        }
      );
    }

    return updatedTask;
  }

  // Find surrounding tasks for float calculation
  const surroundingTasks = db.prepare(`
    SELECT id, "order" FROM kanban_tasks
    WHERE status = ? AND "order" >= ?
    ORDER BY "order" ASC
    LIMIT 2
  `).all(targetColumnId, targetOrder) as Array<{ id: string; order: number }>;

  let newOrder: number;

  if (surroundingTasks.length === 0) {
    // No tasks after target position, use target order
    newOrder = targetOrder;
  } else if (surroundingTasks.length === 1) {
    // Only one task after target
    const nextOrder = surroundingTasks[0].order;
    if (isSameColumn && surroundingTasks[0].id === taskId) {
      // Moving to same position, no change needed
      return task;
    }
    newOrder = (targetOrder + nextOrder) / 2;
  } else {
    // Two tasks: calculate midpoint
    const order1 = surroundingTasks[0].order;
    const order2 = surroundingTasks[1].order;
    newOrder = (order1 + order2) / 2;
  }

  // Check if gap is too small, trigger reindex if needed
  if (Math.abs(newOrder - targetOrder) < MIN_GAP) {
    reindexColumnOrder(targetColumnId);

    // Recalculate order after reindex
    const reindexedSurrounding = db.prepare(`
      SELECT id, "order" FROM kanban_tasks
      WHERE status = ? AND "order" >= ?
      ORDER BY "order" ASC
      LIMIT 2
    `).all(targetColumnId, targetOrder) as Array<{ id: string; order: number }>;

    if (reindexedSurrounding.length >= 2) {
      newOrder = (reindexedSurrounding[0].order + reindexedSurrounding[1].order) / 2;
    } else if (reindexedSurrounding.length === 1) {
      newOrder = (targetOrder + reindexedSurrounding[0].order) / 2;
    } else {
      newOrder = targetOrder;
    }
  }

  const updatedTask = updateTask(taskId, {
    status: targetColumnId,
    order: newOrder,
  });

  // Log activity if moved to different column
  if (!isSameColumn && updatedTask) {
    logActivity(
      "task",
      `Moved task "${task.title}" from ${fromColumn} to ${targetColumnId}`,
      "success",
      {
        metadata: {
          taskId,
          taskTitle: task.title,
          fromColumn,
          toColumn: targetColumnId,
        },
      }
    );
  }

  return updatedTask;
}

/**
 * Reindex all tasks in a column to have evenly spaced orders
 * @param columnId - Column identifier
 */
function reindexColumnOrder(columnId: string): void {
  const db = getDb();
  const tasks = db.prepare(`
    SELECT id FROM kanban_tasks
    WHERE status = ?
    ORDER BY "order" ASC
  `).all(columnId) as Array<{ id: string }>;

  if (tasks.length === 0) return;

  const updateOrder = db.prepare('UPDATE kanban_tasks SET "order" = ? WHERE id = ?');
  const reindex = db.transaction(() => {
    tasks.forEach((task, index) => {
      updateOrder.run((index + 1) * 1000, task.id);
    });
  });

  reindex();
}

// ============================================================================
// Helper Functions
// ============================================================================

function parseTaskRow(row: Record<string, unknown>): KanbanTask {
  return {
    id: row.id as string,
    title: row.title as string,
    description: row.description as string | null,
    status: row.status as string,
    priority: row.priority as TaskPriority,
    assignee: row.assignee as string | null,
    labels: row.labels ? JSON.parse(row.labels as string) : [],
    order: row.order as number,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

function parseColumnRow(row: Record<string, unknown>): KanbanColumn {
  return {
    id: row.id as string,
    name: row.name as string,
    color: row.color as string,
    order: row.order as number,
    limit: row.limit as number | null,
  };
}

// ============================================================================
// Testing Utilities
// ============================================================================

/**
 * Clear all data from the database (for testing only)
 * Resets to default columns
 */
export function clearAllDataForTesting(): void {
  const db = getDb();
  db.exec("DELETE FROM kanban_tasks");
  db.exec("DELETE FROM kanban_columns");
  
  // Re-seed default columns
  const defaultColumns = [
    { id: "backlog", name: "Backlog", color: "#6b7280", order: 0, limit: null },
    { id: "in_progress", name: "In Progress", color: "#3b82f6", order: 1, limit: null },
    { id: "review", name: "Review", color: "#f59e0b", order: 2, limit: null },
    { id: "done", name: "Done", color: "#22c55e", order: 3, limit: null },
  ];

  const insertColumn = db.prepare(`
    INSERT INTO kanban_columns (id, name, color, "order", "limit")
    VALUES (@id, @name, @color, @order, @limit)
  `);

  const insertMany = db.transaction((columns: typeof defaultColumns) => {
    for (const col of columns) {
      insertColumn.run(col);
    }
  });

  insertMany(defaultColumns);
}

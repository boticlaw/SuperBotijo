/**
 * SQLite-backed Kanban Board Storage
 * Stores tasks and columns with float-based ordering for drag & drop
 *
 * REFACTOR PLAN (deferred - high risk):
 * This file is ~2100 lines and handles multiple domains. To split safely:
 *
 * 1. Extract types to src/lib/kanban-types.ts (low risk)
 * 2. Create src/lib/db/kanban-connection.ts for DB singleton (medium risk)
 * 3. Split by domain into separate modules:
 *    - src/lib/kanban-tasks.ts (task CRUD, ~500 lines)
 *    - src/lib/kanban-columns.ts (column CRUD, ~200 lines)
 *    - src/lib/kanban-comments.ts (comments, ~300 lines)
 *    - src/lib/kanban-projects.ts (projects, ~200 lines)
 *    - src/lib/kanban-agents.ts (agent identities, ~150 lines)
 *    - src/lib/kanban-journal.ts (operations journal, ~150 lines)
 * 4. Update all API route imports (high effort - ~30 files)
 * 5. Add integration tests before splitting (critical)
 *
 * Risk: The `_db` singleton is shared across all functions. Splitting
 * requires careful coordination to avoid breaking DB initialization.
 *
 * See: Issue #132 - Technical Debt Reduction
 */
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";
import { logActivity } from "@/lib/activities-db";
import type {
  Project,
  CreateProjectInput,
  UpdateProjectInput,
  ListProjectsFilters,
  ProjectStatus,
  AgentIdentity,
  CreateAgentIdentityInput,
  UpdateAgentIdentityInput,
  OperationsJournalEntry,
  CreateJournalEntryInput,
  UpdateJournalEntryInput,
  ListJournalEntriesFilters,
} from "@/lib/mission-types";

// Use in-memory database for tests to avoid concurrency issues
const DB_PATH = process.env.NODE_ENV === "test"
  ? ":memory:"
  : path.join(process.cwd(), "data", "kanban.db");

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
  projectId: string | null;
  domain: string | null;  // Agent's domain: WORK, FINANCE, PERSONAL, COMMUNICATION, ADMIN, GENERAL
  created_at: string;
  updated_at: string;
  dueDate: string | null;
  dependsOn: string[] | null;
  executionStatus: "pending" | "running" | "success" | "error" | "skipped" | null;
  executionResult: string | null;
  blockedBy: string[] | null;
  waitingFor: string[] | null;
  claimedBy: string | null;
  claimedAt: string | null;
  createdBy?: string | null;  // Agent ID or "user" for human-created tasks
  commentCount?: number;
  // Archive fields for auto-archiving done tasks
  archived: boolean;       // Soft archive flag (0 = active, 1 = archived)
  archivedAt: string | null;  // ISO timestamp when archived
  doneAt: string | null;   // ISO timestamp when task entered 'done' status
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
  projectId?: string | null;
  domain?: string | null;  // Agent's domain: WORK, FINANCE, PERSONAL, etc.
  createdBy?: string | null;  // Agent ID or "user"
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  status?: string;
  priority?: TaskPriority;
  assignee?: string | null;
  labels?: KanbanLabel[];
  order?: number;
  projectId?: string | null;
  domain?: string | null;  // Update task's domain
  claimedBy?: string | null;  // For claim/unclaim
  claimedAt?: string | null;  // Timestamp when claimed
  archived?: boolean;  // Archive/unarchive task
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
  projectId?: string;
  createdBy?: string;  // Filter by creator (agent ID or "user")
  domain?: string;  // Filter by agent domain (WORK, FINANCE, PERSONAL, etc.)
  view?: "active" | "archived" | "all";  // Archive view filter (default: active)
}

export interface TasksStats {
  total: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
}

export const TASK_COMMENT_AUTHOR_TYPE = {
  HUMAN: "human",
  AGENT: "agent",
  SYSTEM: "system",
} as const;

export type TaskCommentAuthorType = (typeof TASK_COMMENT_AUTHOR_TYPE)[keyof typeof TASK_COMMENT_AUTHOR_TYPE];

export const TASK_COMMENT_TYPE = {
  COMMENT: "comment",
  STATUS_CHANGE: "status_change",
} as const;

export type TaskCommentType = (typeof TASK_COMMENT_TYPE)[keyof typeof TASK_COMMENT_TYPE];

export interface TaskComment {
  id: string;
  taskId: string;
  authorType: TaskCommentAuthorType;
  authorId: string | null;
  body: string;
  commentType: TaskCommentType;
  statusFrom: string | null;
  statusTo: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskCommentInput {
  taskId: string;
  authorType?: TaskCommentAuthorType;
  authorId?: string | null;
  body: string;
  commentType?: TaskCommentType;
  statusFrom?: string | null;
  statusTo?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface ListTaskCommentsFilters {
  taskId: string;
  authorType?: TaskCommentAuthorType;
  authorId?: string;
  commentType?: TaskCommentType;
  limit?: number;
}

// ============================================================================
// Database Setup
// ============================================================================

let _db: Database.Database | null = null;

/**
 * Reset the database connection (for testing only)
 * Closes the current connection and resets the singleton
 */
export function resetDbForTesting(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}

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

    -- Mission Control Tables (idempotent migration)

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      mission_alignment TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      milestones TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS agent_identities (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      personality TEXT,
      avatar TEXT,
      mission TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS operations_journal (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      narrative TEXT NOT NULL,
      highlights TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
    CREATE INDEX IF NOT EXISTS idx_operations_journal_date ON operations_journal(date);
  `);

  // Idempotent migration: Add project_id column to kanban_tasks
  // project_id references projects.id with ON DELETE SET NULL behavior
  const projectColumnExists = _db
    .prepare("SELECT 1 FROM pragma_table_info('kanban_tasks') WHERE name = 'project_id'")
    .get() as { "1": number } | undefined;

  if (!projectColumnExists) {
    _db.exec(`
      ALTER TABLE kanban_tasks ADD COLUMN project_id TEXT;
      -- FK constraint: project_id REFERENCES projects(id) ON DELETE SET NULL
      -- Note: SQLite doesn't support ADD CONSTRAINT, so FK is enforced in deleteProject()
      CREATE INDEX IF NOT EXISTS idx_kanban_tasks_project_id ON kanban_tasks(project_id);
    `);
    console.log("[kanban-db] Added project_id column to kanban_tasks");
  }

  // Idempotent migration: Add new task fields for dependencies and execution
  const migrations = [
    { name: "due_date", sql: "ALTER TABLE kanban_tasks ADD COLUMN due_date TEXT" },
    { name: "depends_on", sql: "ALTER TABLE kanban_tasks ADD COLUMN depends_on TEXT" },
    { name: "execution_status", sql: "ALTER TABLE kanban_tasks ADD COLUMN execution_status TEXT" },
    { name: "execution_result", sql: "ALTER TABLE kanban_tasks ADD COLUMN execution_result TEXT" },
    { name: "blocked_by", sql: "ALTER TABLE kanban_tasks ADD COLUMN blocked_by TEXT" },
    { name: "waiting_for", sql: "ALTER TABLE kanban_tasks ADD COLUMN waiting_for TEXT" },
    { name: "claimed_by", sql: "ALTER TABLE kanban_tasks ADD COLUMN claimed_by TEXT" },
    { name: "claimed_at", sql: "ALTER TABLE kanban_tasks ADD COLUMN claimed_at TEXT" },
    { name: "created_by", sql: "ALTER TABLE kanban_tasks ADD COLUMN created_by TEXT" },
  ];

  for (const migration of migrations) {
    const columnExists = _db
      .prepare("SELECT 1 FROM pragma_table_info('kanban_tasks') WHERE name = ?")
      .get(migration.name) as { "1": number } | undefined;

    if (!columnExists) {
      try {
        _db.exec(migration.sql);
        console.log(`[kanban-db] Added ${migration.name} column to kanban_tasks`);
      } catch {
        // Column may already exist from a previous partial migration
      }
    }
  }

  // Idempotent migration: Add index for claimed_by
  _db.exec(`CREATE INDEX IF NOT EXISTS idx_kanban_tasks_claimed_by ON kanban_tasks(claimed_by)`);

  // Idempotent migration: Add index for created_by
  _db.exec(`CREATE INDEX IF NOT EXISTS idx_kanban_tasks_created_by ON kanban_tasks(created_by)`);

  // Idempotent migration: Add domain column for agent task categorization
  const domainColumnExists = _db
    .prepare("SELECT 1 FROM pragma_table_info('kanban_tasks') WHERE name = 'domain'")
    .get() as { "1": number } | undefined;

  if (!domainColumnExists) {
    _db.exec(`ALTER TABLE kanban_tasks ADD COLUMN domain TEXT`);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_kanban_tasks_domain ON kanban_tasks(domain)`);
    console.log("[kanban-db] Added domain column to kanban_tasks");
  }

  // Idempotent migration: Add task_comments table for task communication
  const commentsTableExists = _db
    .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='task_comments'")
    .get() as { "1": number } | undefined;

  if (!commentsTableExists) {
    _db.exec(`
      CREATE TABLE task_comments (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        author_type TEXT NOT NULL DEFAULT 'human',
        author_id TEXT,
        body TEXT NOT NULL,
        comment_type TEXT NOT NULL DEFAULT 'comment',
        status_from TEXT,
        status_to TEXT,
        metadata TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        -- Legacy mirror columns kept for backward compatibility
        agent_id TEXT,
        content TEXT
      );
    `);
    console.log("[kanban-db] Created task_comments table");
  }

  const commentMigrations = [
    { name: "author_type", sql: "ALTER TABLE task_comments ADD COLUMN author_type TEXT" },
    { name: "author_id", sql: "ALTER TABLE task_comments ADD COLUMN author_id TEXT" },
    { name: "body", sql: "ALTER TABLE task_comments ADD COLUMN body TEXT" },
    { name: "comment_type", sql: "ALTER TABLE task_comments ADD COLUMN comment_type TEXT" },
    { name: "status_from", sql: "ALTER TABLE task_comments ADD COLUMN status_from TEXT" },
    { name: "status_to", sql: "ALTER TABLE task_comments ADD COLUMN status_to TEXT" },
    { name: "metadata", sql: "ALTER TABLE task_comments ADD COLUMN metadata TEXT" },
    { name: "agent_id", sql: "ALTER TABLE task_comments ADD COLUMN agent_id TEXT" },
    { name: "content", sql: "ALTER TABLE task_comments ADD COLUMN content TEXT" },
  ];

  for (const migration of commentMigrations) {
    const columnExists = _db
      .prepare("SELECT 1 FROM pragma_table_info('task_comments') WHERE name = ?")
      .get(migration.name) as { "1": number } | undefined;

    if (!columnExists) {
      try {
        _db.exec(migration.sql);
        console.log(`[kanban-db] Added ${migration.name} column to task_comments`);
      } catch {
        // Column may already exist from a previous partial migration
      }
    }
  }

  _db.exec(`
    UPDATE task_comments
    SET
      author_type = COALESCE(NULLIF(author_type, ''), CASE WHEN agent_id IS NOT NULL AND TRIM(agent_id) != '' THEN 'agent' ELSE 'human' END),
      author_id = COALESCE(NULLIF(author_id, ''), NULLIF(agent_id, '')),
      body = COALESCE(NULLIF(body, ''), NULLIF(content, '')),
      comment_type = COALESCE(NULLIF(comment_type, ''), 'comment'),
      updated_at = COALESCE(NULLIF(updated_at, ''), created_at)
    WHERE
      author_type IS NULL OR author_type = '' OR
      body IS NULL OR body = '' OR
      comment_type IS NULL OR comment_type = '' OR
      updated_at IS NULL OR updated_at = ''
  `);

  _db.exec(`CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON task_comments(task_id)`);
  _db.exec(`CREATE INDEX IF NOT EXISTS idx_task_comments_agent_id ON task_comments(agent_id)`);
  _db.exec(`CREATE INDEX IF NOT EXISTS idx_task_comments_task_created ON task_comments(task_id, created_at DESC, id DESC)`);
  _db.exec(`CREATE INDEX IF NOT EXISTS idx_task_comments_author ON task_comments(author_type, author_id)`);
  _db.exec(`CREATE INDEX IF NOT EXISTS idx_task_comments_type ON task_comments(comment_type)`);

  // Idempotent migration: Add archive fields for auto-archiving done tasks
  const archiveMigrations = [
    { name: "archived", sql: "ALTER TABLE kanban_tasks ADD COLUMN archived INTEGER NOT NULL DEFAULT 0" },
    { name: "archived_at", sql: "ALTER TABLE kanban_tasks ADD COLUMN archived_at TEXT" },
    { name: "done_at", sql: "ALTER TABLE kanban_tasks ADD COLUMN done_at TEXT" },
  ];

  for (const migration of archiveMigrations) {
    const columnExists = _db
      .prepare("SELECT 1 FROM pragma_table_info('kanban_tasks') WHERE name = ?")
      .get(migration.name) as { "1": number } | undefined;

    if (!columnExists) {
      try {
        _db.exec(migration.sql);
        console.log(`[kanban-db] Added ${migration.name} column to kanban_tasks`);
      } catch {
        // Column may already exist from a previous partial migration
      }
    }
  }

  // Add index for efficient archive queries and auto-archive sweep
  _db.exec(`CREATE INDEX IF NOT EXISTS idx_kanban_tasks_archive ON kanban_tasks(archived, status, done_at)`);

  // Backfill: Set done_at for existing done tasks (use updated_at as approximation)
  _db.exec(`
    UPDATE kanban_tasks
    SET done_at = updated_at
    WHERE status = 'done' AND done_at IS NULL
  `);

  // Seed default columns if table is empty
  const columnCount = (_db.prepare("SELECT COUNT(*) as n FROM kanban_columns").get() as { n: number }).n;
  if (columnCount === 0) {
    const defaultColumns = [
      { id: "backlog", name: "Backlog", color: "#6b7280", order: 0, limit: null },
      { id: "in_progress", name: "In Progress", color: "#3b82f6", order: 1, limit: null },
      { id: "review", name: "Review", color: "#f59e0b", order: 2, limit: null },
      { id: "done", name: "Done", color: "#22c55e", order: 3, limit: null },
      { id: "blocked", name: "Blocked", color: "#ef4444", order: 4, limit: null },
      { id: "waiting", name: "Waiting", color: "#a855f7", order: 5, limit: null },
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
    console.log("[kanban-db] Seeded default columns including blocked/waiting");
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
  const projectId = input.projectId ?? null;
  const createdBy = input.createdBy ?? null;
  const domain = input.domain ?? null;

  // Get the max order in the target column to append at the end
  const maxOrder = (db.prepare(`
    SELECT COALESCE(MAX("order"), 0) as maxOrder FROM kanban_tasks WHERE status = ?
  `).get(status) as { maxOrder: number }).maxOrder;

  const order = maxOrder + 1000;

  db.prepare(`
    INSERT INTO kanban_tasks (id, title, description, status, priority, assignee, labels, "order", project_id, domain, created_at, updated_at, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.title,
    input.description ?? null,
    status,
    priority,
    input.assignee ?? null,
    JSON.stringify(labels),
    order,
    projectId,
    domain,
    now,
    now,
    createdBy
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
        projectId,
        createdBy,
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
    projectId,
    domain: input.domain ?? null,
    created_at: now,
    updated_at: now,
    dueDate: null,
    dependsOn: null,
    executionStatus: null,
    executionResult: null,
    blockedBy: null,
    waitingFor: null,
    claimedBy: null,
    claimedAt: null,
    createdBy,
    // Archive fields - new tasks start as active
    archived: false,
    archivedAt: null,
    doneAt: null,
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
    // Set done_at when task moves to 'done' status
    if (updates.status === "done" && existing.status !== "done") {
      fields.push("done_at = ?");
      values.push(now);
    }
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
  if (updates.projectId !== undefined) {
    fields.push("project_id = ?");
    values.push(updates.projectId);
  }

  if (updates.claimedBy !== undefined) {
    fields.push("claimed_by = ?");
    values.push(updates.claimedBy);
  }

  if (updates.claimedAt !== undefined) {
    fields.push("claimed_at = ?");
    values.push(updates.claimedAt);
  }

  // Handle archive/unarchive
  if (updates.archived !== undefined) {
    if (updates.archived) {
      fields.push("archived = 1");
      fields.push("archived_at = ?");
      values.push(now);
    } else {
      fields.push("archived = 0");
      fields.push("archived_at = NULL");
    }
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
 * @param filters - Optional filters for status, assignee, priority, search, and view
 * @returns Array of tasks ordered by their order field
 */
export function listTasks(filters?: ListTasksFilters): KanbanTask[] {
  // Trigger auto-archive sweep on read (lazy, throttled)
  runAutoArchiveSweepIfDue();

  const db = getDb();

  const conditions: string[] = [];
  const params: unknown[] = [];

  // Handle archive view filter (default: active only)
  const view = filters?.view ?? "active";
  if (view === "active") {
    conditions.push("archived = 0");
  } else if (view === "archived") {
    conditions.push("archived = 1");
  }
  // view === "all" => no filter on archived

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

  if (filters?.projectId !== undefined) {
    conditions.push("project_id = ?");
    params.push(filters.projectId);
  }

  if (filters?.createdBy) {
    conditions.push("created_by = ?");
    params.push(filters.createdBy);
  }

  if (filters?.domain) {
    conditions.push("domain = ?");
    params.push(filters.domain);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const rows = db.prepare(`
    SELECT
      kanban_tasks.*,
      COALESCE(comment_counts.comment_count, 0) as comment_count
    FROM kanban_tasks
    LEFT JOIN (
      SELECT task_id, COUNT(*) as comment_count
      FROM task_comments
      GROUP BY task_id
    ) as comment_counts ON comment_counts.task_id = kanban_tasks.id
    ${where}
    ORDER BY kanban_tasks."order" ASC
  `).all(...params) as Record<string, unknown>[];

  return rows.map(parseTaskRow);
}

const TASK_COMMENT_MAX_BODY_LENGTH = 5000;
const TASK_COMMENT_MAX_AUTHOR_ID_LENGTH = 120;
const TASK_COMMENT_MAX_STATUS_LENGTH = 64;
const TASK_COMMENT_DEFAULT_LIMIT = 50;
const TASK_COMMENT_MAX_LIMIT = 200;

function parseTaskCommentMetadata(raw: unknown): Record<string, unknown> | null {
  if (!raw) {
    return null;
  }

  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      return null;
    } catch {
      return null;
    }
  }

  if (typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }

  return null;
}

function normalizeOptionalString(value: unknown, maxLength: number, fieldName: string): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error(`${fieldName} must be a string`);
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  if (trimmed.length > maxLength) {
    throw new Error(`${fieldName} must be ${maxLength} characters or less`);
  }

  return trimmed;
}

/**
 * Create a comment for a task
 * @param input - Comment creation data
 * @returns The created task comment
 */
export function createTaskComment(input: CreateTaskCommentInput): TaskComment {
  const db = getDb();

  const taskId = normalizeOptionalString(input.taskId, 128, "taskId");
  if (!taskId) {
    throw new Error("taskId is required");
  }

  const taskExists = db.prepare("SELECT 1 FROM kanban_tasks WHERE id = ?").get(taskId) as { "1": number } | undefined;
  if (!taskExists) {
    throw new Error("Task not found");
  }

  const authorType = input.authorType ?? TASK_COMMENT_AUTHOR_TYPE.HUMAN;
  const validAuthorTypes = Object.values(TASK_COMMENT_AUTHOR_TYPE) as TaskCommentAuthorType[];
  if (!validAuthorTypes.includes(authorType)) {
    throw new Error(`authorType must be one of: ${validAuthorTypes.join(", ")}`);
  }

  const authorId = normalizeOptionalString(input.authorId, TASK_COMMENT_MAX_AUTHOR_ID_LENGTH, "authorId");

  if (typeof input.body !== "string") {
    throw new Error("body is required");
  }

  const body = input.body.trim();
  if (body.length === 0) {
    throw new Error("body is required");
  }

  if (body.length > TASK_COMMENT_MAX_BODY_LENGTH) {
    throw new Error(`body must be ${TASK_COMMENT_MAX_BODY_LENGTH} characters or less`);
  }

  const commentType = input.commentType ?? TASK_COMMENT_TYPE.COMMENT;
  const validCommentTypes = Object.values(TASK_COMMENT_TYPE) as TaskCommentType[];
  if (!validCommentTypes.includes(commentType)) {
    throw new Error(`commentType must be one of: ${validCommentTypes.join(", ")}`);
  }

  const statusFrom = normalizeOptionalString(input.statusFrom, TASK_COMMENT_MAX_STATUS_LENGTH, "statusFrom");
  const statusTo = normalizeOptionalString(input.statusTo, TASK_COMMENT_MAX_STATUS_LENGTH, "statusTo");

  if (commentType === TASK_COMMENT_TYPE.STATUS_CHANGE && !statusTo) {
    throw new Error("statusTo is required when commentType is status_change");
  }

  const metadata = input.metadata ?? null;
  if (metadata !== null && (typeof metadata !== "object" || Array.isArray(metadata))) {
    throw new Error("metadata must be an object");
  }

  const metadataJson = metadata ? JSON.stringify(metadata) : null;
  if (metadataJson && metadataJson.length > 20000) {
    throw new Error("metadata is too large");
  }

  const id = randomUUID();
  const now = new Date().toISOString();
  const legacyAgentId = authorType === TASK_COMMENT_AUTHOR_TYPE.AGENT ? authorId : null;

  db.prepare(`
    INSERT INTO task_comments (
      id,
      task_id,
      author_type,
      author_id,
      body,
      comment_type,
      status_from,
      status_to,
      metadata,
      created_at,
      updated_at,
      agent_id,
      content
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    taskId,
    authorType,
    authorId,
    body,
    commentType,
    statusFrom,
    statusTo,
    metadataJson,
    now,
    now,
    legacyAgentId,
    body
  );

  return {
    id,
    taskId,
    authorType,
    authorId,
    body,
    commentType,
    statusFrom,
    statusTo,
    metadata,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * List comments for a task with deterministic ordering
 * @param filters - Required task ID and optional filters
 * @returns Array of comments ordered by createdAt desc, id desc
 */
export function listTaskComments(filters: ListTaskCommentsFilters): TaskComment[] {
  const db = getDb();
  const taskId = normalizeOptionalString(filters.taskId, 128, "taskId");

  if (!taskId) {
    throw new Error("taskId is required");
  }

  const conditions: string[] = ["task_id = ?"];
  const params: unknown[] = [taskId];

  if (filters.authorType) {
    const validAuthorTypes = Object.values(TASK_COMMENT_AUTHOR_TYPE) as TaskCommentAuthorType[];
    if (!validAuthorTypes.includes(filters.authorType)) {
      throw new Error(`authorType must be one of: ${validAuthorTypes.join(", ")}`);
    }
    conditions.push("author_type = ?");
    params.push(filters.authorType);
  }

  if (filters.authorId) {
    conditions.push("author_id = ?");
    params.push(filters.authorId);
  }

  if (filters.commentType) {
    const validCommentTypes = Object.values(TASK_COMMENT_TYPE) as TaskCommentType[];
    if (!validCommentTypes.includes(filters.commentType)) {
      throw new Error(`commentType must be one of: ${validCommentTypes.join(", ")}`);
    }
    conditions.push("comment_type = ?");
    params.push(filters.commentType);
  }

  const rawLimit = Number.isFinite(filters.limit) ? Number(filters.limit) : TASK_COMMENT_DEFAULT_LIMIT;
  const limit = Math.max(1, Math.min(TASK_COMMENT_MAX_LIMIT, Math.floor(rawLimit)));

  params.push(limit);

  const rows = db.prepare(`
    SELECT *
    FROM task_comments
    WHERE ${conditions.join(" AND ")}
    ORDER BY created_at DESC, id DESC
    LIMIT ?
  `).all(...params) as Record<string, unknown>[];

  return rows.map(parseCommentRow);
}

/**
 * List all task comments for analytics and reporting
 * @returns Array of comments ordered by createdAt asc, id asc
 */
export function listAllTaskComments(): TaskComment[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT *
    FROM task_comments
    ORDER BY created_at ASC, id ASC
  `).all() as Record<string, unknown>[];

  return rows.map(parseCommentRow);
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
 * @param includeArchived - Whether to include archived tasks (default: false)
 * @returns Stats object with totals by status and priority
 */
export function getTasksStats(includeArchived = false): TasksStats {
  // Trigger auto-archive sweep on read (lazy, throttled)
  runAutoArchiveSweepIfDue();

  const db = getDb();

  const archiveFilter = includeArchived ? "" : "WHERE archived = 0";

  const total = (db.prepare(`SELECT COUNT(*) as n FROM kanban_tasks ${archiveFilter}`).get() as { n: number }).n;

  const statusRows = db.prepare(`SELECT status, COUNT(*) as n FROM kanban_tasks ${archiveFilter} GROUP BY status`).all() as Array<{ status: string; n: number }>;
  const byStatus: Record<string, number> = {};
  for (const r of statusRows) byStatus[r.status] = r.n;

  const priorityRows = db.prepare(`SELECT priority, COUNT(*) as n FROM kanban_tasks ${archiveFilter} GROUP BY priority`).all() as Array<{ priority: string; n: number }>;
  const byPriority: Record<string, number> = {};
  for (const r of priorityRows) byPriority[r.priority] = r.n;

  return { total, byStatus, byPriority };
}

// ============================================================================
// Task Claiming Operations (Multi-Agent Coordination)
// ============================================================================

export interface ClaimResult {
  success: boolean;
  task?: KanbanTask;
  reason?: "not_found" | "already_claimed" | "claimed_by_other";
}

export interface ReleaseResult {
  success: boolean;
  reason?: "not_found" | "not_claimed" | "claimed_by_other";
}

export interface AgentWorkload {
  agentId: string;
  todo: number;
  inProgress: number;
  done: number;
  claimed: number;
}

/**
 * Atomically claim a task for an agent
 * Uses SQL UPDATE with WHERE claimed_by IS NULL for atomicity
 * @param taskId - Task UUID
 * @param agentName - Name of the claiming agent
 * @returns ClaimResult with success status and task if claimed
 */
export function claimTask(taskId: string, agentName: string): ClaimResult {
  const db = getDb();
  const task = getTask(taskId);

  if (!task) {
    return { success: false, reason: "not_found" };
  }

  if (task.claimedBy === agentName) {
    return { success: true, task };
  }

  if (task.claimedBy !== null) {
    return { success: false, reason: "claimed_by_other" };
  }

  const now = new Date().toISOString();
  const result = db.prepare(`
    UPDATE kanban_tasks
    SET claimed_by = ?, claimed_at = ?, updated_at = ?
    WHERE id = ? AND claimed_by IS NULL
  `).run(agentName, now, now, taskId);

  if (result.changes === 0) {
    return { success: false, reason: "already_claimed" };
  }

  const claimedTask = getTask(taskId);

  logActivity(
    "task",
    `Task "${task.title}" claimed by ${agentName}`,
    "success",
    {
      metadata: {
        taskId,
        taskTitle: task.title,
        agentName,
      },
    }
  );

  return { success: true, task: claimedTask ?? undefined };
}

/**
 * Release a task claim
 * Only the claiming agent can release their own claim
 * @param taskId - Task UUID
 * @param agentName - Name of the agent releasing the claim
 * @returns ReleaseResult with success status
 */
export function releaseTask(taskId: string, agentName: string): ReleaseResult {
  const db = getDb();
  const task = getTask(taskId);

  if (!task) {
    return { success: false, reason: "not_found" };
  }

  if (task.claimedBy === null) {
    return { success: false, reason: "not_claimed" };
  }

  if (task.claimedBy !== agentName) {
    return { success: false, reason: "claimed_by_other" };
  }

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE kanban_tasks
    SET claimed_by = NULL, claimed_at = NULL, updated_at = ?
    WHERE id = ? AND claimed_by = ?
  `).run(now, taskId, agentName);

  logActivity(
    "task",
    `Task "${task.title}" released by ${agentName}`,
    "success",
    {
      metadata: {
        taskId,
        taskTitle: task.title,
        agentName,
      },
    }
  );

  return { success: true };
}

/**
 * Get workload statistics for an agent
 * @param agentName - Name of the agent
 * @returns AgentWorkload with counts by status
 */
export function getAgentWorkload(agentName: string): AgentWorkload {
  const db = getDb();

  const statusRows = db.prepare(`
    SELECT status, COUNT(*) as n
    FROM kanban_tasks
    WHERE assignee = ?
    GROUP BY status
  `).all(agentName) as Array<{ status: string; n: number }>;

  const claimedCount = (db.prepare(`
    SELECT COUNT(*) as n
    FROM kanban_tasks
    WHERE claimed_by = ?
  `).get(agentName) as { n: number }).n;

  const byStatus: Record<string, number> = {
    backlog: 0,
    in_progress: 0,
    done: 0,
  };

  for (const row of statusRows) {
    if (row.status === "backlog" || row.status === "todo") {
      byStatus.backlog += row.n;
    } else if (row.status === "in_progress") {
      byStatus.in_progress = row.n;
    } else if (row.status === "done") {
      byStatus.done = row.n;
    } else if (row.status !== "review" && row.status !== "blocked" && row.status !== "waiting") {
      byStatus.backlog += row.n;
    }
  }

  return {
    agentId: agentName,
    todo: byStatus.backlog,
    inProgress: byStatus.in_progress,
    done: byStatus.done,
    claimed: claimedCount,
  };
}

/**
 * Get all tasks claimed by an agent
 * @param agentName - Name of the agent
 * @returns Array of tasks claimed by the agent
 */
export function getTasksByClaimant(agentName: string): KanbanTask[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT * FROM kanban_tasks
    WHERE claimed_by = ?
    ORDER BY claimed_at ASC
  `).all(agentName) as Record<string, unknown>[];

  return rows.map(parseTaskRow);
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
    projectId: (row.project_id as string | null) ?? null,
    domain: (row.domain as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    // New fields for dependencies and execution tracking
    dueDate: (row.due_date as string | null) ?? null,
    dependsOn: row.depends_on ? JSON.parse(row.depends_on as string) : null,
    executionStatus: (row.execution_status as KanbanTask["executionStatus"]) ?? null,
    executionResult: (row.execution_result as string | null) ?? null,
    blockedBy: row.blocked_by ? JSON.parse(row.blocked_by as string) : null,
    waitingFor: row.waiting_for ? JSON.parse(row.waiting_for as string) : null,
    // Claim fields for multi-agent coordination
    claimedBy: (row.claimed_by as string | null) ?? null,
    claimedAt: (row.claimed_at as string | null) ?? null,
    // Creator field for agent-created tasks
    createdBy: (row.created_by as string | null) ?? null,
    commentCount: Number.isFinite(row.comment_count) ? Number(row.comment_count) : 0,
    // Archive fields for auto-archiving done tasks
    archived: Boolean(row.archived),
    archivedAt: (row.archived_at as string | null) ?? null,
    doneAt: (row.done_at as string | null) ?? null,
  };
}

function parseCommentRow(row: Record<string, unknown>): TaskComment {
  const validAuthorTypes = Object.values(TASK_COMMENT_AUTHOR_TYPE) as TaskCommentAuthorType[];
  const validCommentTypes = Object.values(TASK_COMMENT_TYPE) as TaskCommentType[];

  const legacyAgentId = typeof row.agent_id === "string" && row.agent_id.trim().length > 0
    ? row.agent_id.trim()
    : null;

  const rawAuthorType = typeof row.author_type === "string" ? row.author_type : null;
  const authorType = rawAuthorType && validAuthorTypes.includes(rawAuthorType as TaskCommentAuthorType)
    ? rawAuthorType as TaskCommentAuthorType
    : (legacyAgentId ? TASK_COMMENT_AUTHOR_TYPE.AGENT : TASK_COMMENT_AUTHOR_TYPE.HUMAN);

  const rawAuthorId = typeof row.author_id === "string" && row.author_id.trim().length > 0
    ? row.author_id.trim()
    : null;
  const authorId = rawAuthorId ?? legacyAgentId;

  const rawBody = typeof row.body === "string" && row.body.length > 0
    ? row.body
    : (typeof row.content === "string" ? row.content : "");

  const rawCommentType = typeof row.comment_type === "string" ? row.comment_type : null;
  const commentType = rawCommentType && validCommentTypes.includes(rawCommentType as TaskCommentType)
    ? rawCommentType as TaskCommentType
    : TASK_COMMENT_TYPE.COMMENT;

  const createdAt = typeof row.created_at === "string" && row.created_at.length > 0
    ? row.created_at
    : new Date(0).toISOString();

  const updatedAt = typeof row.updated_at === "string" && row.updated_at.length > 0
    ? row.updated_at
    : createdAt;

  const statusFrom = typeof row.status_from === "string" && row.status_from.trim().length > 0
    ? row.status_from
    : null;
  const statusTo = typeof row.status_to === "string" && row.status_to.trim().length > 0
    ? row.status_to
    : null;

  return {
    id: row.id as string,
    taskId: row.task_id as string,
    authorType,
    authorId,
    body: rawBody,
    commentType,
    statusFrom,
    statusTo,
    metadata: parseTaskCommentMetadata(row.metadata),
    createdAt,
    updatedAt,
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
// Project CRUD Operations
// ============================================================================

/**
 * Create a new project
 * @param input - Project creation data
 * @returns The created project
 */
export function createProject(input: CreateProjectInput): Project {
  const db = getDb();
  const id = randomUUID();
  const now = new Date().toISOString();
  const status = input.status ?? "active";
  const milestones = input.milestones ?? [];

  db.prepare(`
    INSERT INTO projects (id, name, description, mission_alignment, status, milestones, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.name,
    input.description ?? null,
    input.missionAlignment ?? null,
    status,
    JSON.stringify(milestones),
    now,
    now
  );

  return {
    id,
    name: input.name,
    description: input.description ?? null,
    missionAlignment: input.missionAlignment ?? null,
    status: status as ProjectStatus,
    milestones,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Get a project by ID
 * @param id - Project UUID
 * @returns The project or null if not found
 */
export function getProject(id: string): Project | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM projects WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  return row ? parseProjectRow(row) : null;
}

/**
 * Update a project
 * @param id - Project UUID
 * @param updates - Fields to update
 * @returns The updated project or null if not found
 */
export function updateProject(id: string, updates: UpdateProjectInput): Project | null {
  const db = getDb();
  const existing = getProject(id);
  if (!existing) return null;

  const now = new Date().toISOString();
  const fields: string[] = [];
  const values: unknown[] = [];

  if (updates.name !== undefined) {
    fields.push("name = ?");
    values.push(updates.name);
  }
  if (updates.description !== undefined) {
    fields.push("description = ?");
    values.push(updates.description);
  }
  if (updates.missionAlignment !== undefined) {
    fields.push("mission_alignment = ?");
    values.push(updates.missionAlignment);
  }
  if (updates.status !== undefined) {
    fields.push("status = ?");
    values.push(updates.status);
  }
  if (updates.milestones !== undefined) {
    fields.push("milestones = ?");
    values.push(JSON.stringify(updates.milestones));
  }

  if (fields.length === 0) return existing;

  fields.push("updated_at = ?");
  values.push(now);
  values.push(id);

  db.prepare(`UPDATE projects SET ${fields.join(", ")} WHERE id = ?`).run(...values);

  return getProject(id);
}

/**
 * Delete a project
 * @param id - Project UUID
 * @returns Object with deleted status and count of orphaned tasks
 */
export function deleteProject(id: string): { deleted: boolean; orphanedTasks: number } {
  const db = getDb();

  // Count tasks that will be orphaned
  const taskCount = (db.prepare("SELECT COUNT(*) as n FROM kanban_tasks WHERE project_id = ?").get(id) as { n: number }).n;

  // Orphan tasks (set project_id to NULL) - enforces ON DELETE SET NULL behavior
  if (taskCount > 0) {
    db.prepare("UPDATE kanban_tasks SET project_id = NULL WHERE project_id = ?").run(id);
  }

  const result = db.prepare("DELETE FROM projects WHERE id = ?").run(id);
  return { deleted: result.changes > 0, orphanedTasks: taskCount };
}

/**
 * List projects with optional filters
 * @param filters - Optional filters for status
 * @returns Array of projects ordered by creation date (newest first)
 */
export function listProjects(filters?: ListProjectsFilters): Project[] {
  const db = getDb();

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters?.status) {
    conditions.push("status = ?");
    params.push(filters.status);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const rows = db.prepare(`SELECT * FROM projects ${where} ORDER BY created_at DESC`).all(...params) as Record<string, unknown>[];

  return rows.map(parseProjectRow);
}

function parseProjectRow(row: Record<string, unknown>): Project {
  return {
    id: row.id as string,
    name: row.name as string,
    description: row.description as string | null,
    missionAlignment: row.mission_alignment as string | null,
    status: row.status as ProjectStatus,
    milestones: row.milestones ? JSON.parse(row.milestones as string) : [],
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// ============================================================================
// Agent Identity CRUD Operations
// ============================================================================

/**
 * Create a new agent identity
 * @param input - Agent identity creation data
 * @returns The created agent identity
 */
export function createAgentIdentity(input: CreateAgentIdentityInput): AgentIdentity {
  const db = getDb();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO agent_identities (id, name, role, personality, avatar, mission, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.id,
    input.name,
    input.role,
    input.personality ?? null,
    input.avatar ?? null,
    input.mission ?? null,
    now,
    now
  );

  return {
    id: input.id,
    name: input.name,
    role: input.role,
    personality: input.personality ?? null,
    avatar: input.avatar ?? null,
    mission: input.mission ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Get an agent identity by ID
 * @param id - Agent identifier
 * @returns The agent identity or null if not found
 */
export function getAgentIdentity(id: string): AgentIdentity | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM agent_identities WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  return row ? parseAgentIdentityRow(row) : null;
}

/**
 * Update an agent identity
 * @param id - Agent identifier
 * @param updates - Fields to update
 * @returns The updated agent identity or null if not found
 */
export function updateAgentIdentity(id: string, updates: UpdateAgentIdentityInput): AgentIdentity | null {
  const db = getDb();
  const existing = getAgentIdentity(id);
  if (!existing) return null;

  const now = new Date().toISOString();
  const fields: string[] = [];
  const values: unknown[] = [];

  if (updates.name !== undefined) {
    fields.push("name = ?");
    values.push(updates.name);
  }
  if (updates.role !== undefined) {
    fields.push("role = ?");
    values.push(updates.role);
  }
  if (updates.personality !== undefined) {
    fields.push("personality = ?");
    values.push(updates.personality);
  }
  if (updates.avatar !== undefined) {
    fields.push("avatar = ?");
    values.push(updates.avatar);
  }
  if (updates.mission !== undefined) {
    fields.push("mission = ?");
    values.push(updates.mission);
  }

  if (fields.length === 0) return existing;

  fields.push("updated_at = ?");
  values.push(now);
  values.push(id);

  db.prepare(`UPDATE agent_identities SET ${fields.join(", ")} WHERE id = ?`).run(...values);

  return getAgentIdentity(id);
}

/**
 * Delete an agent identity
 * @param id - Agent identifier
 * @returns True if deleted, false if not found
 */
export function deleteAgentIdentity(id: string): boolean {
  const db = getDb();
  const result = db.prepare("DELETE FROM agent_identities WHERE id = ?").run(id);
  return result.changes > 0;
}

/**
 * List all agent identities
 * @returns Array of agent identities ordered by creation date
 */
export function listAgentIdentities(): AgentIdentity[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM agent_identities ORDER BY created_at ASC").all() as Record<string, unknown>[];
  return rows.map(parseAgentIdentityRow);
}

function parseAgentIdentityRow(row: Record<string, unknown>): AgentIdentity {
  return {
    id: row.id as string,
    name: row.name as string,
    role: row.role as string,
    personality: row.personality as string | null,
    avatar: row.avatar as string | null,
    mission: row.mission as string | null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// ============================================================================
// Operations Journal CRUD Operations
// ============================================================================

/**
 * Create a new journal entry
 * @param input - Journal entry creation data
 * @returns The created journal entry
 */
export function createJournalEntry(input: CreateJournalEntryInput): OperationsJournalEntry {
  const db = getDb();
  const id = randomUUID();
  const now = new Date().toISOString();
  const highlights = input.highlights ?? [];

  db.prepare(`
    INSERT INTO operations_journal (id, date, narrative, highlights, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    id,
    input.date,
    input.narrative,
    JSON.stringify(highlights),
    now
  );

  return {
    id,
    date: input.date,
    narrative: input.narrative,
    highlights,
    createdAt: now,
  };
}

/**
 * Get a journal entry by ID
 * @param id - Entry UUID
 * @returns The journal entry or null if not found
 */
export function getJournalEntry(id: string): OperationsJournalEntry | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM operations_journal WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  return row ? parseJournalEntryRow(row) : null;
}

/**
 * Update a journal entry
 * @param id - Entry UUID
 * @param updates - Fields to update
 * @returns The updated journal entry or null if not found
 */
export function updateJournalEntry(id: string, updates: UpdateJournalEntryInput): OperationsJournalEntry | null {
  const db = getDb();
  const existing = getJournalEntry(id);
  if (!existing) return null;

  const fields: string[] = [];
  const values: unknown[] = [];

  if (updates.date !== undefined) {
    fields.push("date = ?");
    values.push(updates.date);
  }
  if (updates.narrative !== undefined) {
    fields.push("narrative = ?");
    values.push(updates.narrative);
  }
  if (updates.highlights !== undefined) {
    fields.push("highlights = ?");
    values.push(JSON.stringify(updates.highlights));
  }

  if (fields.length === 0) return existing;

  values.push(id);

  db.prepare(`UPDATE operations_journal SET ${fields.join(", ")} WHERE id = ?`).run(...values);

  return getJournalEntry(id);
}

/**
 * List journal entries with optional date range filter
 * @param filters - Optional filters for date range
 * @returns Array of journal entries ordered by date (newest first)
 */
export function listJournalEntries(filters?: ListJournalEntriesFilters): OperationsJournalEntry[] {
  const db = getDb();

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters?.startDate) {
    conditions.push("date >= ?");
    params.push(filters.startDate);
  }

  if (filters?.endDate) {
    conditions.push("date <= ?");
    params.push(filters.endDate);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const rows = db.prepare(`SELECT * FROM operations_journal ${where} ORDER BY date DESC`).all(...params) as Record<string, unknown>[];

  return rows.map(parseJournalEntryRow);
}

/**
 * Delete a journal entry
 * @param id - Entry UUID
 * @returns True if deleted, false if not found
 */
export function deleteJournalEntry(id: string): boolean {
  const db = getDb();
  const result = db.prepare("DELETE FROM operations_journal WHERE id = ?").run(id);
  return result.changes > 0;
}

function parseJournalEntryRow(row: Record<string, unknown>): OperationsJournalEntry {
  return {
    id: row.id as string,
    date: row.date as string,
    narrative: row.narrative as string,
    highlights: row.highlights ? JSON.parse(row.highlights as string) : [],
    createdAt: row.created_at as string,
  };
}

// ============================================================================
// Auto-Archive Engine
// ============================================================================

// Throttle state for auto-archive sweep (in-memory, per process)
let lastAutoArchiveSweep = 0;
const AUTO_ARCHIVE_SWEEP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Get the configured auto-archive threshold in days
 * @returns Number of days before auto-archiving done tasks (default: 7)
 */
export function getAutoArchiveDays(): number {
  const envValue = process.env.KANBAN_AUTO_ARCHIVE_DAYS;
  if (envValue) {
    const parsed = parseInt(envValue, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return 7;
}

/**
 * Run auto-archive sweep if enough time has passed since last run
 * Archives done tasks older than KANBAN_AUTO_ARCHIVE_DAYS (default: 7)
 * 
 * Uses lazy throttle: only runs once per hour per process
 * Uses indexed UPDATE for efficiency
 * 
 * @returns Number of tasks archived, or 0 if sweep was throttled
 */
export function runAutoArchiveSweepIfDue(): number {
  const now = Date.now();
  
  // Throttle: only run once per hour
  if (now - lastAutoArchiveSweep < AUTO_ARCHIVE_SWEEP_INTERVAL_MS) {
    return 0;
  }
  
  lastAutoArchiveSweep = now;
  
  const db = getDb();
  const archiveDays = getAutoArchiveDays();
  const cutoffDate = new Date(now - archiveDays * 24 * 60 * 60 * 1000).toISOString();
  const archiveTimestamp = new Date(now).toISOString();
  
  // Single indexed UPDATE - efficient and idempotent
  const result = db.prepare(`
    UPDATE kanban_tasks
    SET archived = 1, archived_at = ?
    WHERE archived = 0
      AND status = 'done'
      AND done_at IS NOT NULL
      AND done_at <= ?
  `).run(archiveTimestamp, cutoffDate);
  
  if (result.changes > 0) {
    console.log(`[kanban-db] Auto-archived ${result.changes} done tasks (older than ${archiveDays} days)`);
  }
  
  return result.changes;
}

/**
 * Force run auto-archive sweep (bypasses throttle)
 * Useful for testing or manual triggers
 * 
 * @returns Number of tasks archived
 */
export function forceAutoArchiveSweep(): number {
  lastAutoArchiveSweep = 0;
  return runAutoArchiveSweepIfDue();
}

// ============================================================================
// Testing Utilities
// ============================================================================

/**
 * Clear all data from the database (for testing only)
 * Resets connection and reseeds default columns
 * 
 * IMPORTANT: Call this in beforeEach/afterEach to ensure test isolation
 */
export function clearAllDataForTesting(): void {
  // Reset connection to ensure fresh state
  resetDbForTesting();
  
  const db = getDb();
  db.exec("DELETE FROM kanban_tasks");
  db.exec("DELETE FROM kanban_columns");
  db.exec("DELETE FROM projects");
  db.exec("DELETE FROM agent_identities");
  db.exec("DELETE FROM operations_journal");
  db.exec("DELETE FROM task_comments");
  
  // Re-seed default columns (use INSERT OR IGNORE to handle existing columns)
  const defaultColumns = [
    { id: "backlog", name: "Backlog", color: "#6b7280", order: 0, limit: null },
    { id: "in_progress", name: "In Progress", color: "#3b82f6", order: 1, limit: null },
    { id: "review", name: "Review", color: "#f59e0b", order: 2, limit: null },
    { id: "done", name: "Done", color: "#22c55e", order: 3, limit: null },
  ];

  const insertColumn = db.prepare(`
    INSERT OR IGNORE INTO kanban_columns (id, name, color, "order", "limit")
    VALUES (@id, @name, @color, @order, @limit)
  `);

  const insertMany = db.transaction((columns: typeof defaultColumns) => {
    for (const col of columns) {
      insertColumn.run(col);
    }
  });

  insertMany(defaultColumns);
}

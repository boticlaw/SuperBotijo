# Agent Tasks Kanban - CORRECTED Implementation Plan (v2)

## ⚠️ Analysis: What Already Exists

The kanban system ALREADY has infrastructure for agent tasks:

| Feature | Status | Location |
|---------|--------|----------|
| `assignee` field | ✅ EXISTS | `kanban_tasks.assignee` |
| `claimed_by` / `claimed_at` | ✅ EXISTS | `kanban_tasks` columns |
| `agent_identities` table | ✅ EXISTS | Stores agent profiles |
| `task_comments` table | ✅ EXISTS | Inter-agent communication |
| Task status columns | ✅ EXISTS | backlog, in_progress, review, done, blocked, waiting |
| Agent identity sync | ✅ EXISTS | `src/lib/openclaw-agents.ts` |

## 🔴 What Actually Missing

| Missing Feature | Why It's Needed |
|-----------------|-----------------|
| `created_by` column | Distinguish user-created vs agent-created tasks |
| `created_by` filter in `listTasks` | Filter tasks by creator |
| `UpdateTaskInput` fields | Allow updating claimedBy/claimedAt |
| Agent API endpoints | Let agents create/update tasks programmatically |
| Agent auth (API keys) | Secure the agent API |

---

## Phase 1: Add `created_by` Column (Database)

### Issue #1.1: Add `created_by` column migration

**Location**: `src/lib/kanban-db.ts`

**Task**: Add `created_by` nullable column to track who created the task.

**Why**: We need to know if a task was created by a human user or an agent. The existing `assignee` field is for WHO the task is assigned TO, not WHO created it.

**Steps**:

1. Find the migrations array in `getDb()` (around line 224)
2. Add a new migration:
   ```typescript
   const migrations = [
     // ... existing migrations ...
     { name: "created_by", sql: "ALTER TABLE kanban_tasks ADD COLUMN created_by TEXT" },
   ];
   ```

3. Add index after migrations loop:
   ```typescript
   _db.exec(`CREATE INDEX IF NOT EXISTS idx_kanban_tasks_created_by ON kanban_tasks(created_by)`);
   ```

**Verification**: Restart app, check console for migration log.

---

### Issue #1.2: Update `KanbanTask` interface

**Location**: `src/lib/kanban-db.ts`

**Task**: Add `createdBy` field to the interface.

**Steps**:

Find the `KanbanTask` interface (around line 38) and add:
```typescript
export interface KanbanTask {
  // ... existing fields ...
  assignee: string | null;
  claimedBy: string | null;
  claimedAt: string | null;
  // NEW FIELD
  createdBy: string | null;  // Agent ID or "user" for human-created tasks
}
```

---

### Issue #1.3: Update `CreateTaskInput` interface

**Location**: `src/lib/kanban-db.ts`

**Task**: Add `createdBy` to the input interface.

**Steps**:

Find `CreateTaskInput` (around line 68) and add:
```typescript
export interface CreateTaskInput {
  title: string;
  description?: string | null;
  status?: string;
  priority?: TaskPriority;
  assignee?: string | null;
  labels?: KanbanLabel[];
  projectId?: string | null;
  // NEW FIELD
  createdBy?: string | null;  // Agent ID or "user"
}
```

---

### Issue #1.4: Update `createTask()` function

**Location**: `src/lib/kanban-db.ts`

**Task**: Store `createdBy` when creating a task.

**Steps**:

Find `createTask()` function (around line 314) and update:

1. Add to destructuring:
   ```typescript
   const createdBy = input.createdBy ?? null;
   ```

2. Update INSERT statement:
   ```typescript
   db.prepare(`
     INSERT INTO kanban_tasks (
       id, title, description, status, priority, assignee, labels, 
       "order", project_id, created_at, updated_at, created_by
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
     now,
     now,
     createdBy  // NEW
   );
   ```

---

### Issue #1.5: Update `parseTaskRow()` function

**Location**: `src/lib/kanban-db.ts`

**Task**: Parse `created_by` column when reading from DB.

**Steps**:

Find `parseTaskRow()` and add:
```typescript
function parseTaskRow(row: Record<string, unknown>): KanbanTask {
  return {
    // ... existing fields ...
    createdBy: row.created_by as string | null,
  };
}
```

---

### Issue #1.6: Update `UpdateTaskInput` interface

**Location**: `src/lib/kanban-db.ts`

**Task**: Add `claimedBy` and `claimedAt` fields to allow updating claim status.

**Steps**:

Find `UpdateTaskInput` interface (around line 78) and add:
```typescript
export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  status?: string;
  priority?: TaskPriority;
  assignee?: string | null;
  labels?: KanbanLabel[];
  order?: number;
  projectId?: string | null;
  // NEW FIELDS
  claimedBy?: string | null;  // Agent ID that claimed the task
  claimedAt?: string | null;  // Timestamp when claimed
}
```

---

### Issue #1.7: Update `listTasks()` to filter by `createdBy`

**Location**: `src/lib/kanban-db.ts`

**Task**: Add `createdBy` filter to the `listTasks` function.

**Steps**:

1. Find `ListTasksFilters` interface (around line 103) and add:
```typescript
export interface ListTasksFilters {
  status?: string;
  assignee?: string;
  priority?: TaskPriority;
  search?: string;
  projectId?: string;
  // NEW FILTER
  createdBy?: string;
}
```

2. Find `listTasks()` function (around line 502) and add filter:
```typescript
if (filters?.createdBy) {
  conditions.push("created_by = ?");
  params.push(filters.createdBy);
}
```

---

## Phase 2: Agent Authentication

### Issue #2.1: Create `agent-auth.ts` library

**Location**: `src/lib/agent-auth.ts` (NEW FILE)

**Task**: Create authentication module for agent API requests.

**Design Decision**: Use simple API keys stored in environment variables. Each agent has its own key.

**Steps**:

Create `src/lib/agent-auth.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";

/**
 * Agent API Key Configuration
 * 
 * Format in .env.local:
 * OPENCLAW_AGENT_KEYS=boti:sk-boti-abc123,leo:sk-leo-xyz789,memo:sk-memo-999
 * 
 * Each entry is: agentId:apiKey
 */

// Parse agent keys from environment (memoized)
let _agentKeys: Map<string, string> | null = null;

function getAgentKeys(): Map<string, string> {
  if (_agentKeys) return _agentKeys;
  
  _agentKeys = new Map();
  const raw = process.env.OPENCLAW_AGENT_KEYS || "";
  
  for (const entry of raw.split(",")) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    
    const colonIndex = trimmed.indexOf(":");
    if (colonIndex === -1) continue;
    
    const agentId = trimmed.slice(0, colonIndex).trim();
    const apiKey = trimmed.slice(colonIndex + 1).trim();
    
    if (agentId && apiKey) {
      _agentKeys.set(agentId, apiKey);
    }
  }
  
  return _agentKeys;
}

/**
 * Validate agent authentication from request headers
 * 
 * Required headers:
 * - X-Agent-Id: The agent's ID (e.g., "boti", "leo")
 * - X-Agent-Key: The agent's API key
 * 
 * @returns Agent ID if valid, null if invalid
 */
export function validateAgentAuth(request: NextRequest): string | null {
  const agentId = request.headers.get("X-Agent-Id");
  const agentKey = request.headers.get("X-Agent-Key");
  
  if (!agentId || !agentKey) {
    return null;
  }
  
  const keys = getAgentKeys();
  const expectedKey = keys.get(agentId);
  
  if (!expectedKey || expectedKey !== agentKey) {
    return null;
  }
  
  return agentId;
}

/**
 * Middleware-like function to require agent auth
 * 
 * @returns { agentId: string } if valid, or NextResponse with 401 error
 */
export function requireAgentAuth(
  request: NextRequest
): { agentId: string } | NextResponse {
  const agentId = validateAgentAuth(request);
  
  if (!agentId) {
    return NextResponse.json(
      { 
        error: "Unauthorized", 
        message: "Valid X-Agent-Id and X-Agent-Key headers required" 
      },
      { status: 401 }
    );
  }
  
  return { agentId };
}

/**
 * Get list of configured agent IDs (for UI filters)
 */
export function getConfiguredAgents(): string[] {
  return Array.from(getAgentKeys().keys());
}
```

---

### Issue #2.2: Add environment variable

**Location**: `.env.local`

**Task**: Configure agent API keys.

**Steps**:

Add to `.env.local`:
```bash
# Agent API Keys (format: agentId:apiKey, comma-separated)
# These keys allow agents to create/update tasks via API
OPENCLAW_AGENT_KEYS=boti:sk-boti-secret-key,leo:sk-leo-secret-key,memo:sk-memo-secret-key
```

**IMPORTANT**: Use secure random keys in production!

---

## Phase 3: Agent API Endpoints

### Issue #3.1: Create agent tasks API directory

**Location**: `src/app/api/kanban/agent/` (NEW)

**Task**: Create directory structure.

```bash
mkdir -p src/app/api/kanban/agent/tasks
```

---

### Issue #3.2: POST /api/kanban/agent/tasks (Create Task)

**Location**: `src/app/api/kanban/agent/tasks/route.ts` (NEW FILE)

**Task**: Allow agents to create new tasks.

**Steps**:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createTask, getTask } from "@/lib/kanban-db";
import { requireAgentAuth } from "@/lib/agent-auth";
import { logActivity } from "@/lib/activities-db";

export const dynamic = "force-dynamic";

/**
 * POST /api/kanban/agent/tasks
 * Create a new task as an authenticated agent
 * 
 * Headers:
 * - X-Agent-Id: Agent ID (e.g., "boti")
 * - X-Agent-Key: Agent API key
 * 
 * Body:
 * - title: string (required)
 * - description: string (optional)
 * - status: string (optional, default: "backlog")
 * - priority: "low" | "medium" | "high" | "urgent" (optional)
 * - assignee: string (optional, agent ID to assign to)
 * - projectId: string (optional)
 * - labels: Array<{name, color}> (optional)
 */
export async function POST(request: NextRequest) {
  // Authenticate agent
  const authResult = requireAgentAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }
  const { agentId } = authResult;
  
  try {
    const body = await request.json();
    
    // Validate required fields
    if (!body.title || typeof body.title !== "string") {
      return NextResponse.json(
        { error: "Missing required field: title" },
        { status: 400 }
      );
    }
    
    if (body.title.length > 200) {
      return NextResponse.json(
        { error: "Title must be 200 characters or less" },
        { status: 400 }
      );
    }
    
    // Create task with agent as creator
    const task = createTask({
      title: body.title,
      description: body.description,
      status: body.status,
      priority: body.priority,
      assignee: body.assignee,  // Can assign to another agent
      labels: body.labels,
      projectId: body.projectId,
      createdBy: agentId,  // Agent is the creator
    });
    
    // Log activity
    logActivity("task", `Agent ${agentId} created task: ${task.title}`, "success", {
      agent: agentId,
      metadata: { taskId: task.id, assignedTo: body.assignee },
    });
    
    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    console.error("[agent-tasks] POST error:", error);
    return NextResponse.json(
      { error: "Failed to create task" },
      { status: 500 }
    );
  }
}
```

---

### Issue #3.3: GET /api/kanban/agent/tasks (List Tasks)

**Location**: `src/app/api/kanban/agent/tasks/route.ts` (add to existing)

**Task**: Allow agents to list tasks with filters.

**Steps**:

Add to the same file:

```typescript
import { listTasks } from "@/lib/kanban-db";

/**
 * GET /api/kanban/agent/tasks
 * List tasks with optional filters
 * 
 * Query params:
 * - createdBy: Filter by creator agent ID
 * - assignee: Filter by assigned agent ID
 * - status: Filter by status (backlog, in_progress, etc.)
 * - limit: Max results (default: 100)
 */
export async function GET(request: NextRequest) {
  // Authenticate agent
  const authResult = requireAgentAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }
  
  try {
    const { searchParams } = new URL(request.url);
    const createdBy = searchParams.get("createdBy");
    const assignee = searchParams.get("assignee");
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "100", 10);
    
    // Get all tasks (listTasks returns an array, not {tasks, total})
    const allTasks = listTasks({ limit: limit || 100 });
    
    // Apply filters (createdBy filter is handled by listTasks if added to filters)
    let filtered = allTasks;
    
    if (createdBy) {
      filtered = filtered.filter(t => t.createdBy === createdBy);
    }
    if (assignee) {
      filtered = filtered.filter(t => t.assignee === assignee);
    }
    if (status) {
      filtered = filtered.filter(t => t.status === status);
    }
    
    return NextResponse.json({ 
      tasks: filtered, 
      total: filtered.length 
    });
  } catch (error) {
    console.error("[agent-tasks] GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch tasks" },
      { status: 500 }
    );
  }
}
```

---

### Issue #3.4: PATCH /api/kanban/agent/tasks/[id] (Update Task)

**Location**: `src/app/api/kanban/agent/tasks/[id]/route.ts` (NEW FILE)

**Task**: Allow agents to update tasks.

**Authorization Rules**:
- Agent who CREATED the task can update it
- Agent who is ASSIGNED the task can update it
- Agent who CLAIMED the task can update it

**Steps**:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getTask, updateTask } from "@/lib/kanban-db";
import { requireAgentAuth } from "@/lib/agent-auth";
import { logActivity } from "@/lib/activities-db";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/kanban/agent/tasks/[id]
 * Update a task (status, assignee, claim, etc.)
 * 
 * Authorization: Agent must be creator, assignee, or claimer
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Authenticate agent
  const authResult = requireAgentAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }
  const { agentId } = authResult;
  const { id } = await params;
  
  try {
    // Get existing task
    const task = getTask(id);
    if (!task) {
      return NextResponse.json(
        { error: "Task not found" },
        { status: 404 }
      );
    }
    
    // Authorization check
    const isCreator = task.createdBy === agentId;
    const isAssignee = task.assignee === agentId;
    const isClaimer = task.claimedBy === agentId;
    
    if (!isCreator && !isAssignee && !isClaimer) {
      return NextResponse.json(
        { error: "Not authorized to update this task" },
        { status: 403 }
      );
    }
    
    // Parse update body
    const body = await request.json();
    
    // Build update object (only allow certain fields)
    const updates: Record<string, unknown> = {};
    
    if (body.status !== undefined) {
      // Validate status
      const validStatuses = ["backlog", "in_progress", "review", "done", "blocked", "waiting"];
      if (!validStatuses.includes(body.status)) {
        return NextResponse.json(
          { error: `Invalid status. Valid: ${validStatuses.join(", ")}` },
          { status: 400 }
        );
      }
      updates.status = body.status;
    }
    
    if (body.title !== undefined) updates.title = body.title;
    if (body.description !== undefined) updates.description = body.description;
    if (body.priority !== undefined) updates.priority = body.priority;
    if (body.assignee !== undefined) updates.assignee = body.assignee;
    
    // Claim/unclaim handling
    if (body.claim === true && !task.claimedBy) {
      updates.claimedBy = agentId;
      updates.claimedAt = new Date().toISOString();
    } else if (body.claim === false && task.claimedBy === agentId) {
      updates.claimedBy = null;
      updates.claimedAt = null;
    }
    
    // Apply update
    const updated = updateTask(id, updates);
    
    // Log activity
    logActivity("task", `Agent ${agentId} updated task: ${task.title}`, "success", {
      agent: agentId,
      metadata: { taskId: id, changes: Object.keys(updates) },
    });
    
    return NextResponse.json({ task: updated });
  } catch (error) {
    console.error("[agent-tasks] PATCH error:", error);
    return NextResponse.json(
      { error: "Failed to update task" },
      { status: 500 }
    );
  }
}
```

---

### Issue #3.5: DELETE /api/kanban/agent/tasks/[id] (Delete Task)

**Location**: `src/app/api/kanban/agent/tasks/[id]/route.ts` (add to existing)

**Task**: Allow agents to delete tasks they created.

**Authorization**: Only the CREATOR can delete.

**Steps**:

Add to the same file:

```typescript
import { deleteTask } from "@/lib/kanban-db";

/**
 * DELETE /api/kanban/agent/tasks/[id]
 * Delete a task. Only the creator can delete.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Authenticate agent
  const authResult = requireAgentAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }
  const { agentId } = authResult;
  const { id } = await params;
  
  try {
    const task = getTask(id);
    if (!task) {
      return NextResponse.json(
        { error: "Task not found" },
        { status: 404 }
      );
    }
    
    // Only creator can delete
    if (task.createdBy !== agentId) {
      return NextResponse.json(
        { error: "Only the creator can delete this task" },
        { status: 403 }
      );
    }
    
    deleteTask(id);
    
    logActivity("task", `Agent ${agentId} deleted task: ${task.title}`, "success", {
      agent: agentId,
      metadata: { taskId: id },
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[agent-tasks] DELETE error:", error);
    return NextResponse.json(
      { error: "Failed to delete task" },
      { status: 500 }
    );
  }
}
```

---

## Phase 4: UI Enhancements

### Issue #4.1: Add "Created by" badge to task cards

**Location**: `src/components/kanban/KanbanTask.tsx`

**Task**: Display who created the task.

**Steps**:

Find where other badges are rendered and add:
```typescript
{task.createdBy && (
  <div className="flex items-center gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
    <span className="px-1.5 py-0.5 rounded" 
          style={{ backgroundColor: "var(--card-elevated)" }}>
      Created by: {task.createdBy}
    </span>
  </div>
)}
```

---

### Issue #4.2: Add agent filter dropdowns

**Location**: `src/components/kanban/KanbanBoard.tsx` or the kanban page

**Task**: Add filters to show tasks by creator/assignee.

**Steps**:

1. Fetch configured agents from new API endpoint (or use known list)
2. Add filter state:
   ```typescript
   const [creatorFilter, setCreatorFilter] = useState<string>("");
   const [assigneeFilter, setAssigneeFilter] = useState<string>("");
   ```

3. Add filter dropdowns to toolbar
4. Apply filters to displayed tasks

---

### Issue #4.3: Add agent filter API endpoint

**Location**: `src/app/api/kanban/agent/ids/route.ts` (NEW)

**Task**: Return list of configured agent IDs for UI filters.

```typescript
import { NextResponse } from "next/server";
import { getConfiguredAgents } from "@/lib/agent-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const agents = getConfiguredAgents();
  return NextResponse.json({ agents });
}
```

---

## Phase 5: OpenClaw Agent Skill (Optional)

This is for the agents themselves - they need to know HOW to call these APIs.

### Issue #5.1: Create skill documentation

**Location**: OpenClaw agent's `skills/` directory

**Task**: Document how agents should use the task API.

**Content**:
```markdown
# Kanban Task Management Skill

## Authentication

Include these headers in all requests:
- X-Agent-Id: Your agent ID (e.g., "boti")
- X-Agent-Key: Your API key

## Endpoints

### Create Task
POST /api/kanban/agent/tasks
Body: { title, description?, status?, priority?, assignee?, projectId?, labels? }

### List Tasks
GET /api/kanban/agent/tasks?createdBy=X&assignee=Y&status=Z

### Update Task
PATCH /api/kanban/agent/tasks/{id}
Body: { status?, title?, description?, priority?, assignee?, claim? }

### Delete Task
DELETE /api/kanban/agent/tasks/{id}

## Status Values
- backlog
- in_progress
- review
- done
- blocked
- waiting
```

---

## Summary: Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/lib/kanban-db.ts` | MODIFY | Add `created_by` column + migration |
| `src/lib/agent-auth.ts` | CREATE | Agent authentication library |
| `src/app/api/kanban/agent/tasks/route.ts` | CREATE | POST + GET endpoints |
| `src/app/api/kanban/agent/tasks/[id]/route.ts` | CREATE | PATCH + DELETE endpoints |
| `src/app/api/kanban/agent/ids/route.ts` | CREATE | Get configured agent IDs |
| `src/components/kanban/KanbanTask.tsx` | MODIFY | Add "Created by" badge |
| `src/components/kanban/KanbanBoard.tsx` | MODIFY | Add agent filter dropdowns |
| `.env.local` | MODIFY | Add OPENCLAW_AGENT_KEYS |

---

## Testing Checklist

1. [ ] Add `OPENCLAW_AGENT_KEYS` to `.env.local`
2. [ ] Restart app, verify migration runs
3. [ ] Test POST /api/kanban/agent/tasks with valid headers
4. [ ] Test GET /api/kanban/agent/tasks with filters
5. [ ] Test PATCH /api/kanban/agent/tasks/{id} as creator
6. [ ] Test PATCH as non-authorized agent (should fail)
7. [ ] Test DELETE as creator
8. [ ] Verify "Created by" badge appears in UI
9. [ ] Verify agent filters work

---

## Example API Calls

### Create task as Boti, assign to Leo:
```bash
curl -X POST http://localhost:3000/api/kanban/agent/tasks \
  -H "Content-Type: application/json" \
  -H "X-Agent-Id: boti" \
  -H "X-Agent-Key: sk-boti-secret-key" \
  -d '{
    "title": "Fix memory leak in production",
    "description": "Server memory usage growing over time",
    "status": "backlog",
    "priority": "high",
    "assignee": "leo"
  }'
```

### Leo claims and starts the task:
```bash
# Claim the task
curl -X PATCH http://localhost:3000/api/kanban/agent/tasks/{taskId} \
  -H "Content-Type: application/json" \
  -H "X-Agent-Id: leo" \
  -H "X-Agent-Key: sk-leo-secret-key" \
  -d '{"claim": true, "status": "in_progress"}'
```

### Leo marks task done:
```bash
curl -X PATCH http://localhost:3000/api/kanban/agent/tasks/{taskId} \
  -H "Content-Type: application/json" \
  -H "X-Agent-Id: leo" \
  -H "X-Agent-Key: sk-leo-secret-key" \
  -d '{"status": "done"}'
```

### Get all tasks assigned to Leo:
```bash
curl "http://localhost:3000/api/kanban/agent/tasks?assignee=leo" \
  -H "X-Agent-Id: leo" \
  -H "X-Agent-Key: sk-leo-secret-key"
```

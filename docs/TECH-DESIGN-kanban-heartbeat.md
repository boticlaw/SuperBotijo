# Technical Design: Kanban Heartbeat Integration

## Overview

This document describes the technical design for heartbeat-driven task polling in OpenClaw agents. The system enables autonomous agents to periodically poll for assigned work, similar to worker processes checking a task queue.

## Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   OpenClaw  │────▶│   SuperBotijo    │────▶│   Kanban DB     │
│    Agent    │     │  (Next.js API)   │     │   (SQLite)      │
└─────────────┘     └──────────────────┘     └─────────────────┘
       │                    │
       │ GET /api/         │
       │ heartbeat/tasks   │
       │ ?agentName=X     │
       └──────────────────┘
```

---

## 1. API Endpoints

### 1.1 Task Polling Endpoint

**GET `/api/heartbeat/tasks`**

Returns in-progress tasks assigned to the specified agent.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `agentName` | string | No* | Agent identifier. Falls back to autonomy settings if not provided. |

*If not provided, uses `autonomySettings.agentName` from `data/autonomy.json`.

**Response (200 OK):**

```json
{
  "agentName": "developer",
  "count": 2,
  "tasks": [
    {
      "id": "task-123",
      "title": "Fix login bug",
      "description": "Users can't login with SSO",
      "priority": "high",
      "status": "in_progress",
      "isExecutable": true,
      "blockedReason": null,
      "claimedBy": "developer",
      "claimedAt": "2026-03-07T08:15:00Z"
    }
  ]
}
```

**Response (500 Error):**

```json
{
  "error": "Failed to get tasks"
}
```

### 1.2 Heartbeat Configuration Endpoint

**GET `/api/heartbeat`**

Returns heartbeat configuration from `openclaw.json` and optionally reads `HEARTBEAT.md`.

**Response (200 OK):**

```json
{
  "enabled": true,
  "every": "15m",
  "target": "last",
  "activeHours": { "start": "09:00", "end": "18:00" },
  "heartbeatMd": "# Heartbeat\n\nTask list...",
  "heartbeatMdPath": "/home/daniel/.openclaw/workspace/HEARTBEAT.md",
  "configured": true,
  "autonomy": {
    "agentName": "developer",
    "autonomyLevel": "full"
  }
}
```

**PUT `/api/heartbeat`**

Saves heartbeat instructions to `HEARTBEAT.md`.

**Request Body:**

```json
{
  "content": "# Heartbeat Instructions\n\n1. Check assigned tasks..."
}
```

### 1.3 Unified Task View Endpoint

**GET `/api/tasks`**

Returns all scheduled tasks (cron + heartbeat) for dashboard display.

**Response (200 OK):**

```json
[
  {
    "id": "heartbeat",
    "name": "Heartbeat",
    "type": "heartbeat",
    "agentId": "main",
    "schedule": "*/15 * * * *",
    "scheduleDisplay": "Every 15 min",
    "enabled": true,
    "description": "Periodic agent self-check"
  }
]
```

---

## 2. Database Schema

### 2.1 Existing Schema (No Changes Required)

The Kanban database already supports all required fields for heartbeat integration:

| Table | Column | Type | Purpose |
|-------|--------|------|---------|
| `kanban_tasks` | `assignee` | TEXT | Agent assigned to task |
| `kanban_tasks` | `claimed_by` | TEXT | Agent currently working on task |
| `kanban_tasks` | `claimed_at` | TIMESTAMP | When task was claimed |
| `kanban_tasks` | `status` | TEXT | Task column (backlog, in_progress, done, etc.) |
| `kanban_tasks` | `blocked_by` | TEXT | JSON array of blocking task IDs |
| `kanban_tasks` | `depends_on` | TEXT | JSON array of dependency task IDs |

### 2.2 Indexes

```sql
CREATE INDEX idx_kanban_tasks_assignee ON kanban_tasks(assignee);
CREATE INDEX idx_kanban_tasks_claimed_by ON kanban_tasks(claimed_by);
CREATE INDEX idx_kanban_tasks_status ON kanban_tasks(status);
```

### 2.3 Task Lifecycle

```
┌─────────────┐     ┌───────────────┐     ┌─────────────┐
│   backlog   │────▶│  in_progress  │────▶│    done     │
└─────────────┘     └───────────────┘     └─────────────┘
                           │
                           ▼ (by other agent)
                    ┌───────────────┐
                    │   claimed_by   │
                    │   = agent_id   │
                    └───────────────┘
```

---

## 3. Agent Configuration

### 3.1 openclaw.json Configuration

Agents declare heartbeat intervals in `openclaw.json`:

```json
{
  "agents": {
    "defaults": {
      "id": "developer",
      "name": "Developer Agent",
      "heartbeat": {
        "every": "15m",
        "target": "last",
        "activeHours": {
          "start": "09:00",
          "end": "18:00"
        }
      }
    }
  }
}
```

### 3.2 Supported Intervals

| String | Milliseconds | Use Case |
|--------|--------------|----------|
| `1m` | 60,000 | Testing only |
| `5m` | 300,000 | Aggressive polling |
| `15m` | 900,000 | Default for most agents |
| `30m` | 1,800,000 | Low-frequency agents |
| `1h` | 3,600,000 | Minimal overhead |

### 3.3 HEARTBEAT.md

Optional file containing agent-specific instructions polled during heartbeat:

```
$OPENCLAW_DIR/HEARTBEAT.md
$OPENCLAW_DIR/workspace/HEARTBEAT.md
```

---

## 4. Authentication Flow

### 4.1 Current Implementation

Agents authenticate via **query parameter** (`?agentName=X`) rather than traditional auth headers.

### 4.2 Design Rationale

The query parameter approach was chosen because:

1. **Simplicity**: Agents call from scripts/CLIs where header management is cumbersome
2. **Statelessness**: No session tokens to manage or expire
3. **Transparency**: Agent identity is explicitly visible in logs/metrics
4. **No security requirement**: Heartbeat endpoints are intended for internal agent use behind the same auth boundary as the rest of SuperBotijo

### 4.3 Security Considerations

| Aspect | Current State | Recommendation |
|--------|---------------|----------------|
| Network | Behind SuperBotijo auth (middleware) | Keep internal-only |
| Agent validation | Basic fallback to autonomy settings | Consider allowlist per agent |
| Audit trail | Activity logging on claim/release | Already implemented |

### 4.4 Future Enhancement: API Key Auth

If external access is needed:

```typescript
// Proposed headers
X-Agent-Name: developer
X-Agent-Key: sk_live_...  // Stored in openclaw.json
```

---

## 5. Code Organization

### 5.1 File Structure

```
src/
├── lib/
│   ├── kanban-db.ts           # Task CRUD, claim/release, workload
│   ├── openclaw-agents.ts    # Read heartbeat config from openclaw.json
│   └── dependency-resolver.ts # Compute isExecutable, blockedReason
│
├── app/api/
│   ├── heartbeat/
│   │   ├── route.ts          # GET/PUT heartbeat.md + config
│   │   ├── tasks/
│   │   │   └── route.ts      # GET assigned in-progress tasks
│   │   ├── executions/
│   │   │   └── route.ts      # Heartbeat execution history
│   │   └── autonomy/
│   │       └── route.ts      # Autonomy settings
│   │
│   └── tasks/
│       └── route.ts          # Unified cron + heartbeat view
```

### 5.2 Key Functions

| Module | Function | Purpose |
|--------|----------|---------|
| `kanban-db.ts` | `listTasks({ assignee, status })` | Query tasks by agent + status |
| `kanban-db.ts` | `claimTask(taskId, agentName)` | Atomically claim unclaimed task |
| `kanban-db.ts` | `releaseTask(taskId, agentName)` | Release claim (only claimer) |
| `kanban-db.ts` | `getAgentWorkload(agentName)` | Count tasks by status |
| `kanban-db.ts` | `getTasksByClaimant(agentName)` | Get all claimed tasks |
| `openclaw-agents.ts` | `getOpenClawAgents()` | Parse openclaw.json, return agent configs |
| `openclaw-agents.ts` | `parseHeartbeatInterval(str)` | Parse "15m" → 900000ms |

### 5.3 Dependency Flow

```
Agent heartbeat fires
        │
        ▼
GET /api/heartbeat/tasks?agentName=developer
        │
        ▼
listTasks({ assignee: "developer", status: "in_progress" })
        │
        ▼
filter: claimedBy === null || claimedBy === "developer"
        │
        ▼
resolveDependencies(tasks)  ──▶ dependency-resolver.ts
        │
        ▼
Return { isExecutable, blockedReason, ... }
        │
        ▼
Agent decides: claim → process → update status
```

---

## 6. Agent Workflow

### 6.1 Heartbeat Cycle

```
┌─────────────────────────────────────────────────────────────┐
│  1. Timer fires (every N minutes)                           │
│           ↓                                                  │
│  2. Agent calls GET /api/heartbeat/tasks?agentName=me       │
│           ↓                                                  │
│  3. API returns in_progress tasks assigned to me            │
│           ↓                                                  │
│  4. For each task:                                          │
│     - If claimedBy === null: claimTask() → process()         │
│     - If claimedBy === me: continue processing               │
│     - If claimedBy !== me: skip (claimed by other agent)     │
│           ↓                                                  │
│  5. Process task → PATCH /api/kanban/tasks/{id}             │
│           ↓                                                  │
│  6. On completion: status = "done"                          │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 Claim Semantics

| Scenario | Result |
|----------|--------|
| Task unclaimed (`claimedBy = null`) | Agent can claim |
| Agent already claimed (`claimedBy = me`) | Agent continues work |
| Other agent claimed (`claimedBy = other`) | Agent skips task |
| Task status = `in_progress` | Agent processes |
| Task status = `backlog` | Agent does NOT auto-start |

### 6.3 Dependency Handling

The system uses `depends_on` and `blocked_by` fields to compute:

- `isExecutable`: `true` if all dependencies are in `done` status
- `blockedReason`: Human-readable reason if blocked

---

## 7. Error Handling

### 7.1 API Errors

| Status | Message | Cause |
|--------|---------|-------|
| 200 | `{ tasks: [] }` | No tasks for agent (normal) |
| 200 | `{ error: null, message: "..." }` | Agent not configured |
| 500 | `{ error: "Failed to get tasks" }` | Internal error |

### 7.2 Claim Errors

The `claimTask()` function returns typed errors:

```typescript
interface ClaimResult {
  success: boolean;
  task?: KanbanTask;
  reason?: "not_found" | "already_claimed" | "claimed_by_other";
}
```

---

## 8. Monitoring & Observability

### 8.1 Activity Logging

All claim/release operations log to the activity feed:

```typescript
logActivity("task", `Task "${title}" claimed by ${agentName}`, "success", { metadata: {...} });
```

### 8.2 Realtime Events

The system emits heartbeat ping events for dashboard status:

```typescript
// In /api/realtime
send(createEvent('heartbeat:ping', { timestamp: new Date().toISOString() }));
```

---

## 9. Implementation Status

| Component | Status | Location |
|-----------|--------|----------|
| Kanban DB (claims) | ✅ Complete | `src/lib/kanban-db.ts` |
| Heartbeat config parsing | ✅ Complete | `src/lib/openclaw-agents.ts:92` |
| GET /api/heartbeat/tasks | ✅ Complete | `src/app/api/heartbeat/tasks/route.ts` |
| GET /api/heartbeat | ✅ Complete | `src/app/api/heartbeat/route.ts` |
| GET /api/tasks (unified) | ✅ Complete | `src/app/api/tasks/route.ts` |
| Dependency resolution | ✅ Complete | `src/lib/dependency-resolver.ts` |
| Documentation | ✅ Complete | `AGENTS.md:521` |

---

## 10. Future Enhancements

### 10.1 Phase 2 (Optional)

1. **Claim API endpoints**: Explicit `/api/heartbeat/claim/{taskId}` and `/api/heartbeat/release/{taskId}`
2. **Heartbeat history**: Track poll timestamps per agent for analytics
3. **Dashboard UI**: Show last heartbeat time in agent cards
4. **WebSocket push**: Notify agents immediately instead of polling

### 10.2 Security Hardening (If Exposed Externally)

1. API key authentication per agent
2. Rate limiting on heartbeat endpoints
3. IP allowlisting for agent traffic

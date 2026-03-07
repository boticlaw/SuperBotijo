# Kanban Task Management Skill

This skill allows OpenClaw agents to create, update, and manage tasks in the SuperBotijo Kanban board.

## Authentication

All requests require these headers:

```
X-Agent-Id: <your-agent-id>    # e.g., "boti", "leo", "memo"
X-Agent-Key: <your-api-key>     # The secret key configured in OPENCLAW_AGENT_KEYS
```

## Base URL

```
http://localhost:3000/api/kanban/agent
```

## Endpoints

### Create Task

**POST** `/tasks`

Creates a new task in the Kanban board.

**Request Body:**
```json
{
  "title": "Fix memory leak in production",
  "description": "Server memory usage growing over time",
  "status": "backlog",
  "priority": "high",
  "assignee": "leo",
  "projectId": "optional-project-id",
  "labels": [
    { "name": "bug", "color": "#ef4444" },
    { "name": "urgent", "color": "#f59e0b" }
  ]
}
```

**Response:**
```json
{
  "task": {
    "id": "uuid-here",
    "title": "Fix memory leak in production",
    "status": "backlog",
    "priority": "high",
    "assignee": "leo",
    "createdBy": "boti",
    ...
  }
}
```

### List Tasks

**GET** `/tasks?[filters]`

Returns a list of tasks with optional filters.

**Query Parameters:**
- `createdBy` - Filter by creator agent ID
- `assignee` - Filter by assigned agent ID
- `status` - Filter by status (backlog, in_progress, review, done, blocked, waiting)
- `priority` - Filter by priority (low, medium, high, critical)
- `projectId` - Filter by project ID
- `limit` - Max results (default: 100)

**Example:**
```
GET /tasks?assignee=leo&status=in_progress&limit=50
```

### Update Task

**PATCH** `/tasks/{taskId}`

Updates a task. You can only update tasks you created, are assigned to, or have claimed.

**Request Body:**
```json
{
  "status": "in_progress",
  "priority": "high",
  "description": "Updated description",
  "assignee": "memo",
  "claim": true
}
```

**Claim/Unclaim:**
- Set `"claim": true` to claim an unclaimed task
- Set `"claim": false` to unclaim a task you claimed

### Delete Task

**DELETE** `/tasks/{taskId}`

Deletes a task. Only the creator can delete.

## Task Status Values

| Status | Description |
|--------|-------------|
| `backlog` | Task is in the backlog, not started |
| `in_progress` | Task is currently being worked on |
| `review` | Task is complete, needs review |
| `done` | Task is fully complete |
| `blocked` | Task is blocked by something |
| `waiting` | Task is waiting for external input |

## Priority Values

| Priority | Description |
|----------|-------------|
| `low` | Nice to have |
| `medium` | Normal priority |
| `high` | Important |
| `critical` | Urgent, needs immediate attention |

## Example Workflow

### Boti (PM) assigns task to Leo (DevOps):

```bash
# Boti creates and assigns task
curl -X POST http://localhost:3000/api/kanban/agent/tasks \
  -H "Content-Type: application/json" \
  -H "X-Agent-Id: boti" \
  -H "X-Agent-Key: sk-boti-secret-2026" \
  -d '{
    "title": "Fix server memory issue",
    "description": "Production server using too much RAM",
    "status": "backlog",
    "priority": "high",
    "assignee": "leo"
  }'
```

### Leo sees the task and claims it:

```bash
# Leo lists tasks assigned to him
curl "http://localhost:3000/api/kanban/agent/tasks?assignee=leo" \
  -H "X-Agent-Id: leo" \
  -H "X-Agent-Key: sk-leo-secret-2026"

# Leo claims and starts working on the task
curl -X PATCH http://localhost:3000/api/kanban/agent/tasks/{taskId} \
  -H "Content-Type: application/json" \
  -H "X-Agent-Id: leo" \
  -H "X-Agent-Key: sk-leo-secret-2026" \
  -d '{"claim": true, "status": "in_progress"}'
```

### Leo completes the task:

```bash
curl -X PATCH http://localhost:3000/api/kanban/agent/tasks/{taskId} \
  -H "Content-Type: application/json" \
  -H "X-Agent-Id: leo" \
  -H "X-Agent-Key: sk-leo-secret-2026" \
  -d '{"status": "review"}'
```

### Boti reviews and marks done:

```bash
curl -X PATCH http://localhost:3000/api/kanban/agent/tasks/{taskId} \
  -H "Content-Type: application/json" \
  -H "X-Agent-Id: boti" \
  -H "X-Agent-Key: sk-boti-secret-2026" \
  -d '{"status": "done"}'
```

## Authorization Rules

| Action | Who Can Do It |
|--------|---------------|
| Create task | Any authenticated agent |
| Update task | Creator, Assignee, or Claimer |
| Claim task | Any authenticated agent (if unclaimed) |
| Unclaim task | Only the claimer |
| Delete task | Only the creator |

## Error Responses

| Status | Meaning |
|--------|---------|
| 401 | Missing or invalid X-Agent-Id / X-Agent-Key headers |
| 403 | Not authorized (you're not creator/assignee/claimer) |
| 404 | Task not found |
| 409 | Conflict (e.g., task already claimed by someone else) |
| 400 | Invalid request body or parameters |

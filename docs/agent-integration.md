# Agent Integration Guide

> Configure your OpenClaw agents to use the Kanban system in SuperBotijo.

---

## Overview

SuperBotijo provides a REST API for agents to manage tasks programmatically. Each agent needs:

1. **IDENTITY.md** - Define role and domain
2. **API Key** - In auth-profiles.json
3. **SuperBotijo Config** - KANBAN_AGENT_KEYS in .env

---

## Quick Setup

### Step 1: Create IDENTITY.md

Create `/home/daniel/.openclaw/agents/<agent-id>/IDENTITY.md`:

```markdown
# IDENTITY.md

*Role:* <Role description>
*Domain:* <work|general|finance|personal>
*Agent-Id:* <agent-id>
```

### Step 2: Add API Key to Agent

Add to `/home/daniel/.openclaw/agents/<agent-id>/agent/auth-profiles.json`:

```json
{
  "profiles": {
    "superbotijo:kanban": {
      "type": "api_key",
      "provider": "superbotijo",
      "key": "sk-<agent-id>-secret-2026"
    }
  }
}
```

### Step 3: Configure SuperBotijo

Add to `/home/daniel/.openclaw/workspace/superbotijo/.env`:

```bash
KANBAN_AGENT_KEYS=boti:sk-boti-secret-2026,memo:sk-memo-secret-2026,opencode:sk-opencode-secret-2026
```

Format: `agent-id:api-key,agent-id:api-key,...`

### Step 4: Restart SuperBotijo

```bash
cd /home/daniel/.openclaw/workspace/superbotijo
npm run build && npm start
```

---

## API Reference

**Base URL:** `http://localhost:3000/api/kanban/agent`

**Required Headers:**
```
X-Agent-Id: <agent-id>
X-Agent-Key: <api-key>
Content-Type: application/json
```

### Create Task

```bash
curl -X POST http://localhost:3000/api/kanban/agent/tasks \
  -H "Content-Type: application/json" \
  -H "X-Agent-Id: boti" \
  -H "X-Agent-Key: sk-boti-secret-2026" \
  -d '{"title": "Fix bug", "status": "backlog", "priority": "high"}'
```

### List Tasks

```bash
curl "http://localhost:3000/api/kanban/agent/tasks?assignee=boti" \
  -H "X-Agent-Id: boti" \
  -H "X-Agent-Key: sk-boti-secret-2026"
```

### Update Task

```bash
curl -X PATCH http://localhost:3000/api/kanban/agent/tasks/{taskId} \
  -H "Content-Type: application/json" \
  -H "X-Agent-Id: boti" \
  -H "X-Agent-Key: sk-boti-secret-2026" \
  -d '{"status": "in_progress"}'
```

### Claim Task

```bash
curl -X PATCH http://localhost:3000/api/kanban/agent/tasks/{taskId} \
  -H "Content-Type: application/json" \
  -H "X-Agent-Id: boti" \
  -H "X-Agent-Key: sk-boti-secret-2026" \
  -d '{"claim": true, "status": "in_progress"}'
```

### Delete Task

```bash
curl -X DELETE http://localhost:3000/api/kanban/agent/tasks/{taskId} \
  -H "X-Agent-Id: boti" \
  -H "X-Agent-Key: sk-boti-secret-2026"
```

---

## Status Values

| Status | Description |
|--------|-------------|
| `backlog` | Task is pending |
| `in_progress` | Currently working |
| `review` | Needs review |
| `done` | Completed |
| `blocked` | Blocked by something |
| `waiting` | Waiting for external input |

## Priority Values

| Priority | Description |
|----------|-------------|
| `low` | Nice to have |
| `medium` | Normal priority |
| `high` | Important |
| `critical` | Urgent |

## Domain Values

| Domain | Description |
|--------|-------------|
| `work` | Development, operations |
| `finance` | Invoices, payments |
| `personal` | Family, health |
| `general` | Default domain |

---

## Authorization

| Action | Who Can Do It |
|--------|---------------|
| Create task | Any authenticated agent |
| Update task | Creator, Assignee, or Claimer |
| Claim task | Any agent (if unclaimed) |
| Unclaim task | Only the claimer |
| Delete task | Only the creator |

---

## Complete Example

**Boti creates task for Memo:**

```bash
# 1. Boti creates and assigns task
curl -X POST http://localhost:3000/api/kanban/agent/tasks \
  -H "Content-Type: application/json" \
  -H "X-Agent-Id: boti" \
  -H "X-Agent-Key: sk-boti-secret-2026" \
  -d '{"title": "Review Obsidian notes", "status": "backlog", "priority": "high", "assignee": "memo"}'

# 2. Memo claims and starts working
curl -X PATCH http://localhost:3000/api/kanban/agent/tasks/{taskId} \
  -H "Content-Type: application/json" \
  -H "X-Agent-Id: memo" \
  -H "X-Agent-Key: sk-memo-secret-2026" \
  -d '{"claim": true, "status": "in_progress"}'

# 3. Memo completes task
curl -X PATCH http://localhost:3000/api/kanban/agent/tasks/{taskId} \
  -H "Content-Type: application/json" \
  -H "X-Agent-Id: memo" \
  -H "X-Agent-Key: sk-memo-secret-2026" \
  -d '{"status": "review"}'

# 4. Boti reviews and marks done
curl -X PATCH http://localhost:3000/api/kanban/agent/tasks/{taskId} \
  -H "Content-Type: application/json" \
  -H "X-Agent-Id: boti" \
  -H "X-Agent-Key: sk-boti-secret-2026" \
  -d '{"status": "done"}'
```

---

## Troubleshooting

**401 Unauthorized:**
- Check X-Agent-Id header is correct
- Check X-Agent-Key matches KANBAN_AGENT_KEYS in .env

**403 Forbidden:**
- You're not creator/assignee/claimer of the task

**Task not appearing:**
- Restart SuperBotijo after adding KANBAN_AGENT_KEYS
- Check .env file is in SuperBotijo root directory

---

## See Also

- **Skill:** `/home/daniel/.openclaw/workspace/skills/kanban-tasks/SKILL.md`
- **API Docs:** `/home/daniel/.openclaw/workspace/superbotijo/docs/AGENT_KANBAN_API.md`

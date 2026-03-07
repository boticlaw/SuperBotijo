# Proposal: Kanban Heartbeat Integration for OpenClaw Agents

## Problem Statement

Currently, OpenClaw agents exist in a "set it and forget it" model—they're spawned with tasks but have no built-in mechanism to periodically check for new work or updates to their assigned tasks. Unlike systems like Vikunja where tasks actively notify or can be polled by workers, OpenClaw agents rely on external orchestration to assign work.

**The core issue**: When a task is created or updated in the Kanban board, agents don't automatically become aware of it unless manually triggered or respawned.

## User Story (Vikunja-style)

> **"The Morning Standup"**
> 
> Every morning at 8:00 AM, the Project Manager agent reviews the Kanban board. It assigns three new tasks to the Developer agent:
> - "Fix login bug" → moves to Developer's "In Progress"
> - "Update API docs" → moves to Developer's "Backlog"  
> - "Review PR #42" → moves to Developer's "In Progress"
>
> The Developer agent has a **heartbeat** configured to run every 15 minutes. When it fires, it:
> 1. Polls `/api/heartbeat/tasks` to see what's assigned
> 2. Finds the new tasks waiting
> 3. Claims "Fix login bug" and starts working
> 4. Later, when the PM adds more tasks, the Developer picks them up on the next heartbeat—without being respawned

This is the vision: **agents that autonomously poll for work**, like employees checking a task board.

---

## Solution: Heartbeat-Driven Task Polling

### How It Works

1. **Agent Configuration** (`openclaw.json`): Each agent declares a `heartbeat` interval
2. **Heartbeat Execution**: OpenClaw (or an external cron) triggers the agent's heartbeat
3. **Task Polling**: Agent calls `GET /api/heartbeat/tasks?agentName=<agent-id>`
4. **Task Processing**: Agent receives in-progress tasks assigned to it, processes them
5. **Status Updates**: Agent updates task status via Kanban API as it works

### What's Already Implemented

| Component | Status | Location |
|-----------|--------|----------|
| Kanban DB | ✅ Ready | `src/lib/kanban-db.ts` |
| Heartbeat config in openclaw.json | ✅ Ready | `src/lib/openclaw-agents.ts` |
| `/api/heartbeat/tasks` | ✅ Ready | `src/app/api/heartbeat/tasks/route.ts` |
| `/api/tasks` (unified view) | ✅ Ready | `src/app/api/tasks/route.ts` |

### What's Needed

- **Documentation**: How to configure heartbeats for agents
- **Optional API enhancement**: Endpoints for claim/unclaim flow

---

## Scope

### Phase 1: Documentation (This Proposal)

1. **AGENTS.md section**: Document heartbeat configuration
   - How to configure `heartbeat` in `openclaw.json`
   - What the heartbeat endpoint returns
   - Example agent workflow

2. **API Documentation**: Document existing endpoints
   - `GET /api/heartbeat/tasks` — get assigned in-progress tasks
   - `GET /api/tasks` — unified cron + heartbeat view

### Phase 2: Optional Enhancements (Future)

1. **Claim API**: Explicit claim/unclaim endpoints for agents
2. **Heartbeat history**: Track when agents last polled
3. **Dashboard UI**: Show heartbeat status in agent cards

---

## Technical Details

### Agent Configuration

Add to `openclaw.json`:

```json
{
  "agents": {
    "defaults": {
      "id": "developer",
      "name": "Developer Agent",
      "heartbeat": {
        "every": "15m"
      }
    }
  }
}
```

**Supported intervals**:
- `1m` — every minute (aggressive, for testing)
- `5m` — every 5 minutes
- `15m` — every 15 minutes
- `30m` — every 30 minutes
- `1h` — every hour

### API Endpoints

#### GET /api/heartbeat/tasks

Returns tasks assigned to the agent with status `in_progress`:

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

#### GET /api/tasks

Returns all scheduled tasks (cron + heartbeat):

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

### Agent Heartbeat Workflow

```
┌─────────────────────────────────────────────────────────────┐
│                    HEARTBEAT CYCLE                          │
├─────────────────────────────────────────────────────────────┤
│  1. Timer fires (every N minutes)                           │
│           ↓                                                  │
│  2. Agent calls GET /api/heartbeat/tasks?agentName=me     │
│           ↓                                                  │
│  3. API returns assigned tasks (status=in_progress)        │
│           ↓                                                  │
│  4. For each task:                                          │
│     - Check if already claimed by me                        │
│     - If not claimed: claim it (PATCH /api/kanban/tasks)   │
│     - If already claimed: process it                         │
│           ↓                                                  │
│  5. Update task status as work progresses                  │
│     - PATCH /api/kanban/tasks/{id} { status: "done" }     │
└─────────────────────────────────────────────────────────────┘
```

---

## Impact

### Benefits

1. **Autonomous Agents**: Agents work independently without constant respawning
2. **Real-time Responsiveness**: New tasks picked up within heartbeat interval
3. **Vikunja-style Workflow**: Agents act like workers polling a queue
4. **Decoupled Architecture**: No tight coupling between PM and worker agents

### Trade-offs

1. **Latency**: New tasks have up to N minutes delay (heartbeat interval)
2. **Polling Overhead**: Requires periodic HTTP requests
3. **State Management**: Agents must track claimed vs. unclaimed tasks

### Use Cases

- **PM assigns task** → Developer picks it up on next heartbeat
- **Task unblocked** → Agent resumes on next heartbeat  
- **New priority** → Agent sees it on next poll
- **Task reassigned** → Original agent releases, new agent claims

---

## Files to Modify

| File | Change |
|------|--------|
| `AGENTS.md` | Add "Kanban Heartbeat Integration" section |

---

## Success Criteria

1. Documentation clearly explains how to configure heartbeat
2. Agent developers understand the polling workflow
3. API endpoints are documented with examples
4. User story (Vikunja morning standup) is achievable

---

## Timeline

- **Phase 1** (This PR): Documentation in AGENTS.md
- **Phase 2** (Future): Claim API, heartbeat history UI

---

## Questions / Open Items

1. Should heartbeat be agent-specific or global?
2. Do we need a "claim" endpoint, or is the current flow sufficient?
3. Should heartbeat run inside the agent process or externally via cron?

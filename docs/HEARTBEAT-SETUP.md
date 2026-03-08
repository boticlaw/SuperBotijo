# Heartbeat Setup Guide - SuperBotijo

> **Complete guide to configure autonomous task polling for OpenClaw agents**

This guide explains how to set up the heartbeat system so your OpenClaw agents can autonomously poll for tasks from the Kanban board - similar to how Vikunja or other task queue systems work.

---

## Table of Contents

1. [Overview](#overview)
2. [How It Works](#how-it-works)
3. [Prerequisites](#prerequisites)
4. [Step-by-Step Setup](#step-by-step-setup)
5. [HEARTBEAT.md Templates by Role](#heartbeatmd-templates-by-role)
6. [Testing Your Setup](#testing-your-setup)
7. [Troubleshooting](#troubleshooting)
8. [Best Practices](#best-practices)

---

## Overview

### The Problem

Agents in OpenClaw are typically "set and forget" — they're spawned with tasks but have no built-in mechanism to periodically check for new work. When a task is assigned or updated, the agent doesn't know unless manually triggered or respawned.

### The Solution: Heartbeats

Agents configure a `heartbeat` in `openclaw.json` that specifies how often they should poll for work. When the heartbeat fires, the agent:

1. Reads `HEARTBEAT.md` for instructions
2. Calls the SuperBotijo API to get assigned tasks
3. Claims and processes tasks
4. Updates task status as work progresses

This enables **autonomous agent behavior**: agents work like employees checking a task board, picking up new work when it appears.

---

## How It Works

```
┌─────────────────────────────────────────────────────────────────────┐
│  1. Timer OpenClaw dispara (cada N minutos según config)            │
│           ↓                                                         │
│  2. El agente lee HEARTBEAT.md                                      │
│           ↓                                                         │
│  3. El agente llama GET /api/heartbeat/tasks?agentName=<id>        │
│           ↓                                                         │
│  4. SuperBotijo responde con tareas in_progress asignadas al agente │
│           ↓                                                         │
│  5. El agente:                                                      │
│     - Si claimedBy === null → claimTask() y procesar                │
│     - Si claimedBy === me → continuar procesando                    │
│     - Si claimedBy !== me → skip (otro agente la tiene)             │
│           ↓                                                         │
│  6. Procesa tarea → PATCH /api/kanban/tasks/{id}                   │
│           ↓                                                         │
│  7. Al completar: status = "done"                                  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Prerequisites

Before setting up heartbeats, ensure:

- [ ] SuperBotijo is running and accessible
- [ ] OpenClaw agents are configured in `openclaw.json`
- [ ] Agent API keys are configured in SuperBotijo's `.env.local`
- [ ] Agents have the `kanban-tasks` skill installed

### Configure API Keys

In SuperBotijo's `.env.local`:

```env
# Format: agentId:apiKey, comma-separated
OPENCLAW_AGENT_KEYS=boti:sk-boti-secret-2026,opencode:sk-opencode-secret-2026,code:sk-code-secret-2026,scout:sk-scout-secret-2026,extractor:sk-extractor-secret-2026,escapeitor:sk-escapeitor-secret-2026,memo:sk-memo-secret-2026
```

Generate secure keys:

```bash
openssl rand -base64 18
```

---

## Step-by-Step Setup

### Step 1: Configure Heartbeat in openclaw.json

For each agent, add the `heartbeat` configuration:

```json
{
  "agents": {
    "list": [
      {
        "id": "boti",
        "name": "Boti",
        "workspace": "/home/user/.openclaw/workspace",
        "heartbeat": {
          "every": "15m",
          "target": "none"
        },
        "skills": ["kanban-tasks"]
      }
    ]
  }
}
```

**Supported intervals:**

| Interval | Milliseconds | Use Case |
|----------|--------------|----------|
| `1m` | 60,000 | Testing only |
| `5m` | 300,000 | Aggressive polling (PM agents) |
| `15m` | 900,000 | Default for most agents |
| `30m` | 1,800,000 | Low-frequency agents |
| `1h` | 3,600,000 | Minimal overhead |

### Step 2: Create HEARTBEAT.md for Each Agent

Create a `HEARTBEAT.md` file in each agent's workspace:

```
/home/user/.openclaw/workspace/HEARTBEAT.md              # For main agent
/home/user/.openclaw/workspace/agents/<id>/HEARTBEAT.md  # For sub-agents
```

### Step 3: Add Instructions to HEARTBEAT.md

The file must contain instructions for what the agent should do when the heartbeat fires. See [templates below](#heartbeatmd-templates-by-role).

### Step 4: Restart OpenClaw Gateway

```bash
systemctl restart openclaw-gateway
# or
pm2 restart openclaw-gateway
```

### Step 5: Verify Configuration

Check that the heartbeat is configured:

```bash
# Via SuperBotijo API
curl http://localhost:3000/api/heartbeat

# Or check openclaw.json directly
cat ~/.openclaw/openclaw.json | jq '.agents.list[].heartbeat'
```

---

## HEARTBEAT.md Templates by Role

### Template 1: COO/Orchestrator (PM Agent)

For agents that coordinate work and delegate to sub-agents (e.g., `boti`, `jarvis`).

```markdown
# HEARTBEAT.md - <AGENT_NAME> (COO/Orchestrator)

## Purpose

I am the **team orchestrator**. My heartbeat reviews the Kanban and coordinates tasks between subagents.

---

## Every 15 minutes, execute:

### 1. Check assigned tasks in Kanban

```bash
GET /api/heartbeat/tasks?agentName=<agent-id>
```

### 2. For each pending task:

- If `status === "in_progress"` and `assignee === "<agent-id>"`:
  - If `claimedBy === null` → **CLAIM** and process
  - If `claimedBy === "<agent-id>"` → continue processing

### 3. Task coordination:

- **Technical tasks** → assign to `code` or `opencode`
- **Research/investigation** → assign to `scout`
- **Content extraction** → assign to `extractor`
- **Save to Obsidian** → assign to `memo`
- **Game design** → assign to `escapeitor`

### 4. Detect blockers:

If a task has been >2 days without movement:
- Comment on the task asking what's happening
- If no response in 24h, escalate to user

---

## Delegation Protocol

When spawning a subagent for a task:

1. Create comment on task: "Delegating to @<agent>"
2. Spawn subagent with clear context
3. On completion, update task status

---

## Default response

If no pending tasks or nothing to coordinate:

```
HEARTBEAT_OK
```

---

## Limits

- NEVER execute long tasks myself → delegate
- NEVER assign tasks without clear deadline
- NEVER interrupt user unless critical
```

---

### Template 2: Developer Agent

For agents that write code (e.g., `opencode`, `code`, `leo`).

```markdown
# HEARTBEAT.md - <AGENT_NAME> (Development)

## Purpose

I am the **software developer**. I implement features, fix bugs, and maintain code quality.

---

## Every 15 minutes, execute:

### 1. Check assigned tasks in Kanban

```bash
GET /api/heartbeat/tasks?agentName=<agent-id>
```

### 2. For each pending task:

- If `status === "in_progress"` and `assignee === "<agent-id>"`:
  - If `claimedBy === null` → **CLAIM** and execute
  - If `claimedBy === "<agent-id>"` → continue

### 3. Development workflow:

1. **PLAN first** - Always understand requirements before coding
2. **BUILD** - Implement according to plan
3. **REVIEW** - Verify it meets requirements
4. **UPDATE** - Mark task as complete with summary

### 4. Task types I handle:

- ✅ New features
- ✅ Bug fixes
- ✅ Refactoring
- ✅ Technical documentation
- ✅ Project configuration

---

## Limits

- NEVER deploy without review
- NEVER modify code without understanding context
- NEVER skip the PLAN phase
- If task > 100 lines of code → comment complexity concern

---

## Default response

If no pending tasks:

```
HEARTBEAT_OK
```
```

---

### Template 3: Research Agent

For agents that search and compile information (e.g., `scout`, `hermes`).

```markdown
# HEARTBEAT.md - <AGENT_NAME> (Research/Investigation)

## Purpose

I am the **research agent**. I search, compile, and analyze information.

---

## Every 15 minutes, execute:

### 1. Check assigned tasks in Kanban

```bash
GET /api/heartbeat/tasks?agentName=<agent-id>
```

### 2. For each pending task:

- If `status === "in_progress"` and `assignee === "<agent-id>"`:
  - If `claimedBy === null` → **CLAIM** and execute
  - If `claimedBy === "<agent-id>"` → continue

### 3. Task types I handle:

- 🔍 Web search and result compilation
- 🔍 Competitor/market research
- 🔍 Feed monitoring (Reddit, RSS, etc.)
- 🔍 Trend analysis
- 🔍 Documentation compilation

---

## Research Protocol

1. **Define scope** - What exactly needs to be searched
2. **Search** - Use available tools (web, reddit, etc.)
3. **Compile** - Organize results clearly
4. **Report** - Update task with findings

---

## Limits

- NEVER make changes to code or systems
- NEVER save to Obsidian (that's `memo`)
- If I need to extract content from URLs → use `extractor`

---

## Default response

If no pending tasks:

```
HEARTBEAT_OK
```
```

---

### Template 4: Content Extractor

For agents that extract and structure content (e.g., `extractor`).

```markdown
# HEARTBEAT.md - <AGENT_NAME> (Content Extraction)

## Purpose

I am the **content extraction specialist**. I extract content from URLs, PDFs, Docs, and other sources.

---

## Every 15 minutes, execute:

### 1. Check assigned tasks in Kanban

```bash
GET /api/heartbeat/tasks?agentName=<agent-id>
```

### 2. For each pending task:

- If `status === "in_progress"` and `assignee === "<agent-id>"`:
  - If `claimedBy === null` → **CLAIM** and execute
  - If `claimedBy === "<agent-id>"` → continue

### 3. Task types I handle:

- 📄 Extract content from URLs (web_fetch)
- 📄 Extract text from PDFs
- 📄 Extract from Google Docs
- 📄 Parse APIs and return structured JSON
- 📄 Convert formats (HTML → Markdown, etc.)

### 4. Expected output:

Always return **structured JSON** with:
```json
{
  "source": "original url",
  "title": "content title",
  "content": "full extracted content",
  "metadata": { ... }
}
```

---

## Limits

- **Maximum timeout:** 60 seconds
- NEVER save to Obsidian → that's `memo`
- NEVER analyze or interpret → only extract
- If content is too large → truncate and warn

---

## Default response

If no pending tasks:

```
HEARTBEAT_OK
```
```

---

### Template 5: Knowledge Base Agent (Obsidian/Second Brain)

For agents that manage knowledge bases (e.g., `memo`, `luna`).

```markdown
# HEARTBEAT.md - <AGENT_NAME> (Knowledge Base)

## Purpose

I am the **second brain** agent. I manage the Obsidian vault and preserve information.

---

## Every 30 minutes, execute:

### 1. Check assigned tasks in Kanban

```bash
GET /api/heartbeat/tasks?agentName=<agent-id>
```

### 2. For each pending task:

- If `status === "in_progress"` and `assignee === "<agent-id>"`:
  - If `claimedBy === null` → **CLAIM** and execute
  - If `claimedBy === "<agent-id>"` → continue

### 3. Task types I handle:

- 🧠 Save notes to Obsidian vault
- 🧠 Organize and classify content
- 🧠 Deduplicate before saving
- 🧠 Maintain folder structure
- 🧠 Process Telegram/communication backlog

---

## ⚠️ CRITICAL: Information Preservation

**NEVER summarize or delete content** - The goal is to ENRICH, not reduce:

- Preserve ALL original content (code, scripts, configurations)
- If there are links, extract their content to add more value
- Organize in clear sections but DO NOT reduce
- Better 500 complete lines than 30 lines of useless summary

---

## Limits

- ONLY save, NEVER extract (if need to extract → use `extractor`)
- NEVER use `_inbox/` folder → classify properly
- ALWAYS deduplicate before saving
- PRESERVE ALL content - never summarize/delete

---

## Default response

If no pending tasks:

```
HEARTBEAT_OK
```
```

---

### Template 6: Minimal/Reactive Agent

For agents that should only work on-demand (e.g., `escapeitor`, specialized tools).

```markdown
# HEARTBEAT.md - <AGENT_NAME> (Specialized)

## Purpose

I am a **specialized agent** for <domain>. I work on assigned tasks in my area of expertise.

---

## Every 15 minutes, execute:

### 1. Check assigned tasks in Kanban

```bash
GET /api/heartbeat/tasks?agentName=<agent-id>
```

### 2. For each pending task:

- If `status === "in_progress"` and `assignee === "<agent-id>"`:
  - If `claimedBy === null` → **CLAIM** and execute
  - If `claimedBy === "<agent-id>"` → continue

### 3. Task types I handle:

- <List specific task types for this agent>

---

## Limits

- <Agent-specific limits>

---

## Default response

If no pending tasks:

```
HEARTBEAT_OK
```
```

---

## Testing Your Setup

### Test 1: Create a Test Task

```bash
# Set your variables
SUPERBOTIJO_URL="http://localhost:3000"
AGENT_ID="boti"
AGENT_KEY="sk-boti-secret-2026"

# Create a test task
curl -X POST "$SUPERBOTIJO_URL/api/kanban/agent/tasks" \
  -H "Content-Type: application/json" \
  -H "X-Agent-Id: $AGENT_ID" \
  -H "X-Agent-Key: $AGENT_KEY" \
  -d '{
    "title": "Test heartbeat system works",
    "description": "Test task for claim, process, and mark as done",
    "assignee": "boti",
    "status": "in_progress",
    "priority": "low"
  }'
```

### Test 2: Verify Task Appears

```bash
# Check that the agent can see the task
curl "$SUPERBOTIJO_URL/api/heartbeat/tasks?agentName=$AGENT_ID" \
  -H "X-Agent-Id: $AGENT_ID" \
  -H "X-Agent-Key: $AGENT_KEY"
```

Expected response:
```json
{
  "agentName": "boti",
  "count": 1,
  "tasks": [
    {
      "id": "task-xxx",
      "title": "Test heartbeat system works",
      "status": "in_progress",
      "isExecutable": true,
      "claimedBy": null
    }
  ]
}
```

### Test 3: Wait for Heartbeat

Wait for the next heartbeat interval (up to 15 minutes) and check:

```bash
# Check if task was claimed and processed
curl "$SUPERBOTIJO_URL/api/kanban/agent/tasks?assignee=$AGENT_ID" \
  -H "X-Agent-Id: $AGENT_ID" \
  -H "X-Agent-Key: $AGENT_KEY"
```

### Test 4: Check Gateway Logs

```bash
# Monitor heartbeat activity
journalctl -u openclaw-gateway -f | grep -i heartbeat
```

### Test 5: Clean Up

```bash
# Delete test task
curl -X DELETE "$SUPERBOTIJO_URL/api/kanban/agent/tasks/<task-id>" \
  -H "X-Agent-Id: $AGENT_ID" \
  -H "X-Agent-Key: $AGENT_KEY"
```

---

## Troubleshooting

### Heartbeat not firing

**Symptoms:** Tasks remain unclaimed, no heartbeat activity in logs.

**Check:**
1. Is heartbeat configured in `openclaw.json`?
   ```bash
   cat ~/.openclaw/openclaw.json | jq '.agents.list[].heartbeat'
   ```
2. Is OpenClaw Gateway running?
   ```bash
   systemctl status openclaw-gateway
   ```
3. Is `HEARTBEAT.md` not empty?
   ```bash
   cat ~/.openclaw/workspace/HEARTBEAT.md
   ```

### Agent sees no tasks

**Symptoms:** API returns empty array but tasks exist in Kanban.

**Check:**
1. Is the task `status: "in_progress"`? (Heartbeat only returns in_progress tasks)
2. Is `assignee` set correctly? Must match agent ID exactly
3. Is the task already claimed by another agent?

### Agent can't claim tasks

**Symptoms:** Claim fails or returns error.

**Check:**
1. Is API key configured correctly in `.env.local`?
2. Does the key match between SuperBotijo and agent config?
3. Check SuperBotijo logs for auth errors

### Task not processed after claim

**Symptoms:** Task is claimed but never completed.

**Check:**
1. Does `HEARTBEAT.md` have processing instructions?
2. Is the task `isExecutable: true`? (Check for blockers)
3. Check agent session logs for errors

---

## Best Practices

### 1. Choose Appropriate Intervals

| Agent Type | Recommended Interval |
|------------|---------------------|
| PM/Coordinator | 5-15 minutes |
| Developer | 15 minutes |
| Research | 15-30 minutes |
| Knowledge Base | 30 minutes (heavier tasks) |
| Specialized | 15-30 minutes |

### 2. Keep HEARTBEAT.md Focused

- Clear, actionable instructions
- Specific API endpoints to call
- Explicit limits and boundaries
- Default `HEARTBEAT_OK` response

### 3. Use Claims Properly

- Always check `claimedBy` before processing
- Claim atomically before starting work
- Release claims if aborting task

### 4. Handle Dependencies

- Check `isExecutable` field
- Respect `blockedReason`
- Don't process blocked tasks

### 5. Update Status Promptly

- Mark as `done` when complete
- Use `review` if needs human review
- Use `blocked` with comment if stuck
- Use `waiting` if waiting for external input

### 6. Log Activity

- Comment on tasks with progress updates
- Log significant actions to activity feed
- Include relevant metadata

---

## Related Documentation

- [CRON-SYSTEMS.md](./CRON-SYSTEMS.md) - Choosing between System Cron, OpenClaw Cron, and Heartbeat
- [TECH-DESIGN-kanban-heartbeat.md](./TECH-DESIGN-kanban-heartbeat.md) - Technical implementation details
- [Kanban-agent-integration.md](./Kanban-agent-integration.md) - Agent Kanban API reference
- [AGENTS.md](../AGENTS.md) - AI coding agent instructions

---

## Support

- Check the [Kanban tab](http://localhost:3000/kanban) in SuperBotijo
- Review activity logs in the dashboard
- Open a GitHub issue for bugs or feature requests

---

**Last updated:** 2026-03-09
**Author:** SuperBotijo 🫙

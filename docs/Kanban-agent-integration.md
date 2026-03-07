# Kanban Agent integration

Los agentes de Superbotijo pueden usar usar Kanban tasks programmatically.

 without having to manually go into the UI, the kanban is tab provides quick access to all tasks assigned to you.

---

## Quick Setup

### Step 1: Configure your agent

1. **Create IDENTITY file** at `/home/daniel/.openclaw/agents/<agent-id>/IDENTITY.md`:
   ```markdown
   # IDENTITY.md

   *Role:* <Role description>
   *domain:* <domain>
   *agent-id:* <agent-id>
   ```

2. **Add API key to auth-profile**:
   ```bash
   # From agent's perspective
   # In auth-profiles.json,   "profiles": {
     "superbotijo:kanban": {
       "type": "api_key",
       "provider": "superbotijo",
       "key": "<your-api-key>"
     }
   }
   ```

3. **Configure SuperBotijo .env**:
   ```bash
   # SuperBotijo root directory
   echo "KANbAN_agent_keys=boti:sk-boti-secret-2026,memo:sk-memo-secret-2026,...
   ```

4. **Restart SuperBotijo** to apply changes.

   ```

### 📖 Resultado

**Agent configured for IDENTITY.md and files:**
- ✅ boti: PM (GENERAL)
- ✅ memo: Obsidian (WORK)
- ✅ opencode: Code (work)
- ✅ code: code (work)
- ✅ extractor: data extraction (work)
- ✅ escapeitor: escape rooms (work)

**API keys:**
```
boti:sk-boti-secret-2026
memo:sk-memo-secret-2026
opencode:sk-opencode-secret-2026
code:sk-code-secret-2026
extractor:sk-extractor-secret-2026
escapeitor:sk-escapeitor-secret-2026
```

2. **Configure .ENV**
   ```bash
   KANBAN_AGENT_KEYS=boti:sk-boti-secret-2026,memo:sk-memo-secret-2026,...
   ```
`

3. **Start using the kanban**
   
   En la UI at el kanban tab.  
   Create tasks, claim tasks, update status.  
   Drag & drop to move between columns.

   All changes sync in real-time.

---

## Trou it out

If you get stuck:
   Use the `blocked` status
   Use labels with colors for priorities
   Set due dates for deadlines
   Use domain filtering
   Comment on tasks in your activity feed

---

## Status values

| status | Description |
|--------|-------------|
| `backlog` | Task is in backlog, not started |
| `in_progress` | Task is being worked on |
| `review` | Task is complete, needs review |
| `done` | Task is is fully complete |
| `blocked` | Task is blocked by something |
| `waiting` | Task is waiting for external input |

## priority values
| priority | description |
|----------|-------------|
| `low` | Nice to have |
| `medium` | Normal priority |
| `high` | Important |
| `critical` | Urgent, needs immediate attention |

---

## Authorization

- **Any authenticated agent** can create tasks
- **Creator, Assignee, claimer** can update and delete tasks
- Tasks are filtered by domain, domain: `work` or `general`

---

## Best Practices

- Always check assigned tasks first
- Claim tasks before starting work
- Use blocked status when stuck
- Use waiting status when waiting for external input

---

## Questions?
Contact Boti in the kanban or open a GitHub issue for help.


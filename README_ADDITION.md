# Activity Sync & Service Configuration (Optional)

## Heartbeat Setup for Autonomous Agents

SuperBotijo supports **heartbeat-driven task polling** for OpenClaw agents. This enables agents to autonomously check for new or updated tasks on the Kanban board - similar to how Vikunja or other task queue systems work.

### What It Does

When heartbeat is configured:
1. Agent periodically polls `GET /api/heartbeat/tasks?agentName=<id>`
2. API returns tasks assigned to the agent with `status="in_progress"`
3. Agent claims unclaimed tasks and processes them
4. Agent updates task status as work progresses

### Quick Setup

**1. Configure heartbeat in openclaw.json:**
```json
{
  "agents": {
    "list": [{
      "id": "developer",
      "heartbeat": { "every": "15m", "target": "none" },
      "skills": ["kanban-tasks"]
    }]
  }
}
```

**2. Create HEARTBEAT.md in agent workspace:**
```markdown
# HEARTBEAT.md

## Every 15 minutes:

1. GET /api/heartbeat/tasks?agentName=developer
2. Claim and process assigned tasks
3. Update status: PATCH /api/kanban/tasks/{id}

If no tasks: HEARTBEAT_OK
```

**3. Generate API keys and configure:**
```bash
# In .env.local
KANBAN_AGENT_KEYS=developer:sk-developer-secret-2026,...
```

📖 **Complete guide with role-based templates:** [docs/HEARTBEAT-SETUP.md](./docs/HEARTBEAT-SETUP.md)

---

## Activity Sync

The Activities dashboard shows real-time agent activity. By default, it's empty because SuperBotijo uses its own database. To populate it with real OpenClaw message data:

```bash
# Install dependencies
sudo apt-get install sqlite3 jq

# Run the sync script (will sync all messages from .jsonl files)
./scripts/sync-openclaw-activities.sh

# Set up auto-sync every 5 minutes
sudo cp scripts/sync-openclaw-activities.sh /opt/superbotijo/
sudo tee /etc/cron.d/superbotijo-sync-activities <<'EOF'
*/5 * * * * root /opt/superbotijo/sync-openclaw-activities.sh >> /var/log/superbotijo-sync.log 2>&1
EOF
```

This will sync thousands of messages (user + agent responses) to the dashboard, showing real activity.

See [docs/activities-sync.md](./docs/activities-sync.md) for details.

## Service Configuration

SuperBotijo automatically detects OpenClaw-related services. No configuration needed for most users.

### Auto-detected services

Services containing these keywords are automatically allowed:
- `openclaw` (e.g., openclaw-gateway)
- `superbotijo` (e.g., superbotijo)
- `superbotijo`

### Additional services (optional)

If you need to control services with different names (e.g., nginx, mysql):

**Option 1: Environment variables**
```bash
# In .env.local
SUPERBOTIJO_SYSTEMD_SERVICES=nginx,mysql,redis-server
SUPERBOTIJO_PM2_SERVICES=my-app,worker-1
```

**Option 2: Config file**

Create `allowed-services.json` in the superbotijo directory:

```json
{
  "systemd": ["nginx", "mysql", "redis-server"],
  "pm2": ["my-app", "worker-1"]
}
```

See [allowed-services.example.json](./allowed-services.example.json) for reference.

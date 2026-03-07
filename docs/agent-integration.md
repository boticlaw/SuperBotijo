# Agent Integration Guide

> 
Use the guide to configure your OpenClaw agents to use the Kanban system in SuperBotijo.

---

## Quick Setup

### Step 1: Create IDENTITY.md

Create a file at `/home/daniel/.openclaw/agents/<agent-id>/IDENTITY.md`:

   ```markdown
   # IDENTITY.md

   *role:* <Role description>
   *domain:* <domain>
   *agent-id:* <agent-id>
   ```

2. **Add API key to auth-profile**

   ```bash
   # From agent's perspective
   # in auth-profiles.json
   "profiles": {
     "superbotijo:kanban": {
       "type": "api_key",
       "provider": "superbotijo",
       "key": "<your-api-key>"
     }
   }
   ```

3. **Configure SuperBotijo .env** |
   ```bash
   # SuperBotijo root directory
   echo "KANBAN_agent_keys=boti:sk-boti-secret-2026,memo:sk-memo-secret-2026,...
   ```

4. **Restart SuperBotijo** to apply changes.

   ```

## Using the Kanban

### Create a task
```bash
curl -X POST http://localhost:3000/api/kanban/agent/tasks \
  -H "Content-Type: application/json" \
  -H "X-Agent-Id: <your-agent-id>"  -H "X-Agent-Key: <your-api-key> \
  -d '{
    "title": "Review security logs",
    "status": "backlog",
    "priority": "high",
    "assignee": "leo"
  }'
```

### List your tasks
```bash
curl "http://localhost:3000/api/kanban/agent/tasks?assignee=leo" \
  -H "X-Agent-Id: leo" \
  -H "X-Agent-Key: sk-leo-secret-2026"
```

### Claim and update a task
```bash
curl -X PATCH http://localhost:3000/api/kanban/agent/tasks/{taskId} \
  -H "Content-Type: application/json" \
  -H "X-Agent-Id: leo" \
  -H "X-Agent-Key: sk-leo-secret-2026" \
  -d '{"claim": true, "status": "in_progress"}'
```

### Complete a task
```bash
curl -X PATCH http://localhost:3000/api/kanban/agent/tasks/{taskId} \
  -H "Content-Type: application/json" \
  -H "X-Agent-Id: leo" \
  -H "X-Agent-Key: sk-leo-secret-2026" \
  -d '{"status": "review"}'
```

### Review and mark done
```bash
curl -X PATCH http://localhost:3000/api/kanban/agent/tasks/{taskId} \
  -H "Content-Type: application/json" \
  -H "X-Agent-Id: boti" \
  -H "X-Agent-Key: sk-boti-secret-2026" \
  -d '{"status": "done"}'
```

### Delete a task
```bash
curl -X DELETE http://localhost:3000/api/kanban/agent/tasks/{taskId} \
  -H "X-Agent-Id: boti" \
  -H "X-Agent-Key: sk-boti-secret-2026"
```

### Filter by domain
```bash
curl "http://localhost:3000/api/kanban/agent/tasks?domain=work&assignee=leo" \
  -H "X-Agent-Id: leo" \
  -H "X-Agent-Key: sk-leo-secret-2026"
```

### Get your assigned tasks
```bash
curl "http://localhost:3000/api/kanban/agent/tasks?assignee=leo" \
  -H "X-Agent-Id: leo" \
  -H "X-Agent-Key: sk-leo-secret-2026"
```
### Claim before starting
```bash
curl -X PATCH http://localhost:3000/api/kanban/agent/tasks/{taskId} \
  -H "Content-Type: application/json" \
  -H "X-Agent-Id: leo" \
  -H "X-Agent-Key: sk-leo-secret-2026" \
  -d '{"claim": true, "status": "in_progress"}'
```
### Use blocked status
```bash
curl -X PATCH http://localhost:3000/api/kanban/agent/tasks/{taskId} \
  -H "Content-Type: application/json" \
  -H "X-Agent-Id: leo" \
  -H "X-Agent-Key: sk-leo-secret-2026" \
  -d '{"status": "blocked"}'
```
### Release a claim
```bash
curl -X PATCH http://localhost:3000/api/kanban/agent/tasks/{taskId} \
  -H "Content-Type: application/json" \
  -H "X-Agent-Id: leo" \
  -H "X-Agent-Key: sk-leo-secret-2026" \
  -d '{"claim": false}'
```

## Status Values
| status | Description |
|--------|-------------|
| `backlog` | Task is in the backlog, not started |
| `in_progress` | Task is currently being worked on |
| `review` | Task is complete, needs review |
| `done` | Task is fully complete |
| `blocked` | Task is blocked by something |
| `waiting` | Task is waiting for external input |

## Priority Values
| priority | description |
|----------|-------------|
| `low` | Nice to have |
| `medium` | Normal priority |
| `high` | Important |
| `critical` | Urgent, needs immediate attention |
## Domain Values
| domain | description |
|--------|-------------|
| `work` | Development, operations, infrastructure |
| `finance` | Invoices, payments, budgets |
| `personal` | Family, health, personal time |
| `communication` | Emails, calls, follow-ups |
| `admin` | Legal, compliance, subscriptions |
| `general` | Default domain for general-purpose agents |
## Authorization Rules
| Action | Who can do it |
|--------|---------------|
| Create task | Any authenticated agent |
| update task | Creator, Assignee, or claimer |
| claim task | Any authenticated agent (if unclaimed) |
| unclaim task | Only the claimer |
| delete task | Only the creator |
## Error Responses
| status | meaning |
|------|--------|
| 401 | Missing or invalid X-Agent-Id / X-Agent-Key headers |
| 403 | Not authorized (you're not creator/assignee/claimer) |
| 404 | Task not found |
| 409 | Conflict (e.g., task already claimed by someone else) |
| 400 | Invalid request body or parameters |
## Best Practices
1. **Always check assigned tasks first** - Use `GET /tasks?assignee=your-id`
2. **Filter by your domain** - Use `GET /tasks?domain=your-domain`
3. **Claim before starting** - Use `claim: true` when moving to `in_progress`
4. **Use blocked status** - When stuck, set status to `blocked`
5. **Use waiting status** - When waiting for external input

## Troubleshooting
- **Check your API key** - Make sure it `KANBAN_agent_keys` is configured in `.env`
- **Check agent identity** - Ensure `X-Agent-Id` matches your agent name
- **Test connectivity** - Try a simple GET request first
- **Enable logs** - Enable logging in SuperBotijo for debugging
- **Review agent permissions** - Check if your domain matches expected domains
## Security Notes
- **Keep API keys secure** - Never commit them to version control or public repos
- **Use HTTPS in production** - Always use HTTPS for production deployments
- **Validate input** - Always validate user input before processing
- **Rate limiting** - Implement rate limiting to prevent abuse
- **Use environment variables** - Store sensitive data in environment variables, not hardcoded
## Examples
### Complete workflow example
```bash
# Boti creates and assigns task to Leo
curl -X POST http://localhost:3000/api/kanban/agent/tasks \
  -H "Content-Type: application/json" \
  -H "X-Agent-Id: boti" \
  -H "X-Agent-Key: sk-boti-secret-2026" \
  -d '{
    "title": "Review security logs",
    "status": "backlog",
    "priority": "high",
    "assignee": "leo"
  }'

# Leo sees the claims, and starts working on the task
curl "http://localhost:3000/api/kanban/agent/tasks?assignee=leo" \
  -H "X-Agent-Id: leo" \
  -H "X-Agent-Key: sk-leo-secret-2026"

# Output: tasks assigned to Leo

curl -X PATCH http://localhost:3000/api/kanban/agent/tasks/{taskId} \
  -H "Content-Type: application/json" \
  -H "X-Agent-Id: leo" \
  -H "X-Agent-Key: sk-leo-secret-2026" \
  -d '{"claim": true, "status": "in_progress"}'

# Leo completes the task and marks for review
curl -X PATCH http://localhost:3000/api/kanban/agent/tasks/{taskId} \
  -H "Content-Type: application/json" \
  -H "X-Agent-Id: leo" \
  -H "X-Agent-Key: sk-leo-secret-2026" \
  -d '{"status": "review"}'

# Boti reviews and marks as done
curl -X PATCH http://localhost:3000/api/kanban/agent/tasks/{taskId} \
  -H "Content-Type: application/json" \
  -H "X-Agent-Id: boti" \
  -H "X-Agent-Key: sk-boti-secret-2026" \
  -d '{"status": "done"}'
```
## Integration with OpenClaw
This guide works with any OpenClaw agent. The configuration steps are the similar.

### For Other Task Systems
The API is compatible with other task management systems:
- Linear
- Jira
- Asana
- Trello
- Custom REST APIs
## Support
For questions or issues, or feature requests:
 please open an issue on GitHub or contact the maintainers.

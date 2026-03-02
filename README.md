# SuperBotijo — OpenClaw Dashboard

> **Based on [TenecitOS](https://github.com/carlosazaustre/tenecitOS)** by [Carlos Azaustre](https://github.com/carlosazaustre)

A real-time dashboard and control center for [OpenClaw](https://openclaw.ai) AI agent instances. Built with Next.js 16, React 19, and Tailwind CSS v4.

> **SuperBotijo** lives inside your OpenClaw workspace and reads its configuration, agents, sessions, memory, and logs directly from the host. No extra database or backend required — OpenClaw is the backend.

---

## Quick Links

| Resource | Description |
|----------|-------------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Complete technical documentation |
| [AGENTS.md](./AGENTS.md) | AI coding agent instructions |
| [docs/COST-TRACKING.md](./docs/COST-TRACKING.md) | Cost tracking guide |

---

## Features

### 📊 Core Monitoring

| Feature | Description |
|---------|-------------|
| **Dashboard** | Activity overview, agent status, weather widget, quick stats |
| **Agents** | Multi-agent overview with cards, hierarchy, and communication graph |
| **Sessions** | Session history with transcript viewer and model switching |
| **Activity** | Real-time activity log with heatmap, filters, and CSV export |
| **System Monitor** | CPU, RAM, Disk, Network metrics + PM2/Docker/systemd services |

### 📁 Data Management

| Feature | Description |
|---------|-------------|
| **Memory Browser** | Edit MEMORY.md with live preview, knowledge graph, word cloud |
| **File Browser** | Navigate workspaces with 2D/3D visualization |
| **Global Search** | Full-text search across memory and workspace files |
| **Git Dashboard** | Repository status, branch info, quick actions |

### 📈 Analytics & Insights

| Feature | Description |
|---------|-------------|
| **Analytics** | Daily trends, Sankey diagrams, cost breakdown by agent/model |
| **Reports** | Generate weekly/monthly reports with PDF export and sharing |
| **Smart Suggestions** | AI-powered optimization tips based on usage patterns |

### 🤖 Agent Intelligence

| Feature | Description |
|---------|-------------|
| **Sub-Agents** | Real-time monitoring with spawn/completion timeline |
| **Workflows** | Visual multi-agent workflow designer with drag & drop |
| **Model Playground** | Compare responses from multiple models side-by-side |
| **Communication Graph** | Network visualization of messages between agents |

### ⏰ Scheduling

| Feature | Description |
|---------|-------------|
| **Cron Manager** | OpenClaw + system cron jobs with weekly timeline |
| **Heartbeat** | Configure HEARTBEAT.md and active hours |
| **Calendar** | Weekly view of scheduled tasks |

### 🏢 3D Visualization

| Feature | Description |
|---------|-------------|
| **Office 3D** | Multi-floor building with animated avatars |
| **Day/Night** | Automatic lighting based on time of day |
| **Interactions** | Click objects to navigate (file cabinet → Memory, coffee → Mood) |

### 🛠 Tools

| Feature | Description |
|---------|-------------|
| **Terminal** | Browser-based terminal with safe command allowlist |
| **Skills Manager** | View, enable/disable, and install skills from ClawHub |
| **Notifications** | Outbox log of all messages sent (Telegram, Discord, etc.) |
| **Settings** | System info, integration status, config editor |

---

## Screenshots

**Dashboard** — activity overview, agent status, and weather widget

![Dashboard](./docs/screenshots/dashboard.jpg)

**Analytics** — daily cost trends, Sankey diagrams, and breakdown per agent

![Analytics](./docs/screenshots/costs.jpg)

**Sessions** — all OpenClaw sessions with token usage and context tracking

![Sessions](./docs/screenshots/sessions.jpg)

**System Monitor** — real-time CPU, RAM, Disk, and Network metrics

![System Monitor](./docs/screenshots/system.jpg)

**Office 3D** — interactive 3D office with one voxel avatar per agent

![Office 3D](./docs/screenshots/office3d.jpg)

---

## Requirements

| Requirement | Version |
|-------------|---------|
| Node.js | 18+ (tested with v22) |
| OpenClaw | Installed on the same host |
| PM2 or systemd | Recommended for production |
| Reverse proxy | Caddy or nginx (for HTTPS) |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Browser (React 19)                       │
├─────────────────────────────────────────────────────────────┤
│                    Next.js 16 App Router                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  21 Pages   │  │ ~90 APIs    │  │    Auth Middleware   │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                      Data Sources                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   OpenClaw  │  │   SQLite    │  │     JSON Files      │  │
│  │  (CLI/FS)   │  │  (2 DBs)    │  │      (data/)        │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**See [ARCHITECTURE.md](./ARCHITECTURE.md) for complete technical documentation.**

---

## How It Works

SuperBotijo reads directly from your OpenClaw installation:

```
/root/.openclaw/              ← OPENCLAW_DIR (configurable)
├── openclaw.json             ← agents list, channels, models config
├── workspace/                ← main agent workspace
│   ├── MEMORY.md             ← agent memory
│   ├── SOUL.md               ← agent personality
│   ├── IDENTITY.md           ← agent identity
│   └── sessions/             ← session history (.jsonl files)
├── workspace-studio/         ← sub-agent workspaces
├── workspace-infra/
├── ...
└── workspace/superbotijo/    ← SuperBotijo lives here
```

The app uses `OPENCLAW_DIR` to locate `openclaw.json` and all workspaces. **No manual agent configuration needed** — agents are auto-discovered.

---

## Installation

### 1. Clone into your OpenClaw workspace

```bash
cd /root/.openclaw/workspace   # or your OPENCLAW_DIR/workspace
git clone https://github.com/boticlaw/SuperBotijo.git superbotijo
cd superbotijo
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
# --- Auth (required) ---
ADMIN_PASSWORD=your-secure-password-here
AUTH_SECRET=your-random-32-char-secret-here

# --- OpenClaw paths (optional) ---
# OPENCLAW_DIR=/root/.openclaw

# --- Branding (customize) ---
NEXT_PUBLIC_AGENT_NAME=SuperBotijo
NEXT_PUBLIC_AGENT_EMOJI=🤖
NEXT_PUBLIC_AGENT_DESCRIPTION=Your AI co-pilot
NEXT_PUBLIC_AGENT_LOCATION=Madrid, Spain
NEXT_PUBLIC_BIRTH_DATE=2026-01-01
```

### 3. Initialize data files

```bash
cp data/cron-jobs.example.json data/cron-jobs.json
cp data/activities.example.json data/activities.json
cp data/notifications.example.json data/notifications.json
cp data/configured-skills.example.json data/configured-skills.json
cp data/tasks.example.json data/tasks.json
```

### 4. Generate secrets

```bash
openssl rand -base64 32   # AUTH_SECRET
openssl rand -base64 18   # ADMIN_PASSWORD
```

### 5. Run

```bash
npm run dev    # Development → http://localhost:3000
npm run build && npm start  # Production
```

---

## Production Deployment

### PM2 (recommended)

```bash
npm run build
pm2 start npm --name "superbotijo" -- start
pm2 save
pm2 startup
```

### systemd

```ini
# /etc/systemd/system/superbotijo.service
[Unit]
Description=SuperBotijo — OpenClaw Dashboard
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/root/.openclaw/workspace/superbotijo
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable superbotijo
sudo systemctl start superbotijo
```

### Reverse Proxy (Caddy)

```caddyfile
superbotijo.yourdomain.com {
    reverse_proxy localhost:3000
}
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router) |
| UI | React 19 + Tailwind CSS v4 |
| 3D | React Three Fiber + Drei + Rapier |
| Charts | Recharts |
| Graphs | @xyflow/react (React Flow) |
| Icons | Lucide React |
| Database | SQLite (better-sqlite3) |
| Runtime | Node.js 22 |

---

## Project Structure

```
superbotijo/
├── src/
│   ├── app/
│   │   ├── (dashboard)/     # 21 dashboard pages
│   │   ├── api/             # ~90 API endpoints
│   │   ├── login/           # Login page
│   │   └── office/          # 3D office (public)
│   ├── components/          # ~100 React components
│   │   ├── SuperBotijo/     # OS-style UI shell
│   │   ├── Office3D/        # 3D office scene
│   │   ├── charts/          # Recharts wrappers
│   │   ├── sankey/          # Sankey diagrams
│   │   ├── workflow/        # Workflow designer
│   │   └── files-3d/        # 3D file tree
│   ├── hooks/               # 6 custom hooks
│   ├── lib/                 # 20 utility modules
│   ├── config/              # Branding config
│   ├── i18n/                # Internationalization
│   └── middleware.ts        # Auth guard
├── data/                    # JSON data files
├── scripts/                 # Setup scripts
├── public/models/           # GLB avatar models
└── docs/                    # Documentation
```

---

## Pages Reference

| Route | Page | Description |
|-------|------|-------------|
| `/` | Dashboard | Overview, stats, activity feed |
| `/agents` | Agents | Multi-agent system overview |
| `/sessions` | Sessions | Session history & transcripts |
| `/analytics` | Analytics | Charts, costs, Sankey diagrams |
| `/activity` | Activity | Activity log with filters |
| `/memory` | Memory | Knowledge base editor |
| `/files` | Files | File browser (2D/3D) |
| `/system` | System | Hardware & services monitor |
| `/cron` | Cron | Job scheduler |
| `/subagents` | Subagents | Sub-agent monitoring |
| `/workflows` | Workflows | Visual workflow designer |
| `/playground` | Playground | Model comparison |
| `/reports` | Reports | Generated reports |
| `/skills` | Skills | Skills manager |
| `/notifications` | Notifications | Outbox log |
| `/terminal` | Terminal | Browser terminal |
| `/settings` | Settings | Configuration |
| `/git` | Git | Repository dashboard |
| `/logs` | Logs | Real-time log streaming |
| `/calendar` | Calendar | Weekly view |
| `/about` | About | Agent profile |
| `/office` | Office 3D | 3D visualization |

---

## API Overview

### Categories

| Category | Endpoints | Description |
|----------|-----------|-------------|
| Auth | 2 | Login, logout |
| Agents | 12 | CRUD, status, metrics, mood |
| Sessions | 3 | List, transcript, model change |
| Files | 9 | CRUD, upload, download, tree |
| Activities | 5 | CRUD, stats, stream, approve |
| Analytics | 4 | Data, token/task/time flows |
| Costs | 3 | Summary, efficiency, top tasks |
| Cron | 9 | CRUD, runs, system jobs |
| Skills | 7 | CRUD, toggle, ClawHub |
| Workflows | 5 | CRUD, execute |
| System | 6 | Info, monitor, services |
| Other | 20+ | Weather, git, logs, etc. |

**See [ARCHITECTURE.md](./ARCHITECTURE.md#api-reference) for complete API documentation.**

---

## Security

| Feature | Implementation |
|---------|----------------|
| **Auth** | Password-protected with httpOnly cookie |
| **Rate Limiting** | 5 attempts → 15-min lockout per IP |
| **Route Protection** | All routes protected by middleware |
| **Terminal** | Strict command allowlist |
| **File Access** | Path sanitization, protected files |

**Public routes only:**
- `/login`
- `/api/auth/*`
- `/api/health`
- `/reports/[token]` (token-based)

---

## Configuration

### Agent Branding

All personal data in `.env.local` (gitignored). See `src/config/branding.ts`.

### Agent Discovery

Agents auto-discovered from `openclaw.json`:

```json
{
  "agents": {
    "list": [
      { "id": "main", "name": "...", "workspace": "..." },
      { "id": "studio", "name": "...", "workspace": "...", "ui": { "emoji": "🎬", "color": "#E91E63" } }
    ]
  }
}
```

### Office 3D — Agent Positions

Edit `src/components/Office3D/agentsConfig.ts`:

```typescript
export const AGENTS: AgentConfig[] = [
  { id: "main", name: "Main", emoji: "🤖", position: [0, 0, 0], color: "#FFCC00", role: "Primary" },
  // add more agents
];
```

### Custom Avatars

Place GLB files in `public/models/`:

```
public/models/
├── main.glb      ← matches agent id
├── studio.glb
└── infra.glb
```

---

## Cost Tracking

```bash
# Collect once
npx tsx scripts/collect-usage.ts

# Setup hourly cron
./scripts/setup-cron.sh
```

See [docs/COST-TRACKING.md](./docs/COST-TRACKING.md) for details.

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Gateway not reachable" | `openclaw gateway start` |
| "Database not found" | `npx tsx scripts/collect-usage.ts` |
| Build errors | `rm -rf .next node_modules && npm install && npm run build` |
| Scripts not executable | `chmod +x scripts/*.sh` |

---

## What's New in SuperBotijo

Compared to the original TenecitOS:

| Feature | Description |
|---------|-------------|
| Knowledge Graph | Interactive concept visualization |
| Word Cloud | Frequent terms from memories |
| 3D File Tree | Navigate files in 3D space |
| Sankey Diagrams | Token/task/time flow visualization |
| Communication Graph | Agent message network |
| Workflow Designer | Visual multi-agent orchestration |
| Model Playground | Side-by-side model comparison |
| Smart Suggestions | AI-powered optimization tips |
| Shareable Reports | Export and share reports |
| Multi-floor Office | 4-floor building + rooftop |
| Git Dashboard | Repository management |
| Log Streaming | Real-time log viewer |
| i18n | English + Spanish support |

---

## Contributing

1. Fork the repo
2. Create a feature branch (`git checkout -b feat/my-feature`)
3. **Keep personal data out of commits** — use `.env.local` and `data/`
4. Run `npm run lint && npx tsc --noEmit` before committing
5. Open a PR

See [CONTRIBUTING.md](./CONTRIBUTING.md) for details.

---

## License

MIT — see [LICENSE](./LICENSE)

---

## Links

- [TenecitOS](https://github.com/carlosazaustre/tenecitOS) — Original project
- [OpenClaw](https://openclaw.ai) — AI agent runtime
- [OpenClaw Docs](https://docs.openclaw.ai)
- [Discord Community](https://discord.com/invite/clawd)
- [GitHub Issues](../../issues)

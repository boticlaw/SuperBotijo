# AGENTS.md — SuperBotijo Codebase Guide

This document provides essential information for AI coding agents working in the SuperBotijo codebase.

---

## Build, Lint, and Run Commands

```bash
# Development server (with network access)
npm run dev

# Production build
npm run build

# Production server
npm start

# Lint check (runs ESLint)
npm run lint

# Lint specific files
npm run lint -- src/lib/pricing.ts

# Type check (via tsc)
npx tsc --noEmit
```

> **Note:** This project does not currently have a test suite configured. If tests are added, check `package.json` for the test command.

---

## Project Overview

SuperBotijo is a real-time dashboard for OpenClaw AI agent instances. It reads directly from the OpenClaw installation (config, sessions, memory, logs) without requiring a separate database.

**Tech Stack:**
- **Framework:** Next.js 16 (App Router)
- **UI:** React 19 + Tailwind CSS v4
- **3D Graphics:** React Three Fiber + Drei + Rapier
- **Charts:** Recharts
- **Icons:** Lucide React
- **Database:** SQLite (better-sqlite3) for usage tracking
- **Runtime:** Node.js 18+ (tested with v22)

---

## Project Structure

```
src/
├── app/
│   ├── (dashboard)/     # Protected dashboard pages
│   │   └── settings/    # Settings page with System, Config, Pricing tabs
│   ├── api/             # API routes (all require auth except /api/auth/*, /api/health)
│   │   ├── pricing/     # Model pricing configuration (GET/PUT/DELETE)
│   │   ├── costs/       # Usage costs and budget management
│   │   └── ...          # Other API endpoints
│   ├── login/           # Login page
│   └── office/          # 3D office (unprotected)
├── components/
│   ├── SuperBotijo/     # OS-style UI shell (topbar, dock, status bar)
│   ├── Office3D/        # React Three Fiber 3D components
│   ├── charts/          # Recharts wrappers
│   ├── ConfigEditor.tsx # Editor for openclaw.json configuration
│   ├── PricingEditor.tsx# Editor for model pricing overrides
│   └── *.tsx            # Other feature components
├── config/
│   └── branding.ts      # Branding constants (reads from env vars)
├── hooks/               # Custom React hooks
├── i18n/                # Internationalization (en, es)
├── lib/
│   ├── pricing.ts       # Model pricing calculation and configuration
│   ├── usage-collector.ts # Usage data collection
│   └── ...              # Other utilities
└── middleware.ts        # Auth guard for all routes

data/                    # JSON data files (gitignored)
├── model-pricing.json   # User-configured model price overrides
├── budget-settings.json # Monthly budget configuration
└── usage-tracking.db    # SQLite database for usage history
scripts/                 # Setup and data collection scripts
public/models/           # GLB avatar models
```

---

## Internationalization (i18n)

This project supports **English (en)** and **Spanish (es)** via a custom i18n system. **ALL user-visible text MUST be internationalized.**

### How It Works

1. **Provider**: `I18nProvider` wraps the dashboard layout
2. **Hook**: `useI18n()` provides translation functions
3. **Messages**: JSON files in `src/i18n/messages/` (`en.json`, `es.json`)
4. **Detection**: Auto-detects locale from localStorage, cookie, or browser settings

### Usage

```typescript
import { useI18n } from "@/i18n/provider";

export function MyComponent() {
  const { t, locale, setLocale, formatNumber, formatDateTime } = useI18n();

  return (
    <div>
      {/* Simple translation */}
      <h1>{t("dashboard.title")}</h1>

      {/* With interpolation */}
      <p>{t("common.showing", { count: 5, total: 100 })}</p>

      {/* Number formatting */}
      <span>{formatNumber(1234567)}</span>

      {/* Date/time formatting */}
      <time>{formatDateTime(new Date())}</time>
    </div>
  );
}
```

### Adding New Translations

1. Add the key to **BOTH** `en.json` and `es.json`:
   ```json
   // en.json
   "myFeature": {
     "title": "My Feature",
     "description": "This is {name}'s feature"
   }

   // es.json
   "myFeature": {
     "title": "Mi Feature",
     "description": "Este es el feature de {name}"
   }
   ```

2. Use it in code: `t("myFeature.title")` or `t("myFeature.description", { name: "John" })`

### Rules

- **NEVER** hardcode user-visible strings in components
- **ALWAYS** add translations to both `en.json` and `es.json`
- Use **dot notation** for nested keys: `"section.subkey"`
- Use **interpolation** for dynamic values: `{count}`, `{name}`, etc.
- **API error messages** should also be internationalized when shown to users

---

## Code Style Guidelines

### Imports

Order imports in this sequence, separated by blank lines:

1. **Node.js built-ins** (`fs`, `path`, `crypto`, etc.)
2. **External packages** (`next`, `react`, `lucide-react`, etc.)
3. **Internal aliases** (`@/components/...`, `@/lib/...`)

```typescript
// Node.js built-ins
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

// External packages
import { NextResponse } from "next/server";
import { useEffect, useState } from "react";
import { Activity, CheckCircle } from "lucide-react";

// Internal imports with @ alias
import { StatsCard } from "@/components/StatsCard";
import { BRANDING } from "@/config/branding";
import { logActivity } from "@/lib/activity-logger";
```

### Strings and Quotes

- Use **double quotes** for all strings
- Use template literals for interpolation

```typescript
const configPath = openclawDir + "/openclaw.json";
const message = `Unknown model: ${modelId}`;
```

### TypeScript

- **Strict mode is enabled** — all code must type-check
- Define **interfaces** for all object shapes, especially props and API responses
- Export interfaces when they're reused across files
- Use `const` assertions for constant objects

```typescript
// Interface for component props
interface StatsCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  iconColor?: string;
}

// Exported type for reuse
export type ActivityStatus = 'success' | 'error' | 'pending';

// Const assertion for config
export const BRANDING = {
  agentName: "...",
  agentEmoji: "...",
} as const;
```

### Component Patterns

- Add `"use client";` directive at the very top of client components
- Use **named exports** for components
- Destructure props in the function signature

```typescript
"use client";

import { ReactNode } from "react";

interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary";
}

export function Button({ children, onClick, variant = "primary" }: ButtonProps) {
  return (
    <button onClick={onClick} className={...}>
      {children}
    </button>
  );
}
```

### API Routes

- Export `export const dynamic = "force-dynamic";` for dynamic routes
- Always wrap route handlers in try/catch
- Return consistent JSON error responses

```typescript
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await fetchData();
    return NextResponse.json({ data });
  } catch (error) {
    console.error("Error description:", error);
    return NextResponse.json(
      { error: "Human-readable error message" },
      { status: 500 }
    );
  }
}
```

### Styling

- Use **Tailwind CSS classes** for most styling
- Use **CSS custom properties** (defined in `globals.css`) for theme colors
- Use inline `style` prop for dynamic values (colors from data, etc.)

```typescript
// Tailwind for layout/spacing
<div className="rounded-xl p-4 md:p-6 grid grid-cols-2 gap-3">

// CSS custom properties for theme
<div style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>

// Inline styles for dynamic values
<div style={{ border: `2px solid ${agent.color}` }}>
```

**Available CSS variables:**
- `--card`, `--card-elevated`, `--border`
- `--text-primary`, `--text-secondary`, `--text-muted`
- `--accent`, `--success`, `--error`, `--info`
- `--font-heading`, `--font-body`

### Error Handling

- Use try/catch in async operations
- Log errors with `console.error()` and a descriptive message
- Return user-friendly error messages (not raw error objects)
- Handle missing files gracefully (return empty arrays, default values)

```typescript
try {
  const data = fs.readFileSync(DATA_PATH, 'utf-8');
  return JSON.parse(data);
} catch {
  // File doesn't exist or is invalid — return safe default
  return [];
}
```

### Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Components | PascalCase | `StatsCard`, `ActivityFeed` |
| Functions | camelCase | `logActivity`, `calculateCost` |
| Constants | SCREAMING_SNAKE_CASE | `OPENCLAW_DIR`, `MODEL_PRICING` |
| Interfaces | PascalCase, descriptive | `ActivityMetadata`, `AgentConfig` |
| Type aliases | PascalCase | `ActivityType`, `ActivityStatus` |
| Files | PascalCase for components | `StatsCard.tsx`, `pricing.ts` |

### Comments

- Use **JSDoc** for exported functions with parameters/return values
- Use inline comments for non-obvious logic
- Keep comments concise and explain "why", not "what"

```typescript
/**
 * Calculate cost for a given model and token usage
 * @param modelId - Model identifier or alias
 * @param inputTokens - Number of input tokens
 * @param outputTokens - Number of output tokens
 * @returns Cost in USD
 */
export function calculateCost(modelId: string, inputTokens: number, outputTokens: number): number {
  // ...
}
```

---

## Environment Variables

All personal/instance data goes in `.env.local` (gitignored). Never hardcode:

- `ADMIN_PASSWORD` — Dashboard login password
- `AUTH_SECRET` — Cookie signing secret
- `OPENCLAW_DIR` — Path to OpenClaw installation (default: `/root/.openclaw`)
- `NEXT_PUBLIC_*` — Branding variables (name, emoji, etc.)

Read environment variables via `process.env.VAR_NAME` or in `src/config/branding.ts`.

---

## Security Notes

- All routes require authentication via `src/middleware.ts`
- Only `/login`, `/api/auth/*`, and `/api/health` are public
- Never commit `.env.local` or files in `data/`
- Terminal API uses a strict command allowlist

---

## Common Tasks

### Adding a new API endpoint

1. Create `src/app/api/<route>/route.ts`
2. Export `GET`, `POST`, etc. functions
3. Add `export const dynamic = "force-dynamic";`
4. All endpoints are protected by middleware automatically

### Adding a new dashboard page

1. Create `src/app/(dashboard)/<page>/page.tsx`
2. Use `"use client";` if client-side state/effects are needed
3. Follow the existing page patterns for layout consistency

### Adding a new component

1. Create in `src/components/` (or appropriate subdirectory)
2. Export as named export
3. Define props interface above the component
4. Import via `@/components/ComponentName`

### Adding a new AI model for pricing

1. Add model entry to `MODEL_PRICING` array in `src/lib/pricing.ts`
2. Include: `id`, `name`, `alias` (optional), `inputPricePerMillion`, `outputPricePerMillion`, `contextWindow`
3. Add cache pricing fields if model supports caching: `cacheReadPricePerMillion`, `cacheWritePricePerMillion`
4. The model will automatically appear in Settings > Pricing tab

---

## Contextual Help System

SuperBotijo uses a **contextual help system** that explains what each section does and how to use it. All pages include tooltips with explanations accessible via this system.

### Components

| Component | Purpose |
|-----------|---------|
| `HelpTooltip` | Reusable tooltip component with title + description |
| `PageHeader` | Page header with optional help badge |

### Usage

| Component | Example |
|-----------|---------|
| `HelpTooltip` | `<HelpTooltip title="What is this?" description="Click the ? icon" /> |
| `PageHeader` | `<PageHeader title="Agents" helpTitle="Agents" helpDescription="..." /> |

### Adding help to a new section
1. Add the help key in **BOTH** `en.json` and `es.json`:
    ```json
    // en.json
    "help": {
      "dashboard": {
        "title": "Dashboard",
        "description": "Overview of agent activity, quick stats, and recent events. Your command center for monitoring OpenClaw."
      },
      "agents": {
        "title": "Agents",
        "description": "View and manage your AI agents. See hierarchy, communication patterns, and spawn new subagents."
      },
      "office": {
        "title": "3D Office",
        "description": "Interactive 3D visualization of your agent workspace. A fun way to see your agents in action."
      },
      "memory": {
        "title": "Memory Browser",
        "description": "Explore and edit agent memory files. See what your agents remember across sessions."
      },
      "files": {
        "title": "File Browser",
        "description": "Browse agent workspaces and files. Navigate the code your agents are working on."
      },
      "analytics": {
        "title": "Analytics & Costs",
        "description": "Track token usage, costs by model, and budget. Keep your AI spending under control."
      },
      "workflows": {
        "title": "Workflow Designer",
        "description": "Design visual workflows for multi-agent automation. Chain agents together."
      },
      "terminal": {
        "title": "Terminal",
        "description": "Browser-based terminal for quick commands. Read-only for safety (ls, cat, git status, etc.)"
      },
      "system": {
        "title": "System Monitor",
        "description": "Real-time server monitoring. CPU, RAM, disk, network, and service status."
      },
      "settings": {
        "title": "Settings",
        "description": "Configure OpenClaw, edit model pricing, and manage system settings."
      }
    }
    ```

2. Use it in code: `t("myFeature.title")` or `t("myFeature.description", { name: "John" })`

    ```

### Rules

- **NEVER** hardcode user-visible strings in components
- **ALWAYS** add translations to both `en.json` and `es.json`
- Use **dot notation** for nested keys: `"section.subkey"`
- Use **interpolation** for dynamic values: `{count}`, `{name}`, etc.
- **API error messages** should also be internationalized when shown to users



SuperBotijo supports **runtime configuration of model prices** via the Settings UI.

### How It Works

1. **Default prices** are defined in `src/lib/pricing.ts` as `MODEL_PRICING` constant
2. **User overrides** are stored in `data/model-pricing.json` (gitignored)
3. **Merged pricing** combines defaults with overrides at runtime (override wins by `id`)
4. **Cost calculations** use merged pricing, not hardcoded values

### Key Files

| File | Purpose |
|------|---------|
| `src/lib/pricing.ts` | Default prices, merge logic, cost calculation |
| `src/app/api/pricing/route.ts` | CRUD API for price overrides |
| `src/components/PricingEditor.tsx` | Settings UI for editing prices |
| `data/model-pricing.json` | Runtime price overrides (auto-created) |

### Key Functions in `pricing.ts`

```typescript
// Get user-configured overrides (from JSON file)
getPricingOverrides(): PricingOverride[]

// Get merged pricing (defaults + overrides)
getMergedPricing(): ModelPricingEntry[]

// Calculate cost using merged pricing
calculateCost(modelId, inputTokens, outputTokens, cacheRead?, cacheWrite?): number
```

### Adding Price Overrides Programmatically

```typescript
// PUT /api/pricing
{
  "overrides": [
    {
      "id": "anthropic/claude-opus-4-6",
      "inputPricePerMillion": 12.00,
      "outputPricePerMillion": 60.00
    }
  ]
}
```

---

## Kanban Heartbeat Integration

SuperBotijo supports **heartbeat-driven task polling** for OpenClaw agents. This enables agents to autonomously check for new or updated tasks on the Kanban board—similar to how Vikunja or other task queue systems work.

### The Problem

Agents in OpenClaw are typically "set and forget"—they're spawned with tasks but have no built-in mechanism to periodically check for new work. When a task is assigned or updated, the agent doesn't know unless manually triggered or respawned.

### The Solution: Heartbeats

Agents configure a `heartbeat` in `openclaw.json` that specifies how often they should poll for work. When the heartbeat fires, the agent:

1. Calls `GET /api/heartbeat/tasks?agentName=<agent-id>`
2. Receives tasks assigned to it with status `in_progress`
3. Claims unclaimed tasks and processes them
4. Updates task status as work progresses

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

### Heartbeat Workflow

```
1. Timer fires (every N minutes)
        ↓
2. Agent calls GET /api/heartbeat/tasks?agentName=me
        ↓
3. API returns assigned tasks (status=in_progress)
        ↓
4. For each task:
   - Check if already claimed by me
   - If not claimed: claim it (PATCH /api/kanban/tasks)
   - If already claimed: process it
        ↓
5. Update task status as work progresses
   - PATCH /api/kanban/tasks/{id} { status: "done" }
```

### User Story: The Morning Standup

> Every morning at 8:00 AM, the Project Manager agent reviews the Kanban board and assigns three new tasks to the Developer agent. The Developer agent has a heartbeat configured to run every 15 minutes. When it fires, it polls for tasks, finds the new work waiting, and starts processing it—without being respawned.

This enables **autonomous agent behavior**: agents work like employees checking a task board, picking up new work when it appears.

### Key Files

| File | Purpose |
|------|---------|
| `src/lib/openclaw-agents.ts` | Reads heartbeat config from openclaw.json |
| `src/lib/kanban-db.ts` | Kanban task storage and queries |
| `src/app/api/heartbeat/tasks/route.ts` | Returns assigned in-progress tasks |
| `src/app/api/tasks/route.ts` | Unified cron + heartbeat view |

### Best Practices

1. **Choose appropriate interval**: 15-30 minutes is good for most agents
2. **Claim tasks promptly**: Agents should claim tasks quickly to avoid conflicts
3. **Update status regularly**: Mark tasks as done, error, or in-progress as work progresses
4. **Handle dependencies**: Use the dependency resolver to avoid working on blocked tasks

Run these commands to ensure code quality:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

Fix all errors before pushing. Warnings are acceptable but should be reviewed.

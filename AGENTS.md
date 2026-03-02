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

## Model Pricing System

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

## Before Committing

Run these commands to ensure code quality:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

Fix all errors before pushing. Warnings are acceptable but should be reviewed.

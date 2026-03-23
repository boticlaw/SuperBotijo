import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import DashboardClient from "./DashboardClient";
import type { DashboardTelemetryResponse } from "@/lib/telemetry/types";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/StatsCard", () => ({
  StatsCard: ({
    title,
    value,
  }: {
    title: string;
    value: string | number;
  }) => <div>{`${title}: ${value}`}</div>,
}));
vi.mock("@/components/ActivityFeed", () => ({
  ActivityFeed: () => <div>activity-feed</div>,
}));
vi.mock("@/components/WeatherWidget", () => ({
  WeatherWidget: () => <div>weather-widget</div>,
}));
vi.mock("@/components/MoodWidget", () => ({
  MoodWidget: () => <div>mood-widget</div>,
}));
vi.mock("@/components/SuggestionsPanel", () => ({
  SuggestionsPanel: () => <div>suggestions-panel</div>,
}));
vi.mock("@/components/ErrorBoundary", () => ({
  ErrorBoundary: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/PageHeader", () => ({
  PageHeader: ({
    title,
    subtitle,
  }: {
    title: string;
    subtitle: string;
  }) => <div>{`${title} - ${subtitle}`}</div>,
}));

vi.mock("@/i18n/provider", () => ({
  useI18n: (() => {
    const i18n = {
      t: (key: string, values?: Record<string, string | number>) => {
        const messages: Record<string, string> = {
          "dashboard.title": "SuperBotijo",
          "dashboard.overview": "Overview of agent activity",
          "dashboard.totalActivities": "Total Activities",
          "dashboard.today": "Today",
          "dashboard.successful": "Successful",
          "dashboard.errors": "Errors",
          "dashboard.multiAgentSystem": "Multi-Agent System",
          "dashboard.telemetry.loading": "Loading real telemetry...",
          "dashboard.telemetry.loadError": "Unable to load real telemetry",
          "dashboard.telemetry.empty": "No agents available from telemetry",
          "dashboard.telemetry.stale": "Telemetry is stale ({seconds}s old)",
          "dashboard.telemetry.degradedTitle":
            "Telemetry degraded in {count} section(s)",
          "dashboard.telemetry.degradedItem": "{section}: {message}",
          "dashboard.openOffice": "Open Office",
          "dashboard.quickLinks": "Quick Links",
          "dashboard.recentActivity": "Recent Activity",
          "dashboard.smartSuggestions": "Smart Suggestions",
          "dashboard.cronJobs": "Cron Jobs",
          "dashboard.system": "System",
          "dashboard.liveLogs": "Live Logs",
          "dashboard.memory": "Memory",
          "dashboard.skills": "Skills",
          "common.viewAll": "View all",
          "common.retry": "Retry",
          "agents.status.working": "Working",
          "agents.status.online": "Online",
          "agents.status.idle": "Idle",
          "agents.status.offline": "Offline",
        };

        const template = messages[key] ?? key;
        if (!values) {
          return template;
        }

        return template.replace(
          /\{(\w+)\}/g,
          (_, token: string) => String(values[token] ?? `{${token}}`),
        );
      },
    };

    return () => i18n;
  })(),
}));

const mockFetch = vi.fn();
const originalFetch = global.fetch;

function createMockTelemetry(
  overrides: Partial<DashboardTelemetryResponse> = {},
): DashboardTelemetryResponse {
  return {
    freshness: {
      snapshotAt: new Date().toISOString(),
      snapshotAgeSec: 5,
      stalenessThresholdSec: 30,
      status: "fresh",
    },
    summary: {
      totalActivities: 120,
      todayActivities: 9,
      successfulActivities: 8,
      failedActivities: 1,
    },
    agents: [
      {
        id: "main",
        name: "Main",
        emoji: "🤖",
        color: "#111111",
        model: "anthropic/claude-sonnet-4",
        status: "working",
        activeSessions: 2,
      },
    ],
    degraded: [],
    ...overrides,
  };
}

describe("DashboardClient telemetry states", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_DASHBOARD_REAL_TELEMETRY", "true");
    mockFetch.mockReset();
    global.fetch = mockFetch;
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => createMockTelemetry(),
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  it("renders telemetry-backed stats and agent cards", async () => {
    const telemetry = createMockTelemetry();

    render(<DashboardClient initialTelemetry={telemetry} />);

    expect(
      await screen.findByText("Total Activities: 120"),
    ).toBeInTheDocument();
    expect(await screen.findByText("Main")).toBeInTheDocument();
  });

  it("renders empty state when telemetry has no agents", async () => {
    const telemetry = createMockTelemetry({
      summary: {
        totalActivities: 0,
        todayActivities: 0,
        successfulActivities: 0,
        failedActivities: 0,
      },
      agents: [],
    });

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => telemetry,
    });

    render(<DashboardClient initialTelemetry={telemetry} />);

    expect(
      await screen.findByText("Total Activities: 0"),
    ).toBeInTheDocument();
  });

  it("renders stale and degraded indicators", async () => {
    const telemetry = createMockTelemetry({
      freshness: {
        snapshotAt: new Date(Date.now() - 90000).toISOString(),
        snapshotAgeSec: 90,
        stalenessThresholdSec: 30,
        status: "stale",
      },
      summary: {
        totalActivities: 10,
        todayActivities: 1,
        successfulActivities: 1,
        failedActivities: 0,
      },
      agents: [
        {
          id: "main",
          name: "Main",
          emoji: "🤖",
          color: "#111111",
          model: "anthropic/claude-sonnet-4",
          status: "online",
          activeSessions: 1,
        },
      ],
      degraded: [
        {
          section: "sessions",
          code: "source_unavailable",
          retriable: true,
          message: "session source unavailable",
        },
      ],
    });

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => telemetry,
    });

    render(<DashboardClient initialTelemetry={telemetry} />);

    expect(
      await screen.findByText("Telemetry is stale (90s old)"),
    ).toBeInTheDocument();
    expect(
      await screen.findByText("Telemetry degraded in 1 section(s)"),
    ).toBeInTheDocument();
    expect(
      await screen.findByText("sessions: session source unavailable"),
    ).toBeInTheDocument();
  });

  it("renders legacy telemetry data from initial props", async () => {
    const telemetry = createMockTelemetry({
      summary: {
        totalActivities: 22,
        todayActivities: 3,
        successfulActivities: 2,
        failedActivities: 1,
      },
      agents: [
        {
          id: "legacy",
          name: "Legacy Agent",
          emoji: "🧪",
          color: "#123456",
          model: "anthropic/claude-haiku-4",
          status: "online",
          activeSessions: 1,
        },
      ],
    });

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => telemetry,
    });

    render(<DashboardClient initialTelemetry={telemetry} />);

    expect(
      await screen.findByText("Total Activities: 22"),
    ).toBeInTheDocument();
    expect(await screen.findByText("Legacy Agent")).toBeInTheDocument();
  });
});

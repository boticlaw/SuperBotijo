import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import DashboardPage from "./page";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/StatsCard", () => ({
  StatsCard: ({ title, value }: { title: string; value: string | number }) => (
    <div>{`${title}: ${value}`}</div>
  ),
}));

vi.mock("@/components/ActivityFeed", () => ({ ActivityFeed: () => <div>activity-feed</div> }));
vi.mock("@/components/WeatherWidget", () => ({ WeatherWidget: () => <div>weather-widget</div> }));
vi.mock("@/components/MoodWidget", () => ({ MoodWidget: () => <div>mood-widget</div> }));
vi.mock("@/components/SuggestionsPanel", () => ({ SuggestionsPanel: () => <div>suggestions-panel</div> }));
vi.mock("@/components/ErrorBoundary", () => ({ ErrorBoundary: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("@/components/PageHeader", () => ({
  PageHeader: ({ title, subtitle }: { title: string; subtitle: string }) => (
    <div>{`${title} - ${subtitle}`}</div>
  ),
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
        "dashboard.telemetry.degradedTitle": "Telemetry degraded in {count} section(s)",
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

      return template.replace(/\{(\w+)\}/g, (_, token: string) => String(values[token] ?? `{${token}}`));
      },
    };

    return () => i18n;
  })(),
}));

function createJsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("DashboardPage telemetry states", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_DASHBOARD_REAL_TELEMETRY", "true");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("renders telemetry-backed stats and agent cards", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() =>
        Promise.resolve(createJsonResponse({
          freshness: {
            snapshotAt: "2026-03-14T02:00:00.000Z",
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
        })),
      ),
    );

    render(<DashboardPage />);

    expect(await screen.findByText("Total Activities: 120")).toBeInTheDocument();
    expect(await screen.findByText("Main")).toBeInTheDocument();
    expect(screen.queryByText("Loading real telemetry...")).not.toBeInTheDocument();
  });

  it("renders empty state when telemetry has no agents", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() =>
        Promise.resolve(createJsonResponse({
          freshness: {
            snapshotAt: "2026-03-14T02:00:00.000Z",
            snapshotAgeSec: 5,
            stalenessThresholdSec: 30,
            status: "fresh",
          },
          summary: {
            totalActivities: 0,
            todayActivities: 0,
            successfulActivities: 0,
            failedActivities: 0,
          },
          agents: [],
          degraded: [],
        })),
      ),
    );

    render(<DashboardPage />);

    expect(await screen.findByText("No agents available from telemetry")).toBeInTheDocument();
  });

  it("renders stale and degraded indicators", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() =>
        Promise.resolve(createJsonResponse({
          freshness: {
            snapshotAt: "2026-03-14T02:00:00.000Z",
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
        })),
      ),
    );

    render(<DashboardPage />);

    expect(await screen.findByText("Telemetry is stale (90s old)")).toBeInTheDocument();
    expect(await screen.findByText("Telemetry degraded in 1 section(s)")).toBeInTheDocument();
    expect(await screen.findByText("sessions: session source unavailable")).toBeInTheDocument();
  });

  it("renders error and retries successfully", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce(
        createJsonResponse({
          freshness: {
            snapshotAt: "2026-03-14T02:00:00.000Z",
            snapshotAgeSec: 1,
            stalenessThresholdSec: 30,
            status: "fresh",
          },
          summary: {
            totalActivities: 1,
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
          degraded: [],
        }),
      );

    vi.stubGlobal("fetch", fetchMock);

    render(<DashboardPage />);

    expect(await screen.findByText("Unable to load real telemetry")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Retry" })[0]);

    await waitFor(() => {
      expect(screen.getByText("Main")).toBeInTheDocument();
    });
  });

  it("falls back to legacy dashboard endpoints when feature flag is disabled", async () => {
    vi.stubEnv("NEXT_PUBLIC_DASHBOARD_REAL_TELEMETRY", "false");

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        createJsonResponse({
          total: 22,
          today: 3,
          byStatus: {
            success: 2,
            error: 1,
          },
        }),
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          agents: [
            {
              id: "legacy",
              name: "Legacy Agent",
              emoji: "🧪",
              color: "#123456",
              model: "anthropic/claude-haiku-4",
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          agents: [
            {
              id: "legacy",
              name: "Legacy Agent",
              status: "online",
              activeSessions: 1,
            },
          ],
        }),
      );

    vi.stubGlobal("fetch", fetchMock);

    render(<DashboardPage />);

    expect(await screen.findByText("Total Activities: 22")).toBeInTheDocument();
    expect(await screen.findByText("Legacy Agent")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/activities/stats",
      expect.objectContaining({ cache: "no-store", signal: expect.any(AbortSignal) }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/agents",
      expect.objectContaining({ cache: "no-store", signal: expect.any(AbortSignal) }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/agents/status",
      expect.objectContaining({ cache: "no-store", signal: expect.any(AbortSignal) }),
    );
  });
});

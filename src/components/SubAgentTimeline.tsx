"use client";

import { CheckCircle, AlertCircle, Play, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface TimelineEvent {
  id: string;
  type: "spawned" | "completed" | "failed";
  timestamp: string;
  task: string;
  model: string;
  duration?: number;
}

interface SubAgentTimelineProps {
  events: TimelineEvent[];
}

function getEventIcon(type: string) {
  switch (type) {
    case "spawned":
      return { icon: Play, color: "var(--accent)" };
    case "completed":
      return { icon: CheckCircle, color: "var(--success)" };
    case "failed":
      return { icon: AlertCircle, color: "var(--error)" };
    default:
      return { icon: Clock, color: "var(--text-muted)" };
  }
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);

  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

export function SubAgentTimeline({ events }: SubAgentTimelineProps) {
  if (!events || events.length === 0) {
    return (
      <div
        className="p-6 rounded-xl text-center"
        style={{
          backgroundColor: "var(--card)",
          border: "1px solid var(--border)",
        }}
      >
        <Clock
          className="w-12 h-12 mx-auto mb-3"
          style={{ color: "var(--text-muted)" }}
        />
        <p style={{ color: "var(--text-secondary)" }}>
          No sub-agent activity in the last 24 hours
        </p>
      </div>
    );
  }

  return (
    <div
      className="p-6 rounded-xl"
      style={{
        backgroundColor: "var(--card)",
        border: "1px solid var(--border)",
      }}
    >
      <h3
        className="text-lg font-semibold mb-4"
        style={{ color: "var(--text-primary)" }}
      >
        Sub-Agent Timeline (Last 24h)
      </h3>

      <div className="space-y-3">
        {events.map((event) => {
          const { icon: Icon, color } = getEventIcon(event.type);

          return (
            <div
              key={event.id}
              className="flex items-start gap-3 p-3 rounded-lg transition-all hover:scale-[1.01]"
              style={{ backgroundColor: "var(--card-elevated)" }}
            >
              {/* Icon */}
              <div
                className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
                style={{ backgroundColor: `${color}20` }}
              >
                <Icon className="w-4 h-4" style={{ color }} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <h4
                    className="font-medium text-sm truncate"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {event.task}
                  </h4>
                  <span
                    className="text-xs flex-shrink-0 ml-2"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {formatDistanceToNow(new Date(event.timestamp), {
                      addSuffix: true,
                    })}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-xs">
                  <span style={{ color: "var(--text-secondary)" }}>
                    {event.model}
                  </span>
                  <span
                    className="capitalize px-2 py-0.5 rounded"
                    style={{
                      backgroundColor: `${color}20`,
                      color: color,
                    }}
                  >
                    {event.type}
                  </span>
                  {event.duration && (
                    <span style={{ color: "var(--text-muted)" }}>
                      {formatDuration(event.duration)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div
        className="mt-4 pt-4 text-xs"
        style={{ borderTop: "1px solid var(--border)", color: "var(--text-muted)" }}
      >
        <div className="flex items-center justify-between">
          <span>
            {events.length} events total
          </span>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Play className="w-3 h-3" style={{ color: "var(--accent)" }} />
              {events.filter(e => e.type === "spawned").length} spawned
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle className="w-3 h-3" style={{ color: "var(--success)" }} />
              {events.filter(e => e.type === "completed").length} completed
            </span>
            <span className="flex items-center gap-1">
              <AlertCircle className="w-3 h-3" style={{ color: "var(--error)" }} />
              {events.filter(e => e.type === "failed").length} failed
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

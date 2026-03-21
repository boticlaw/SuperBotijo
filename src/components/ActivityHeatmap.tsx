"use client";

import { useEffect, useState } from "react";
import { format, subDays, eachDayOfInterval, startOfWeek } from "date-fns";

interface HeatmapDay {
  day: string;
  count: number;
}

interface HeatmapStats {
  total: number;
  today: number;
  heatmap: HeatmapDay[];
  byType: Record<string, number>;
  byStatus: Record<string, number>;
  trend: Array<{ day: string; count: number; success: number; errors: number }>;
}

function getColor(count: number, max: number): string {
  if (count === 0) return "rgba(255,255,255,0.04)";
  const ratio = count / Math.max(max, 1);
  if (ratio < 0.25) return "rgba(255, 59, 48, 0.2)";
  if (ratio < 0.5) return "rgba(255, 59, 48, 0.4)";
  if (ratio < 0.75) return "rgba(255, 59, 48, 0.65)";
  return "rgba(255, 59, 48, 0.9)";
}

export function ActivityHeatmap() {
  const [stats, setStats] = useState<HeatmapStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [tooltip, setTooltip] = useState<{ day: string; count: number; x: number; y: number } | null>(null);

  useEffect(() => {
    fetch("/api/activities/stats")
      .then((r) => r.json())
      .then((data) => { setStats(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ padding: "1.5rem", backgroundColor: "var(--card)", borderRadius: "0.75rem", border: "1px solid var(--border)" }}>
        <div style={{ height: "100px", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: "0.875rem" }}>
          Loading heatmap...
        </div>
      </div>
    );
  }

  if (!stats) return null;

  // Build 52-week grid
  const today = new Date();
  const startDay = subDays(today, 364);
  
  // Pad to start from Sunday
  const firstDayOfWeek = startOfWeek(startDay, { weekStartsOn: 0 });
  const paddedDays = eachDayOfInterval({ start: firstDayOfWeek, end: today });

  // Map data
  const dayMap: Record<string, number> = {};
  for (const d of stats.heatmap) {
    dayMap[d.day] = d.count;
  }

  const maxCount = Math.max(...Object.values(dayMap), 1);

  // Group into weeks (columns)
  const weeks: Array<Array<{ date: Date; count: number }>> = [];
  let currentWeek: Array<{ date: Date; count: number }> = [];
  
  for (const day of paddedDays) {
    const key = format(day, "yyyy-MM-dd");
    currentWeek.push({ date: day, count: dayMap[key] || 0 });
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }
  if (currentWeek.length > 0) weeks.push(currentWeek);

  const totalActivities = Object.values(dayMap).reduce((a, b) => a + b, 0);
  const topTypes = Object.entries(stats.byType).sort(([, a], [, b]) => b - a).slice(0, 5);

  return (
    <div style={{ padding: "1.5rem", backgroundColor: "var(--card)", borderRadius: "0.75rem", border: "1px solid var(--border)" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
        <div>
          <h3 style={{ color: "var(--text-primary)", fontWeight: 600, fontSize: "1rem", marginBottom: "0.125rem" }}>
            Activity Timeline
          </h3>
          <p style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>
            {totalActivities} activities in the last 52 weeks · {stats.today} today
          </p>
        </div>

        {/* Status badges */}
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {stats.byStatus.success > 0 && (
            <span style={{ padding: "0.25rem 0.625rem", borderRadius: "9999px", fontSize: "0.75rem", backgroundColor: "rgba(74,222,128,0.1)", color: "#4ade80" }}>
              ✓ {stats.byStatus.success}
            </span>
          )}
          {stats.byStatus.error > 0 && (
            <span style={{ padding: "0.25rem 0.625rem", borderRadius: "9999px", fontSize: "0.75rem", backgroundColor: "rgba(248,113,113,0.1)", color: "#f87171" }}>
              ✗ {stats.byStatus.error}
            </span>
          )}
        </div>
      </div>

      {/* Heatmap grid */}
      <div style={{ overflowX: "auto", paddingBottom: "0.5rem" }}>
        <div style={{ display: "flex", gap: "3px", minWidth: "max-content" }}>
          {weeks.map((week, wi) => (
            <div key={wi} style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
              {week.map((day, di) => {
                const key = format(day.date, "yyyy-MM-dd");
                const isToday = key === format(today, "yyyy-MM-dd");
                const isFuture = day.date > today;

                return (
                  <div
                    key={di}
                    style={{
                      width: "11px", height: "11px",
                      borderRadius: "2px",
                      backgroundColor: isFuture ? "transparent" : getColor(day.count, maxCount),
                      border: isToday ? "1px solid var(--accent)" : "none",
                      cursor: day.count > 0 ? "pointer" : "default",
                      transition: "transform 0.1s",
                    }}
                    onMouseEnter={(e) => {
                      if (day.count > 0 || !isFuture) {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setTooltip({ day: key, count: day.count, x: rect.left, y: rect.top });
                      }
                      if (day.count > 0) (e.currentTarget as HTMLElement).style.transform = "scale(1.3)";
                    }}
                    onMouseLeave={(e) => {
                      setTooltip(null);
                      (e.currentTarget as HTMLElement).style.transform = "scale(1)";
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", marginTop: "0.75rem" }}>
        <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Less</span>
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
          <div key={ratio} style={{ width: "10px", height: "10px", borderRadius: "2px", backgroundColor: getColor(Math.round(ratio * maxCount), maxCount) }} />
        ))}
        <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>More</span>
      </div>

      {/* Top activity types */}
      {topTypes.length > 0 && (
        <div style={{ marginTop: "1.25rem", display: "flex", flexWrap: "wrap", gap: "0.625rem" }}>
          {topTypes.map(([type, count]) => (
            <div key={type} style={{ display: "flex", alignItems: "center", gap: "0.375rem", padding: "0.25rem 0.625rem", backgroundColor: "var(--card-elevated)", borderRadius: "9999px" }}>
              <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", textTransform: "capitalize" }}>{type}</span>
              <span style={{ fontSize: "0.75rem", color: "var(--accent)", fontWeight: 700 }}>{count}</span>
            </div>
          ))}
        </div>
      )}

      {/* Tooltip */}
      {tooltip && (
        <div style={{
          position: "fixed",
          top: tooltip.y - 40,
          left: tooltip.x,
          transform: "translateX(-50%)",
          backgroundColor: "var(--card-elevated)",
          border: "1px solid var(--border)",
          borderRadius: "0.5rem",
          padding: "0.375rem 0.75rem",
          fontSize: "0.75rem",
          color: "var(--text-primary)",
          pointerEvents: "none",
          zIndex: 100,
          whiteSpace: "nowrap",
          boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
        }}>
          <strong>{tooltip.count}</strong> activities on {tooltip.day}
        </div>
      )}
    </div>
  );
}

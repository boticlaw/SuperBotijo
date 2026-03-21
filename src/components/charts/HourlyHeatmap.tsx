"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Download, ExternalLink } from "lucide-react";

interface HourData {
  hour: number;
  day: number;
  count: number;
  successCount?: number;
  errorCount?: number;
  tokens?: number;
  types?: Record<string, number>;
}

interface HourlyHeatmapProps {
  data: HourData[];
  title?: string;
  showExport?: boolean;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

const THEME = {
  accent: "#FF3B30",
  border: "#2A2A2A",
  card: "#1A1A1A",
  textPrimary: "#FFFFFF",
  textSecondary: "#8A8A8A",
  textMuted: "#525252",
  success: "#10b981",
  error: "#ef4444",
};

function getIntensityStyle(count: number, max: number): React.CSSProperties {
  if (count === 0) {
    return { backgroundColor: THEME.border };
  }
  const intensity = count / max;
  const opacity = 0.2 + intensity * 0.8;
  return { backgroundColor: THEME.accent, opacity };
}

export function HourlyHeatmap({ 
  data, 
  title = "Activity Heatmap",
  showExport = true,
}: HourlyHeatmapProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{
    show: boolean;
    x: number;
    y: number;
    data: HourData | null;
    day: number;
    hour: number;
  }>({ show: false, x: 0, y: 0, data: null, day: 0, hour: 0 });
  const [selectedCell, setSelectedCell] = useState<{ day: number; hour: number } | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const dataMap = useMemo(() => {
    const map = new Map<string, HourData>();
    data.forEach((item) => {
      map.set(`${item.day}-${item.hour}`, item);
    });
    return map;
  }, [data]);

  const maxCount = Math.max(...data.map((d) => d.count), 1);

  const handleMouseEnter = useCallback(
    (e: React.MouseEvent, day: number, hour: number) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const cellData = dataMap.get(`${day}-${hour}`);
      setTooltip({
        show: true,
        x: rect.left + rect.width / 2,
        y: rect.top - 10,
        data: cellData || { day, hour, count: 0 },
        day,
        hour,
      });
    },
    [dataMap]
  );

  const handleMouseLeave = useCallback(() => {
    setTooltip((prev) => ({ ...prev, show: false }));
  }, []);

  const handleClick = useCallback(
    (day: number, hour: number) => {
      setSelectedCell({ day, hour });

      const now = new Date();
      const dayOfWeek = now.getDay();
      const daysToSubtract = (dayOfWeek - day + 7) % 7;
      const targetDate = new Date(now);
      targetDate.setDate(now.getDate() - daysToSubtract);
      targetDate.setHours(hour, 0, 0, 0);

      const dateStr = targetDate.toISOString().split("T")[0];
      const startHour = `${String(hour).padStart(2, "0")}:00`;
      const endHour = `${String(hour + 1).padStart(2, "0")}:00`;

      router.push(`/activity?date=${dateStr}&startTime=${startHour}&endTime=${endHour}`);
    },
    [router]
  );

  const handleExport = useCallback(async () => {
    if (!containerRef.current) return;

    setIsExporting(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(containerRef.current, {
        backgroundColor: "#0a0a0a",
        scale: 2,
      });

      const link = document.createElement("a");
      link.download = `heatmap-${new Date().toISOString().split("T")[0]}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (error) {
      console.error("Export failed:", error);
    } finally {
      setIsExporting(false);
    }
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 style={{ fontFamily: "var(--font-heading)", fontSize: "14px", fontWeight: 600, color: THEME.textPrimary }}>
          {title}
        </h3>
        {showExport && (
          <button
            onClick={handleExport}
            disabled={isExporting}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              padding: "4px 8px",
              backgroundColor: "transparent",
              border: `1px solid ${THEME.border}`,
              borderRadius: "4px",
              color: THEME.textSecondary,
              cursor: isExporting ? "wait" : "pointer",
              fontSize: "11px",
            }}
          >
            <Download size={12} />
            {isExporting ? "Exporting..." : "Export PNG"}
          </button>
        )}
      </div>

      <div ref={containerRef} className="relative p-4 rounded-lg" style={{ backgroundColor: THEME.card }}>
        <div className="flex ml-12 mb-1">
          {HOURS.filter((h) => h % 3 === 0).map((hour) => (
            <div
              key={hour}
              className="text-xs"
              style={{ width: "36px", color: THEME.textMuted }}
            >
              {hour}:00
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-1">
          {DAYS.map((day, dayIndex) => (
            <div key={day} className="flex items-center gap-1">
              <span
                className="w-10 text-xs text-right pr-2"
                style={{ color: THEME.textSecondary }}
              >
                {day}
              </span>
              <div className="flex gap-0.5">
                {HOURS.map((hour) => {
                  const cellData = dataMap.get(`${dayIndex}-${hour}`);
                  const count = cellData?.count || 0;
                  const isSelected = selectedCell?.day === dayIndex && selectedCell?.hour === hour;

                  return (
                    <div
                      key={hour}
                      className="w-3 h-3 rounded-sm cursor-pointer transition-all"
                      style={{
                        ...getIntensityStyle(count, maxCount),
                        transform: isSelected ? "scale(1.3)" : undefined,
                        boxShadow: isSelected ? `0 0 8px ${THEME.accent}` : undefined,
                      }}
                      onMouseEnter={(e) => handleMouseEnter(e, dayIndex, hour)}
                      onMouseLeave={handleMouseLeave}
                      onClick={() => handleClick(dayIndex, hour)}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: THEME.textMuted }}>Less</span>
            <div className="flex gap-0.5">
              {[0, 0.3, 0.5, 0.75, 1].map((opacity, i) => (
                <div
                  key={i}
                  className="w-3 h-3 rounded-sm"
                  style={{ 
                    backgroundColor: opacity === 0 ? THEME.border : THEME.accent,
                    opacity: opacity === 0 ? 1 : opacity 
                  }}
                />
              ))}
            </div>
            <span className="text-xs" style={{ color: THEME.textMuted }}>More</span>
          </div>

          <div className="text-xs" style={{ color: THEME.textMuted }}>
            Click to filter activities
          </div>
        </div>
      </div>

      {tooltip.show && tooltip.data && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: "translate(-50%, -100%)",
          }}
        >
          <div
            style={{
              backgroundColor: THEME.card,
              border: `1px solid ${THEME.accent}`,
              borderRadius: "8px",
              padding: "10px 14px",
              boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
              minWidth: "180px",
            }}
          >
            <div style={{ fontWeight: 600, color: THEME.textPrimary, marginBottom: "8px" }}>
              {DAYS[tooltip.day]} {String(tooltip.hour).padStart(2, "0")}:00
            </div>

            <div style={{ display: "grid", gap: "4px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
                <span style={{ color: THEME.textSecondary }}>Activities</span>
                <span style={{ color: THEME.textPrimary, fontWeight: 500 }}>{tooltip.data.count}</span>
              </div>

              {tooltip.data.successCount !== undefined && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
                  <span style={{ color: THEME.textSecondary }}>Success</span>
                  <span style={{ color: THEME.success }}>{tooltip.data.successCount}</span>
                </div>
              )}

              {tooltip.data.errorCount !== undefined && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
                  <span style={{ color: THEME.textSecondary }}>Errors</span>
                  <span style={{ color: THEME.error }}>{tooltip.data.errorCount}</span>
                </div>
              )}

              {tooltip.data.tokens !== undefined && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
                  <span style={{ color: THEME.textSecondary }}>Tokens</span>
                  <span style={{ color: THEME.textPrimary }}>{tooltip.data.tokens.toLocaleString()}</span>
                </div>
              )}
            </div>

            <div
              style={{
                marginTop: "8px",
                paddingTop: "8px",
                borderTop: `1px solid ${THEME.border}`,
                fontSize: "10px",
                color: THEME.textMuted,
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <ExternalLink size={10} />
              Click to view details
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * MetricCard Component
 * Based on Component/MetricCard from tenacios-design.json
 */

import { LucideIcon } from "lucide-react";

interface MetricCardProps {
  icon: LucideIcon;
  value: string | number;
  label: string;
  change?: string;
  changeColor?: "positive" | "negative" | "warning" | "secondary";
}

export function MetricCard({
  icon: Icon,
  value,
  label,
  change,
  changeColor = "positive",
}: MetricCardProps) {
  const changeColorMap = {
    positive: "var(--positive)",
    negative: "var(--negative)",
    warning: "var(--warning)",
    secondary: "var(--text-secondary)",
  };

  return (
    <div
      style={{
        backgroundColor: "var(--surface)",
        borderRadius: "12px",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
      }}
    >
      {/* Top Row: Icon + Change */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Icon
          style={{
            width: "20px",
            height: "20px",
            color: "var(--text-muted)",
          }}
        />
        {change && (
          <span
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "11px",
              fontWeight: 600,
              color: changeColorMap[changeColor],
            }}
          >
            {change}
          </span>
        )}
      </div>

      {/* Metric Value */}
      <div
        style={{
          fontFamily: "var(--font-heading)",
          fontSize: "28px",
          fontWeight: 700,
          letterSpacing: "-1.5px",
          color: "var(--text-primary)",
        }}
      >
        {value}
      </div>

      {/* Metric Label */}
      <div
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "12px",
          fontWeight: 500,
          color: "var(--text-secondary)",
        }}
      >
        {label}
      </div>
    </div>
  );
}

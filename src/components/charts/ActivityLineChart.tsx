"use client";

import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

interface DayData {
  date: string;
  count: number;
}

interface ActivityLineChartProps {
  data: DayData[];
}

// CSS variable values for Recharts (doesn't support CSS vars directly)
const COLORS = {
  accent: "#FF3B30",
  border: "#2A2A2A",
  card: "#1A1A1A",
  textSecondary: "#8A8A8A",
  textPrimary: "#FFFFFF",
};

export function ActivityLineChart({ data }: ActivityLineChartProps) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COLORS.accent} stopOpacity={1} />
              <stop offset="100%" stopColor={COLORS.accent} stopOpacity={0.4} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} vertical={false} />
          <XAxis
            dataKey="date"
            stroke={COLORS.textSecondary}
            fontSize={12}
            tickLine={false}
            axisLine={{ stroke: COLORS.border }}
          />
          <YAxis
            stroke={COLORS.textSecondary}
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: COLORS.card,
              border: `1px solid ${COLORS.border}`,
              borderRadius: "8px",
              color: COLORS.textPrimary,
            }}
            labelStyle={{ color: COLORS.textSecondary }}
            formatter={(value: number) => [`${value} activities`, "Count"]}
            cursor={{ fill: "rgba(255, 59, 48, 0.1)" }}
          />
          <Bar
            dataKey="count"
            fill="url(#barGradient)"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

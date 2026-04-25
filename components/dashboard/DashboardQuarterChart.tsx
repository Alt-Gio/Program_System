"use client";

// Isolated so the large `recharts` bundle can be split out of the
// dashboard's initial JS. Imported via next/dynamic from the dashboard.
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type Point = { quarter: string; count: number };

export default function DashboardQuarterChart({ data }: { data: Point[] }) {
  return (
    <ResponsiveContainer width="100%" height={150}>
      <BarChart data={data} barSize={28}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="#f0f0f0"
          vertical={false}
        />
        <XAxis
          dataKey="quarter"
          tick={{ fontSize: 10 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 10 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{
            fontSize: 12,
            borderRadius: 8,
            border: "1px solid #e5e7eb",
          }}
          cursor={{ fill: "#f9fafb" }}
        />
        <Bar
          dataKey="count"
          name="Activities"
          fill="#2563eb"
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

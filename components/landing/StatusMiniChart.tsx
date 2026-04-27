"use client";

// Extracted from app/page.tsx so the recharts dependency
// can be code-split out of the public landing page's initial bundle.
// Loaded via next/dynamic({ ssr: false }) — keeps recharts (~120 KB)
// off the first paint of the public site.

import {
  BarChart,
  Bar,
  XAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export type StatusPoint = { name: string; count: number };

type Props = {
  data: StatusPoint[];
  fill: string;
  dark: boolean;
};

export default function StatusMiniChart({ data, fill, dark }: Props) {
  return (
    <ResponsiveContainer width="100%" height={60}>
      <BarChart data={data} barSize={10}>
        <Bar dataKey="count" fill={fill} radius={[2, 2, 0, 0]} />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 7, fill: dark ? "#ffffff60" : "#6b7280" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{
            fontSize: 10,
            background: dark ? "#1a1a2e" : "#fff",
            border: "none",
            borderRadius: 6,
          }}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

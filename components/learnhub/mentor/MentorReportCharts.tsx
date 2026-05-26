"use client";

// Extracted from app/learnhub/(lh-main)/mentor/report/page.tsx so the
// recharts dependency can be code-split out of that page's initial bundle.
// Loaded via next/dynamic({ ssr: false }) — page shell paints first, charts
// hydrate after.

import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";

// ── Shared tooltip ──
const ChartTooltip = ({
  active, payload, label,
}: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "var(--lh-card-2)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "8px 14px" }}>
      {label && <p style={{ color: "var(--lh-text-2)", fontSize: 11, margin: 0 }}>{label}</p>}
      <p style={{ color: "#fff", fontSize: 14, fontWeight: 700, margin: 0 }}>{payload[0].value}</p>
    </div>
  );
};

const PIE_COLORS = ["#5b6cff", "#22d3a0", "#ff8c42", "#fbbf24", "#a78bfa"];
const PROVINCE_COLORS = ["#5b6cff", "#22d3a0", "#ff8c42", "#fbbf24", "#a78bfa", "#f472b6"];

// ── Modality donut ──
export function ModalityPieChart({ data }: { data: Array<{ name: string; value: number }> }) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value">
          {data.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
        </Pie>
        <Tooltip content={<ChartTooltip />} />
        <Legend formatter={(v) => <span style={{ color: "var(--lh-text-2)", fontSize: 12 }}>{v}</span>} />
      </PieChart>
    </ResponsiveContainer>
  );
}

// ── Province bar chart ──
export function ProvinceBarChart({
  data, abbrMap,
}: {
  data: Array<{ province: string; count: number }>;
  abbrMap: Record<string, string>;
}) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} barSize={22}>
        <XAxis dataKey="province" tick={{ fill: "var(--lh-text-2)", fontSize: 10 }} tickFormatter={(v) => abbrMap[v] ?? v} />
        <YAxis tick={{ fill: "var(--lh-text-2)", fontSize: 10 }} />
        <Tooltip content={<ChartTooltip />} />
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={PROVINCE_COLORS[i % PROVINCE_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Sector pie ──
export function SectorPieChart({ data }: { data: Array<{ name: string; value: number }> }) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" outerRadius={70} paddingAngle={3} dataKey="value">
          {data.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
        </Pie>
        <Tooltip content={<ChartTooltip />} />
        <Legend formatter={(v) => <span style={{ color: "var(--lh-text-2)", fontSize: 11 }}>{v}</span>} />
      </PieChart>
    </ResponsiveContainer>
  );
}

// ── Category horizontal bar chart ──
export function CategoryBarChart({ data }: { data: Array<{ category: string; count: number }> }) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} layout="vertical" barSize={16}>
        <XAxis type="number" tick={{ fill: "var(--lh-text-2)", fontSize: 10 }} />
        <YAxis type="category" dataKey="category" tick={{ fill: "var(--lh-text-2)", fontSize: 10 }} width={100} />
        <Tooltip content={<ChartTooltip />} />
        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
          {data.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

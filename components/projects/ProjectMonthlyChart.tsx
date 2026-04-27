"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

export type MonthlyPoint = {
  name: string;
  count: number;
  monthNum: number;
};

type Props = {
  data: MonthlyPoint[];
  highlightColor: string;
  selectedMonth: number | null;
  selectedQuarter: number | null;
  quarterMonthsMap: Record<number, number[]>;
  onBarClick: (monthNum: number) => void;
};

// Extracted from app/(main)/projects/[code]/page.tsx so the recharts
// dependency can be code-split out of the project page's initial bundle.
export default function ProjectMonthlyChart({
  data,
  highlightColor,
  selectedMonth,
  selectedQuarter,
  quarterMonthsMap,
  onBarClick,
}: Props) {
  return (
    <ResponsiveContainer width="100%" height={190}>
      <BarChart
        data={data}
        barSize={13}
        margin={{ left: -14, right: 4 }}
        onClick={(d: any) => {
          if (!d?.activePayload?.[0]) return;
          const mn = (d.activePayload[0].payload as MonthlyPoint).monthNum;
          onBarClick(mn);
        }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="#f0f0f0"
          vertical={false}
        />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 9 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 9 }}
          axisLine={false}
          tickLine={false}
          width={26}
        />
        <Tooltip
          contentStyle={{ fontSize: 11, borderRadius: 8 }}
          cursor={{ fill: "#f3f4f6" }}
        />
        <Bar
          dataKey="count"
          name="Activities"
          radius={[3, 3, 0, 0]}
          cursor="pointer"
        >
          {data.map((entry) => {
            const isHighlighted =
              (selectedMonth === null && selectedQuarter === null) ||
              selectedMonth === entry.monthNum ||
              (selectedQuarter !== null &&
                quarterMonthsMap[selectedQuarter]?.includes(entry.monthNum));
            return (
              <Cell
                key={`cell-${entry.monthNum}`}
                fill={isHighlighted ? highlightColor : `${highlightColor}28`}
              />
            );
          })}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

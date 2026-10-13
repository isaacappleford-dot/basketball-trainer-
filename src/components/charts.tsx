"use client";

import type { ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export const SERIES = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)"];

const compact = (v: number) => (Math.abs(v) >= 1000 ? `${Math.round(v / 100) / 10}k` : String(v));
const axisProps = { tickLine: false, axisLine: false, tick: { fontSize: 11 } } as const;
const tooltipProps = {
  cursor: { fill: "var(--surface-3)", opacity: 0.5 },
  contentStyle: { background: "var(--surface-2)", border: "1px solid var(--line-strong)", borderRadius: 10, fontSize: 12, color: "var(--text)" },
  labelStyle: { color: "var(--muted)", marginBottom: 4 },
  itemStyle: { color: "var(--text)", padding: 0 },
};

export function ChartBox({ height = 220, children, label }: { height?: number; children: ReactNode; label: string }) {
  return (
    <figure role="img" aria-label={label} className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        {children as React.ReactElement}
      </ResponsiveContainer>
    </figure>
  );
}

export interface BarSeries {
  key: string;
  name: string;
  color?: string;
}

export function SimpleBarChart<T extends object>({
  data,
  xKey,
  series,
  height,
  label,
  stacked,
  goal,
  onBarClick,
  valueSuffix = "",
}: {
  data: T[];
  xKey: string;
  series: BarSeries[];
  height?: number;
  label: string;
  stacked?: boolean;
  goal?: number;
  onBarClick?: (row: T) => void;
  valueSuffix?: string;
}) {
  return (
    <ChartBox height={height} label={label}>
      <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -16 }} barCategoryGap="28%">
        <CartesianGrid vertical={false} strokeDasharray="0" />
        <XAxis dataKey={xKey} {...axisProps} />
        <YAxis allowDecimals={false} {...axisProps} width={44} tickFormatter={compact} />
        <Tooltip {...tooltipProps} formatter={(v) => `${v}${valueSuffix}`} />
        {series.length > 1 && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: "var(--muted)" }} />}
        {goal !== undefined && <ReferenceLine y={goal} stroke="var(--subtle)" strokeDasharray="4 4" label={{ value: `Goal ${goal}`, position: "insideTopRight", fontSize: 11, fill: "var(--muted)" }} />}
        {series.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.name}
            stackId={stacked ? "a" : undefined}
            fill={s.color ?? SERIES[i % SERIES.length]}
            stroke="var(--surface)"
            strokeWidth={stacked ? 2 : 0}
            radius={stacked ? (i === series.length - 1 ? [4, 4, 0, 0] : 0) : [4, 4, 0, 0]}
            maxBarSize={36}
            isAnimationActive={false}
            cursor={onBarClick ? "pointer" : undefined}
            onClick={onBarClick ? (d) => onBarClick((d as unknown as { payload: T }).payload) : undefined}
          />
        ))}
      </BarChart>
    </ChartBox>
  );
}

export function SimpleLineChart<T extends object>({
  data,
  xKey,
  series,
  height,
  label,
  onPointClick,
  domain,
  valueSuffix = "",
}: {
  data: T[];
  xKey: string;
  series: BarSeries[];
  height?: number;
  label: string;
  onPointClick?: (row: T) => void;
  domain?: [number | "auto" | "dataMin" | "dataMax", number | "auto" | "dataMin" | "dataMax"];
  valueSuffix?: string;
}) {
  return (
    <ChartBox height={height} label={label}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey={xKey} {...axisProps} />
        <YAxis {...axisProps} width={48} domain={domain ?? ["auto", "auto"]} tickFormatter={compact} />
        <Tooltip {...tooltipProps} cursor={{ stroke: "var(--line-strong)" }} formatter={(v) => `${v}${valueSuffix}`} />
        {series.length > 1 && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: "var(--muted)" }} />}
        {series.map((s, i) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.name}
            stroke={s.color ?? SERIES[i % SERIES.length]}
            strokeWidth={2}
            connectNulls
            isAnimationActive={false}
            dot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)", fill: s.color ?? SERIES[i % SERIES.length] }}
            activeDot={{
              r: 6,
              stroke: "var(--surface)",
              strokeWidth: 2,
              cursor: onPointClick ? "pointer" : undefined,
              onClick: onPointClick ? (_e: unknown, p: unknown) => onPointClick((p as { payload: T }).payload) : undefined,
            }}
          />
        ))}
      </LineChart>
    </ChartBox>
  );
}

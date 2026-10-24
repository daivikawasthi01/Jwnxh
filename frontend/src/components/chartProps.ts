import type { ChartColors } from "../hooks/useChartColors";

/** Shared, recessive axis/grid styling. */
export function axisProps(c: ChartColors) {
  return {
    stroke: c.axis,
    tick: { fill: c.axis, fontSize: 11, fontFamily: "Geist Mono, ui-monospace, monospace" },
    tickLine: false,
    axisLine: false,
  } as const;
}

export function gridProps(c: ChartColors) {
  return { stroke: c.grid, vertical: false, strokeDasharray: "0" } as const;
}

export const compactMW = (v: number) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k` : `${v}`);

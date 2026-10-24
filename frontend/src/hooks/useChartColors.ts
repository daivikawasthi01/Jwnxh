import { useEffect, useState } from "react";

export interface ChartColors {
  fg: string;
  forecast: string;
  band: string;
  grid: string;
  axis: string;
  muted: string;
  surface: string;
  bar: string;
}

const DARK: ChartColors = {
  fg: "#ededed",
  forecast: "#888888",
  band: "#a1a1a1",
  grid: "#1f1f1f",
  axis: "#666666",
  muted: "#a1a1a1",
  surface: "#000000",
  bar: "#a1a1a1",
};

const LIGHT: ChartColors = {
  fg: "#000000",
  forecast: "#888888",
  band: "#666666",
  grid: "#f0f0f0",
  axis: "#888888",
  muted: "#666666",
  surface: "#ffffff",
  bar: "#666666",
};

const mq = () => window.matchMedia("(prefers-color-scheme: dark)");

/** Recharts takes literal colours; resolve them from the active colour scheme. */
export function useChartColors(): ChartColors {
  const [dark, setDark] = useState(() => mq().matches);
  useEffect(() => {
    const m = mq();
    const on = (e: MediaQueryListEvent) => setDark(e.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return dark ? DARK : LIGHT;
}

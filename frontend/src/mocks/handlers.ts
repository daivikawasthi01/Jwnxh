// Synthetic, deterministic fixtures. Used ONLY when VITE_USE_MOCKS === "true".
import type {
  ActualPoint,
  DayAheadPoint,
  DayAheadResponse,
  HorizonCurvePoint,
  HorizonPoint,
  HourlyPoint,
  Meta,
  Metrics,
} from "../types";

const H = 3600_000;
const D = 24 * H;
const T0 = Date.UTC(2026, 0, 1);
const JAN_START = Date.UTC(2026, 0, 1);
const JAN_END = Date.UTC(2026, 1, 2);
const PUBLISH = ["02:30", "04:30", "07:30", "09:30", "11:30", "15:30", "18:30", "22:30"];

function hash(...xs: number[]): number {
  let h = 2166136261;
  for (const x of xs) {
    h ^= Math.floor(x / 60000);
    h = Math.imul(h, 16777619);
    h ^= h >>> 13;
  }
  return ((h >>> 0) % 100000) / 100000 - 0.5; // [-0.5, 0.5)
}

function actualAt(t: number): number {
  const d = (t - T0) / D;
  const v =
    12500 +
    6000 * Math.sin((2 * Math.PI * d) / 5.3) +
    2500 * Math.sin((2 * Math.PI * d) / 1.7 + 1) +
    700 * Math.sin(2 * Math.PI * d - 1.2) +
    300 * hash(t);
  return Math.round(Math.max(600, Math.min(21500, v)));
}

const publishTimes: number[] = (() => {
  const out: number[] = [];
  for (let day = Date.UTC(2025, 11, 30); day <= Date.UTC(2026, 0, 31); day += D)
    for (const p of PUBLISH) {
      const [hh, mm] = p.split(":").map(Number);
      out.push(day + hh * H + mm * 60000);
    }
  return out;
})();

function forecastAt(p: number, t: number): number {
  const h = (t - p) / H;
  const runBias = hash(p, 7) * 2400 * (h / 48 + 0.15);
  const drift = 1800 * (h / 48) * Math.sin((t - T0) / (0.9 * D) + hash(p) * 6);
  const noise = (120 + 25 * h) * hash(p, t) * 2;
  return Math.round(Math.max(0, actualAt(t) + runBias + drift + noise + 150));
}

function latestPublish(limit: number): number | null {
  let best: number | null = null;
  for (const p of publishTimes) if (p <= limit) best = p;
  return best;
}

const actualExists = (t: number) => t >= JAN_START && t <= Date.UTC(2026, 1, 1, 23, 30);

function range(params: Record<string, string | number | undefined>) {
  const s = params.start ? Date.parse(String(params.start)) : JAN_START;
  const e = params.end ? Date.parse(String(params.end)) : JAN_END;
  return [s, e] as const;
}

function horizonPoints(s: number, e: number, hz: number): HorizonPoint[] {
  const out: HorizonPoint[] = [];
  for (let t = Math.ceil(s / H) * H; t < e; t += H) {
    const p = latestPublish(t - hz * H);
    if (p == null || t - p > 48 * H) continue;
    const forecast = forecastAt(p, t);
    const actual = actualExists(t) ? actualAt(t) : null;
    out.push({
      startTime: new Date(t).toISOString().replace(".000", ""),
      publishTime: new Date(p).toISOString().replace(".000", ""),
      horizon_h: (t - p) / H,
      forecast,
      actual,
      error: actual == null ? null : forecast - actual,
    });
  }
  return out;
}

function quantile(sorted: number[], q: number): number | null {
  if (!sorted.length) return null;
  const i = (sorted.length - 1) * q;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}

function metricsFrom(points: HorizonPoint[]): Metrics {
  const m = points.filter((p) => p.error != null) as (HorizonPoint & { error: number; actual: number })[];
  const errs = m.map((p) => p.error);
  const abs = errs.map(Math.abs).sort((a, b) => a - b);
  const sorted = [...errs].sort((a, b) => a - b);
  const n = errs.length;
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const mae = mean(abs);
  const meanActual = mean(m.map((p) => p.actual));
  const mapeSet = m.filter((p) => p.actual >= 1000).map((p) => (Math.abs(p.error) / p.actual) * 100);
  const bins = new Map<number, number>();
  for (const e of errs) {
    const b = Math.floor(e / 500) * 500;
    bins.set(b, (bins.get(b) ?? 0) + 1);
  }
  const histogram = [...bins.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([b, count]) => ({ bin_start: b, bin_end: b + 500, count }));
  return {
    n,
    mae,
    rmse: n ? Math.sqrt(errs.reduce((a, e) => a + e * e, 0) / n) : null,
    bias: mean(errs),
    mape: mean(mapeSet),
    p50_abs_error: quantile(abs, 0.5),
    p90_abs_error: quantile(abs, 0.9),
    p99_abs_error: quantile(abs, 0.99),
    error_quantiles: { p10: quantile(sorted, 0.1), p50: quantile(sorted, 0.5), p90: quantile(sorted, 0.9) },
    mean_actual: meanActual,
    nmae_pct: mae != null && meanActual ? (mae / meanActual) * 100 : null,
    histogram,
  };
}

const deliveryDates = (() => {
  const out: string[] = [];
  for (let t = Date.UTC(2026, 0, 2); t <= Date.UTC(2026, 1, 1); t += D) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
})();

function dayAheadRun(date: string, cutoff: string) {
  const d0 = Date.parse(`${date}T00:00:00Z`);
  const [hh, mm] = cutoff.split(":").map(Number);
  const cut = d0 - D + hh * H + mm * 60000;
  const p = latestPublish(cut)!;
  return { d0, cut, p };
}

function dayAheadErrors(cutoff: string, exclude: string): number[] {
  const errs: number[] = [];
  for (const date of deliveryDates) {
    if (date === exclude) continue;
    const { d0, p } = dayAheadRun(date, cutoff);
    for (let i = 0; i < 24; i++) {
      const t = d0 + i * H;
      if (actualExists(t)) errs.push(forecastAt(p, t) - actualAt(t));
    }
  }
  return errs.sort((a, b) => a - b);
}

const iso = (t: number) => new Date(t).toISOString().replace(".000", "");

function dayAhead(date: string, cutoff: string): DayAheadResponse {
  if (!deliveryDates.includes(date)) throw new Error("404 Unknown delivery date");
  const { d0, cut, p } = dayAheadRun(date, cutoff);
  const errs = dayAheadErrors(cutoff, date);
  const q10 = quantile(errs, 0.1) ?? 0;
  const q90 = quantile(errs, 0.9) ?? 0;
  const points: DayAheadPoint[] = [];
  for (let i = 0; i < 24; i++) {
    const t = d0 + i * H;
    const forecast = forecastAt(p, t);
    const actual = actualExists(t) ? actualAt(t) : null;
    points.push({
      startTime: iso(t),
      horizon_h: (t - p) / H,
      forecast,
      actual,
      error: actual == null ? null : forecast - actual,
      p10: Math.max(0, forecast - q90),
      p90: forecast - q10,
    });
  }
  const sum = (f: (x: DayAheadPoint) => number) => points.reduce((a, x) => a + f(x), 0);
  const hasActual = points.every((x) => x.actual != null);
  return {
    delivery_date: date,
    cutoff: iso(cut),
    publishTime: iso(p),
    points,
    summary: {
      forecast_energy_mwh: sum((x) => x.forecast),
      actual_energy_mwh: hasActual ? sum((x) => x.actual!) : null,
      p10_energy_mwh: sum((x) => x.p10),
      p90_energy_mwh: sum((x) => x.p90),
      peak_forecast_mw: Math.max(...points.map((x) => x.forecast)),
      min_forecast_mw: Math.min(...points.map((x) => x.forecast)),
      mae_mw: hasActual ? sum((x) => Math.abs(x.error!)) / 24 : null,
      bias_mw: hasActual ? sum((x) => x.error!) / 24 : null,
    },
  };
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function mockGet(path: string, params: Record<string, string | number | undefined>): Promise<unknown> {
  await delay(120);
  const [s, e] = range(params);
  const hz = params.horizon_h != null ? Number(params.horizon_h) : 4;
  switch (path) {
    case "/health":
      return { status: "ok" };
    case "/meta":
      return {
        actuals_range: { start: "2026-01-01T00:00:00Z", end: "2026-02-01T23:30:00Z" },
        forecast_publish_range: { start: "2025-12-30T02:30:00Z", end: "2026-01-31T22:30:00Z" },
        delivery_dates: deliveryDates,
        publish_times_utc: PUBLISH,
        default_cutoff: "09:00",
        max_horizon_h: 48,
      } satisfies Meta;
    case "/actuals": {
      const out: ActualPoint[] = [];
      for (let t = Math.ceil(s / (H / 2)) * (H / 2); t < e; t += H / 2)
        if (actualExists(t)) out.push({ startTime: iso(t), generation: actualAt(t) });
      return out;
    }
    case "/forecasts/horizon":
      return horizonPoints(s, e, hz);
    case "/forecasts/day-ahead":
      return dayAhead(String(params.delivery_date), String(params.cutoff ?? "09:00"));
    case "/metrics":
      return metricsFrom(horizonPoints(s, e, hz));
    case "/metrics/horizon-curve": {
      const out: HorizonCurvePoint[] = [];
      for (let h = 0; h <= 48; h++) {
        const m = metricsFrom(horizonPoints(s, e, h));
        out.push({ horizon_h: h, n: m.n, mae: m.mae, rmse: m.rmse, bias: m.bias, p90_abs_error: m.p90_abs_error });
      }
      return out;
    }
    case "/metrics/hourly": {
      const pts = horizonPoints(s, e, hz);
      return Array.from({ length: 24 }, (_, hour): HourlyPoint => {
        const m = metricsFrom(pts.filter((p) => new Date(p.startTime).getUTCHours() === hour));
        return { hour, n: m.n, mae: m.mae, bias: m.bias };
      });
    }
  }
  throw new Error(`404 No mock for ${path}`);
}

import type {
  ActualPoint,
  DayAheadResponse,
  HorizonCurvePoint,
  HorizonPoint,
  HourlyPoint,
  Meta,
  Metrics,
} from "./types";

const BASE = "/api";
const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === "true";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

type Params = Record<string, string | number | undefined>;

function query(params: Params = {}): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") q.set(k, String(v));
  const s = q.toString();
  return s ? `?${s}` : "";
}

async function get<T>(path: string, params?: Params, signal?: AbortSignal): Promise<T> {
  if (USE_MOCKS) {
    const { mockGet } = await import("./mocks/handlers");
    return mockGet(path, params ?? {}) as Promise<T>;
  }
  const res = await fetch(`${BASE}${path}${query(params)}`, { signal, headers: { Accept: "application/json" } });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      if (body?.detail) detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, `${res.status} ${detail}`);
  }
  return res.json() as Promise<T>;
}

export interface RangeParams {
  start?: string;
  end?: string;
}

export const api = {
  meta: (s?: AbortSignal) => get<Meta>("/meta", undefined, s),
  actuals: (p: RangeParams, s?: AbortSignal) => get<ActualPoint[]>("/actuals", { ...p }, s),
  forecastsHorizon: (p: RangeParams & { horizon_h: number }, s?: AbortSignal) =>
    get<HorizonPoint[]>("/forecasts/horizon", { ...p }, s),
  dayAhead: (p: { delivery_date: string; cutoff: string }, s?: AbortSignal) =>
    get<DayAheadResponse>("/forecasts/day-ahead", { ...p }, s),
  metrics: (p: RangeParams & { horizon_h: number }, s?: AbortSignal) => get<Metrics>("/metrics", { ...p }, s),
  horizonCurve: (p: RangeParams, s?: AbortSignal) =>
    get<HorizonCurvePoint[]>("/metrics/horizon-curve", { ...p }, s),
  hourly: (p: RangeParams & { horizon_h: number }, s?: AbortSignal) =>
    get<HourlyPoint[]>("/metrics/hourly", { ...p }, s),
};

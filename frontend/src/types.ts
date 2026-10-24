// Mirrors docs/api-contract.md (v1). Times are ISO-8601 UTC strings with "Z".

export interface Meta {
  actuals_range: { start: string; end: string };
  forecast_publish_range: { start: string; end: string };
  delivery_dates: string[];
  publish_times_utc: string[];
  default_cutoff: string;
  max_horizon_h: number;
}

export interface ActualPoint {
  startTime: string;
  generation: number;
}

export interface HorizonPoint {
  startTime: string;
  publishTime: string;
  horizon_h: number;
  forecast: number;
  actual: number | null;
  error: number | null;
}

export interface DayAheadPoint {
  startTime: string;
  horizon_h: number;
  forecast: number;
  actual: number | null;
  error: number | null;
  p10: number;
  p90: number;
}

export interface DayAheadSummary {
  forecast_energy_mwh: number;
  actual_energy_mwh: number | null;
  p10_energy_mwh: number;
  p90_energy_mwh: number;
  peak_forecast_mw: number;
  min_forecast_mw: number;
  mae_mw: number | null;
  bias_mw: number | null;
}

export interface DayAheadResponse {
  delivery_date: string;
  cutoff: string;
  publishTime: string;
  points: DayAheadPoint[];
  summary: DayAheadSummary;
}

export interface HistogramBin {
  bin_start: number;
  bin_end: number;
  count: number;
}

export interface Metrics {
  n: number;
  mae: number | null;
  rmse: number | null;
  bias: number | null;
  mape: number | null;
  p50_abs_error: number | null;
  p90_abs_error: number | null;
  p99_abs_error: number | null;
  error_quantiles: { p10: number | null; p50: number | null; p90: number | null };
  mean_actual: number | null;
  nmae_pct: number | null;
  histogram: HistogramBin[];
}

export interface HorizonCurvePoint {
  horizon_h: number;
  n: number;
  mae: number | null;
  rmse: number | null;
  bias: number | null;
  p90_abs_error: number | null;
}

export interface HourlyPoint {
  hour: number;
  n: number;
  mae: number | null;
  bias: number | null;
}

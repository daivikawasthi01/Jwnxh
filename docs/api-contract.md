# API contract (v1)

This is the shared interface between the backend (FastAPI) and the frontend (React).

**Conventions**
- All times are ISO-8601 UTC strings with a `Z` suffix, e.g. `2026-01-15T09:00:00Z`.
- January is GMT, so UK local time equals UTC.
- All power values are in MW, as averages over the interval. Energy values are in MWh.
- All routes are prefixed with `/api`.

**Data**
- `backend/data/actuals.json`: `[{startTime, generation}]`, half-hourly FUELHH WIND readings for settlement dates 2026-01-01 to 2026-02-01.
- `backend/data/forecasts.json`: `[{publishTime, startTime, generation}]`, hourly WINDFOR rows published 2025-12-30 to 2026-02-01.

**Definitions**
- `horizon_h = (startTime - publishTime)` in hours. Only forecasts with `0 <= horizon_h <= 48` are used.
- `error = forecast - actual` (MW). A positive error means wind was over-forecast, so the team under-buys.
- Forecasts are matched to actuals only at hourly startTimes (the `:00` actual).
- **Horizon selection:** for target time `t` and horizon `H`, use the forecast with the largest `publishTime` such that `publishTime <= t - H`, with `t - publishTime <= 48h`.
- **Day-ahead selection:** for delivery date `D` and cutoff `HH:MM`, use the single latest forecast run with `publishTime <= (D-1)THH:MM:00Z`. All 24 hourly points of `D` are taken from that run.

## Endpoints

### `GET /api/health`
`{"status": "ok"}`

### `GET /api/meta`
```json
{
  "actuals_range": {"start": "2026-01-01T00:00:00Z", "end": "2026-02-01T23:30:00Z"},
  "forecast_publish_range": {"start": "2025-12-30T02:30:00Z", "end": "2026-01-31T22:30:00Z"},
  "delivery_dates": ["2026-01-02", "...", "2026-02-01"],
  "publish_times_utc": ["02:30","04:30","07:30","09:30","11:30","15:30","18:30","22:30"],
  "default_cutoff": "09:00",
  "max_horizon_h": 48
}
```
`delivery_dates` lists the days whose decision is made in January (D−1 falls in Jan 2026).

### `GET /api/actuals?start=ISO&end=ISO`
`[{"startTime": "...", "generation": 12345}]` (half-hourly, `start <= startTime < end`)

### `GET /api/forecasts/horizon?start=ISO&end=ISO&horizon_h=4`
```json
[{"startTime": "...", "publishTime": "...", "horizon_h": 4.5, "forecast": 12000, "actual": 11800, "error": 200}]
```
Hourly. `actual` and `error` are `null` when no actual exists. `horizon_h` defaults to 4 and must be between 0 and 48.

### `GET /api/forecasts/day-ahead?delivery_date=2026-01-15&cutoff=09:00`
```json
{
  "delivery_date": "2026-01-15",
  "cutoff": "2026-01-14T09:00:00Z",
  "publishTime": "2026-01-14T07:30:00Z",
  "points": [
    {"startTime": "2026-01-15T00:00:00Z", "horizon_h": 16.5, "forecast": 12000,
     "actual": 11800, "error": 200, "p10": 10500, "p90": 13200}
  ],
  "summary": {
    "forecast_energy_mwh": 288000,
    "actual_energy_mwh": 280000,
    "p10_energy_mwh": 260000,
    "p90_energy_mwh": 305000,
    "peak_forecast_mw": 15000,
    "min_forecast_mw": 8000,
    "mae_mw": 900,
    "bias_mw": 150
  }
}
```
- `p10` and `p90` form a plausible band for the *actual*, given the forecast: `forecast - q90(error)` and `forecast - q10(error)`.
- The error quantiles are taken from all January day-ahead errors at the same cutoff, **excluding the selected delivery date** (out-of-sample).
- `p10_energy_mwh` and `p90_energy_mwh` sum the per-hour bands.
- The `actual*` and `mae_mw`/`bias_mw` fields are `null` if actuals are missing.

### `GET /api/metrics?start=ISO&end=ISO&horizon_h=4`
```json
{"n": 700, "mae": 950.2, "rmse": 1300.5, "bias": 120.1, "mape": 9.8,
 "p50_abs_error": 700, "p90_abs_error": 2100, "p99_abs_error": 3800,
 "error_quantiles": {"p10": -1500, "p50": 80, "p90": 1700},
 "mean_actual": 9500, "nmae_pct": 10.0,
 "histogram": [{"bin_start": -4000, "bin_end": -3500, "count": 3}]}
```
- `mape` excludes points where the actual is below 1000 MW.
- `nmae_pct = mae / mean_actual * 100`.
- The histogram uses 500 MW bins.

### `GET /api/metrics/horizon-curve?start=ISO&end=ISO`
`[{"horizon_h": 0, "n": 700, "mae": 400.1, "rmse": 550.2, "bias": 10.0, "p90_abs_error": 900}, ...]`
- One entry per integer horizon from 0 to 48.
- At horizon H, each target uses the latest forecast published at least H hours earlier.

### `GET /api/metrics/hourly?start=ISO&end=ISO&horizon_h=4`
`[{"hour": 0, "n": 31, "mae": 900.0, "bias": 100.0}, ... 24 entries]`

Every `start` and `end` parameter is optional. They default to the full January range: 2026-01-01T00:00Z to 2026-02-02T00:00Z.

Invalid parameters return HTTP 422 (FastAPI default). An unknown delivery date returns 404.

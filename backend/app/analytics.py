"""Pure analytics over forecast/actual DataFrames.

Forecast frames have columns: publishTime, startTime, forecast, actual, horizon_h
(times are tz-aware UTC pandas Timestamps; actual may be NaN).
"""
from __future__ import annotations

import datetime as dt
import math
from typing import Optional

import numpy as np
import pandas as pd

HIST_BIN_MW = 500


def r1(x) -> Optional[float]:
    """Round to 1 dp, mapping NaN/None/inf to None."""
    if x is None:
        return None
    try:
        xf = float(x)
    except (TypeError, ValueError):
        return None
    if math.isnan(xf) or math.isinf(xf):
        return None
    return round(xf, 1)


def num(x):
    """JSON-safe number: ints stay ints, floats rounded to 1 dp, NaN -> None."""
    v = r1(x)
    if v is None:
        return None
    return int(v) if float(v).is_integer() else v


def iso(ts: pd.Timestamp) -> str:
    return pd.Timestamp(ts).tz_convert("UTC").strftime("%Y-%m-%dT%H:%M:%SZ")


# --------------------------------------------------------------------------- selection

def select_at_horizon(f: pd.DataFrame, horizon_h: float, start, end) -> pd.DataFrame:
    """For each hourly target t in [start, end), pick the forecast with the latest
    publishTime <= t - H. `f` must already be restricted to 0 <= horizon <= 48, so
    the chosen forecast also satisfies t - publishTime <= 48h."""
    window = f[(f["startTime"] >= start) & (f["startTime"] < end)]
    cols = ["publishTime", "startTime", "forecast", "actual", "horizon_h"]
    if window.empty:
        return pd.DataFrame(columns=cols)
    targets = pd.DataFrame({"startTime": np.sort(window["startTime"].unique())})
    targets["startTime"] = pd.to_datetime(targets["startTime"], utc=True)
    targets["key"] = targets["startTime"] - pd.Timedelta(hours=float(horizon_h))
    right = window[cols].sort_values("publishTime")
    out = pd.merge_asof(
        targets.sort_values("key"),
        right,
        left_on="key",
        right_on="publishTime",
        by="startTime",
        direction="backward",
    )
    out = out.dropna(subset=["forecast"]).drop(columns="key")
    return out.sort_values("startTime").reset_index(drop=True)[cols]


def cutoff_timestamp(delivery_date: dt.date, cutoff: str) -> pd.Timestamp:
    hh, mm = (int(p) for p in cutoff.split(":"))
    d1 = pd.Timestamp(delivery_date, tz="UTC") - pd.Timedelta(days=1)
    return d1 + pd.Timedelta(hours=hh, minutes=mm)


def select_day_ahead(f: pd.DataFrame, delivery_date: dt.date, cutoff: str):
    """Return (cutoff_ts, publishTime or None, points DataFrame) using the single
    latest run with publishTime <= (D-1)T cutoff."""
    cts = cutoff_timestamp(delivery_date, cutoff)
    pubs = f.loc[f["publishTime"] <= cts, "publishTime"]
    if pubs.empty:
        return cts, None, f.iloc[0:0]
    pub = pubs.max()
    d0 = pd.Timestamp(delivery_date, tz="UTC")
    pts = f[(f["publishTime"] == pub) & (f["startTime"] >= d0) & (f["startTime"] < d0 + pd.Timedelta(days=1))]
    return cts, pub, pts.sort_values("startTime").reset_index(drop=True)


def day_ahead_errors(f: pd.DataFrame, delivery_dates, cutoff: str) -> pd.DataFrame:
    """Errors (forecast - actual) for every delivery date at a given cutoff."""
    frames = []
    for d in delivery_dates:
        _, pub, pts = select_day_ahead(f, d, cutoff)
        if pub is None or pts.empty:
            continue
        p = pts.dropna(subset=["actual"])
        frames.append(pd.DataFrame({"delivery_date": d, "error": p["forecast"] - p["actual"]}))
    if not frames:
        return pd.DataFrame(columns=["delivery_date", "error"])
    return pd.concat(frames, ignore_index=True)


# --------------------------------------------------------------------------- metrics

def histogram(errors: np.ndarray, bin_mw: int = HIST_BIN_MW) -> list[dict]:
    if errors.size == 0:
        return []
    lo = math.floor(errors.min() / bin_mw) * bin_mw
    hi = math.floor(errors.max() / bin_mw) * bin_mw + bin_mw
    edges = np.arange(lo, hi + bin_mw, bin_mw)
    counts, _ = np.histogram(errors, bins=edges)
    return [
        {"bin_start": int(edges[i]), "bin_end": int(edges[i + 1]), "count": int(counts[i])}
        for i in range(len(counts))
    ]


def compute_metrics(df: pd.DataFrame) -> dict:
    d = df.dropna(subset=["actual", "forecast"])
    n = int(len(d))
    if n == 0:
        return {
            "n": 0, "mae": None, "rmse": None, "bias": None, "mape": None,
            "p50_abs_error": None, "p90_abs_error": None, "p99_abs_error": None,
            "error_quantiles": {"p10": None, "p50": None, "p90": None},
            "mean_actual": None, "nmae_pct": None, "histogram": [],
        }
    fc = d["forecast"].to_numpy(dtype=float)
    ac = d["actual"].to_numpy(dtype=float)
    err = fc - ac
    abs_err = np.abs(err)
    mae = abs_err.mean()
    mask = ac >= 1000
    mape = (abs_err[mask] / ac[mask]).mean() * 100 if mask.any() else None
    mean_actual = ac.mean()
    return {
        "n": n,
        "mae": r1(mae),
        "rmse": r1(np.sqrt((err ** 2).mean())),
        "bias": r1(err.mean()),
        "mape": r1(mape),
        "p50_abs_error": r1(np.quantile(abs_err, 0.5)),
        "p90_abs_error": r1(np.quantile(abs_err, 0.9)),
        "p99_abs_error": r1(np.quantile(abs_err, 0.99)),
        "error_quantiles": {
            "p10": r1(np.quantile(err, 0.1)),
            "p50": r1(np.quantile(err, 0.5)),
            "p90": r1(np.quantile(err, 0.9)),
        },
        "mean_actual": r1(mean_actual),
        "nmae_pct": r1(mae / mean_actual * 100) if mean_actual else None,
        "histogram": histogram(err),
    }


def horizon_curve(f: pd.DataFrame, start, end, max_h: int = 48) -> list[dict]:
    out = []
    for h in range(0, max_h + 1):
        sel = select_at_horizon(f, h, start, end).dropna(subset=["actual"])
        if sel.empty:
            out.append({"horizon_h": h, "n": 0, "mae": None, "rmse": None, "bias": None, "p90_abs_error": None})
            continue
        err = (sel["forecast"] - sel["actual"]).to_numpy(dtype=float)
        a = np.abs(err)
        out.append({
            "horizon_h": h,
            "n": int(len(err)),
            "mae": r1(a.mean()),
            "rmse": r1(np.sqrt((err ** 2).mean())),
            "bias": r1(err.mean()),
            "p90_abs_error": r1(np.quantile(a, 0.9)),
        })
    return out


def hourly_profile(sel: pd.DataFrame) -> list[dict]:
    d = sel.dropna(subset=["actual"])
    err = d["forecast"] - d["actual"]
    hours = d["startTime"].dt.hour
    out = []
    for h in range(24):
        e = err[hours == h].to_numpy(dtype=float)
        out.append({
            "hour": h,
            "n": int(e.size),
            "mae": r1(np.abs(e).mean()) if e.size else None,
            "bias": r1(e.mean()) if e.size else None,
        })
    return out

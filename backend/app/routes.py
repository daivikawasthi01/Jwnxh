import datetime as dt
from functools import lru_cache
from typing import List, Optional

import numpy as np
import pandas as pd
from fastapi import APIRouter, HTTPException, Query

from app import analytics as an
from app import schemas as s
from app.store import ACTUALS, FORECASTS, FORECASTS_ALL, MAX_HORIZON_H

router = APIRouter()

DEFAULT_START = pd.Timestamp("2026-01-01T00:00:00Z")
DEFAULT_END = pd.Timestamp("2026-02-02T00:00:00Z")
DEFAULT_CUTOFF = "09:00"
PUBLISH_TIMES_UTC = ["02:30", "04:30", "07:30", "09:30", "11:30", "15:30", "18:30", "22:30"]
CUTOFF_RE = r"^([01]\d|2[0-3]):[0-5]\d$"
# Delivery dates whose purchase decision (D-1) falls in January 2026.
DELIVERY_DATES: List[dt.date] = [dt.date(2026, 1, 2) + dt.timedelta(days=i) for i in range(31)]
DELIVERY_SET = set(DELIVERY_DATES)


def _ts(x: Optional[dt.datetime], default: pd.Timestamp) -> pd.Timestamp:
    if x is None:
        return default
    t = pd.Timestamp(x)
    return t.tz_localize("UTC") if t.tzinfo is None else t.tz_convert("UTC")


def _range(start, end):
    return _ts(start, DEFAULT_START), _ts(end, DEFAULT_END)


@lru_cache(maxsize=64)
def _horizon_sel(h: float, start: pd.Timestamp, end: pd.Timestamp) -> pd.DataFrame:
    return an.select_at_horizon(FORECASTS, h, start, end)


@lru_cache(maxsize=32)
def _horizon_curve(start: pd.Timestamp, end: pd.Timestamp):
    return an.horizon_curve(FORECASTS, start, end, int(MAX_HORIZON_H))


@lru_cache(maxsize=64)
def _da_errors(cutoff: str) -> pd.DataFrame:
    return an.day_ahead_errors(FORECASTS, DELIVERY_DATES, cutoff)


@router.get("/health", response_model=s.Health)
def health():
    return {"status": "ok"}


@router.get("/meta", response_model=s.Meta)
def meta():
    return {
        "actuals_range": {"start": an.iso(ACTUALS["startTime"].min()), "end": an.iso(ACTUALS["startTime"].max())},
        "forecast_publish_range": {
            "start": an.iso(FORECASTS_ALL["publishTime"].min()),
            "end": an.iso(FORECASTS_ALL["publishTime"].max()),
        },
        "delivery_dates": [d.isoformat() for d in DELIVERY_DATES],
        "publish_times_utc": PUBLISH_TIMES_UTC,
        "default_cutoff": DEFAULT_CUTOFF,
        "max_horizon_h": int(MAX_HORIZON_H),
    }


@router.get("/actuals", response_model=List[s.ActualPoint])
def actuals(start: Optional[dt.datetime] = None, end: Optional[dt.datetime] = None):
    a, b = _range(start, end)
    d = ACTUALS[(ACTUALS["startTime"] >= a) & (ACTUALS["startTime"] < b)]
    return [{"startTime": an.iso(t), "generation": an.num(g)} for t, g in zip(d["startTime"], d["generation"])]


@router.get("/forecasts/horizon", response_model=List[s.HorizonPoint])
def forecasts_horizon(
    start: Optional[dt.datetime] = None,
    end: Optional[dt.datetime] = None,
    horizon_h: float = Query(4, ge=0, le=48),
):
    a, b = _range(start, end)
    sel = _horizon_sel(float(horizon_h), a, b)
    out = []
    for r in sel.itertuples(index=False):
        err = r.forecast - r.actual if not pd.isna(r.actual) else None
        out.append({
            "startTime": an.iso(r.startTime),
            "publishTime": an.iso(r.publishTime),
            "horizon_h": an.r1(r.horizon_h),
            "forecast": an.num(r.forecast),
            "actual": an.num(r.actual),
            "error": an.num(err),
        })
    return out


@router.get("/forecasts/day-ahead", response_model=s.DayAhead)
def forecasts_day_ahead(
    delivery_date: dt.date,
    cutoff: str = Query(DEFAULT_CUTOFF, pattern=CUTOFF_RE),
):
    if delivery_date not in DELIVERY_SET:
        raise HTTPException(status_code=404, detail="Unknown delivery date")
    cts, pub, pts = an.select_day_ahead(FORECASTS, delivery_date, cutoff)
    if pub is None or pts.empty:
        raise HTTPException(status_code=404, detail="No forecast run available before cutoff")

    errs = _da_errors(cutoff)
    oos = errs.loc[errs["delivery_date"] != delivery_date, "error"].to_numpy(dtype=float)
    if oos.size:
        q10, q90 = np.quantile(oos, 0.1), np.quantile(oos, 0.9)
    else:
        q10 = q90 = np.nan

    fc = pts["forecast"].to_numpy(dtype=float)
    ac = pts["actual"].to_numpy(dtype=float)
    err = fc - ac
    p10 = fc - q90
    p90 = fc - q10

    points = [
        {
            "startTime": an.iso(t),
            "horizon_h": an.r1(h),
            "forecast": an.num(f),
            "actual": an.num(a),
            "error": an.num(e),
            "p10": an.num(lo),
            "p90": an.num(hi),
        }
        for t, h, f, a, e, lo, hi in zip(pts["startTime"], pts["horizon_h"], fc, ac, err, p10, p90)
    ]
    has_actuals = not np.isnan(ac).any()
    valid = ~np.isnan(err)
    summary = {
        "forecast_energy_mwh": an.num(fc.sum()),
        "actual_energy_mwh": an.num(ac.sum()) if has_actuals else None,
        "p10_energy_mwh": an.num(p10.sum()) if oos.size else None,
        "p90_energy_mwh": an.num(p90.sum()) if oos.size else None,
        "peak_forecast_mw": an.num(fc.max()),
        "min_forecast_mw": an.num(fc.min()),
        "mae_mw": an.r1(np.abs(err[valid]).mean()) if valid.any() else None,
        "bias_mw": an.r1(err[valid].mean()) if valid.any() else None,
    }
    return {
        "delivery_date": delivery_date.isoformat(),
        "cutoff": an.iso(cts),
        "publishTime": an.iso(pub),
        "points": points,
        "summary": summary,
    }


@router.get("/metrics", response_model=s.Metrics)
def metrics(
    start: Optional[dt.datetime] = None,
    end: Optional[dt.datetime] = None,
    horizon_h: float = Query(4, ge=0, le=48),
):
    a, b = _range(start, end)
    return an.compute_metrics(_horizon_sel(float(horizon_h), a, b))


@router.get("/metrics/horizon-curve", response_model=List[s.HorizonCurvePoint])
def metrics_horizon_curve(start: Optional[dt.datetime] = None, end: Optional[dt.datetime] = None):
    a, b = _range(start, end)
    return _horizon_curve(a, b)


@router.get("/metrics/hourly", response_model=List[s.HourlyPoint])
def metrics_hourly(
    start: Optional[dt.datetime] = None,
    end: Optional[dt.datetime] = None,
    horizon_h: float = Query(4, ge=0, le=48),
):
    a, b = _range(start, end)
    return an.hourly_profile(_horizon_sel(float(horizon_h), a, b))

"""Loads the snapshot JSON once per process and precomputes derived frames."""
from pathlib import Path

import pandas as pd

DATA_DIR = Path(__file__).resolve().parents[1] / "data"
MAX_HORIZON_H = 48.0


def _load(name: str) -> pd.DataFrame:
    df = pd.read_json(DATA_DIR / name, convert_dates=False)
    for col in ("startTime", "publishTime"):
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], utc=True)
    return df


def build_frames(actuals: pd.DataFrame, forecasts: pd.DataFrame):
    """Return (actuals, forecasts_nonneg, forecasts_0_48).

    Forecast frames carry horizon_h and the matched hourly actual (NaN if none).
    """
    actuals = actuals.sort_values("startTime").reset_index(drop=True)
    hourly = actuals[actuals["startTime"].dt.minute == 0][["startTime", "generation"]]
    hourly = hourly.rename(columns={"generation": "actual"})

    f = forecasts.copy()
    f["horizon_h"] = (f["startTime"] - f["publishTime"]).dt.total_seconds() / 3600.0
    f = f[f["horizon_h"] >= 0]
    f = f[f["startTime"].dt.minute == 0]
    f = f.rename(columns={"generation": "forecast"})
    f = f.merge(hourly, on="startTime", how="left")
    f = f.sort_values(["publishTime", "startTime"]).reset_index(drop=True)
    f48 = f[f["horizon_h"] <= MAX_HORIZON_H].reset_index(drop=True)
    return actuals, f, f48


ACTUALS, FORECASTS_ALL, FORECASTS = build_frames(
    _load("actuals.json"), _load("forecasts.json")
)

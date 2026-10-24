from typing import List, Optional

from pydantic import BaseModel

Num = Optional[float]


class Health(BaseModel):
    status: str


class Range(BaseModel):
    start: Optional[str]
    end: Optional[str]


class Meta(BaseModel):
    actuals_range: Range
    forecast_publish_range: Range
    delivery_dates: List[str]
    publish_times_utc: List[str]
    default_cutoff: str
    max_horizon_h: int


class ActualPoint(BaseModel):
    startTime: str
    generation: Num


class HorizonPoint(BaseModel):
    startTime: str
    publishTime: str
    horizon_h: float
    forecast: Num
    actual: Num
    error: Num


class DayAheadPoint(BaseModel):
    startTime: str
    horizon_h: float
    forecast: Num
    actual: Num
    error: Num
    p10: Num
    p90: Num


class DayAheadSummary(BaseModel):
    forecast_energy_mwh: Num
    actual_energy_mwh: Num
    p10_energy_mwh: Num
    p90_energy_mwh: Num
    peak_forecast_mw: Num
    min_forecast_mw: Num
    mae_mw: Num
    bias_mw: Num


class DayAhead(BaseModel):
    delivery_date: str
    cutoff: str
    publishTime: str
    points: List[DayAheadPoint]
    summary: DayAheadSummary


class ErrorQuantiles(BaseModel):
    p10: Num
    p50: Num
    p90: Num


class HistBin(BaseModel):
    bin_start: int
    bin_end: int
    count: int


class Metrics(BaseModel):
    n: int
    mae: Num
    rmse: Num
    bias: Num
    mape: Num
    p50_abs_error: Num
    p90_abs_error: Num
    p99_abs_error: Num
    error_quantiles: ErrorQuantiles
    mean_actual: Num
    nmae_pct: Num
    histogram: List[HistBin]


class HorizonCurvePoint(BaseModel):
    horizon_h: int
    n: int
    mae: Num
    rmse: Num
    bias: Num
    p90_abs_error: Num


class HourlyPoint(BaseModel):
    hour: int
    n: int
    mae: Num
    bias: Num

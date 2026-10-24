import datetime as dt

import numpy as np
import pandas as pd
import pytest

from app import analytics as an
from app.store import FORECASTS, FORECASTS_ALL, build_frames

T = lambda s: pd.Timestamp(s, tz="UTC")  # noqa: E731


def _fixture():
    actuals = pd.DataFrame({
        "startTime": [T("2026-01-10 12:00"), T("2026-01-10 12:30"), T("2026-01-10 13:00")],
        "generation": [1000, 9999, 2000],
    })
    rows = []
    # Runs at 00:30, 06:30, 11:30 on Jan 10 and one at Jan 8 06:30 (too old for 12:00 target).
    for pub, fc in [("2026-01-08 06:30", 500), ("2026-01-10 00:30", 1100),
                    ("2026-01-10 06:30", 1200), ("2026-01-10 11:30", 1050)]:
        for st in ["2026-01-10 12:00", "2026-01-10 13:00", "2026-01-09 21:00"]:
            rows.append({"publishTime": T(pub), "startTime": T(st), "generation": fc})
    return build_frames(actuals, pd.DataFrame(rows))


def test_build_frames_drops_negative_and_old_horizons():
    _, fall, f48 = _fixture()
    assert (fall["horizon_h"] >= 0).all()
    assert f48["horizon_h"].between(0, 48).all()
    # Jan 8 06:30 -> Jan 10 12:00 is 53.5h, excluded from the 0-48 frame.
    pairs = set(zip(f48["publishTime"], f48["startTime"]))
    assert (T("2026-01-08 06:30"), T("2026-01-10 12:00")) not in pairs
    assert (T("2026-01-08 06:30"), T("2026-01-09 21:00")) in pairs
    # Half-hourly actual (9999) never matched.
    assert 9999 not in set(fall["actual"].dropna())


@pytest.mark.parametrize("h,expected_pub", [
    (0, "2026-01-10 11:30"), (0.5, "2026-01-10 11:30"), (1, "2026-01-10 06:30"),
    (5.5, "2026-01-10 06:30"), (6, "2026-01-10 00:30"), (11.5, "2026-01-10 00:30"),
])
def test_horizon_selection_fixture(h, expected_pub):
    _, _, f48 = _fixture()
    sel = an.select_at_horizon(f48, h, T("2026-01-10 12:00"), T("2026-01-10 12:01"))
    assert len(sel) == 1
    assert sel.iloc[0]["publishTime"] == T(expected_pub)


def test_horizon_selection_none_if_only_too_old():
    _, _, f48 = _fixture()
    sel = an.select_at_horizon(f48, 12, T("2026-01-10 12:00"), T("2026-01-10 12:01"))
    assert sel.empty  # only the 53.5h-old run is earlier, which exceeds 48h


def test_horizon_48_never_uses_older_than_48h():
    # Runs publish at :30 and targets are on the hour, so H=48 has no eligible forecast.
    assert an.select_at_horizon(FORECASTS, 48, T("2026-01-01"), T("2026-02-02")).empty


@pytest.mark.parametrize("h", [0, 1, 4, 12, 24, 36, 44])
def test_horizon_selection_real_data_constraints(h):
    sel = an.select_at_horizon(FORECASTS, h, T("2026-01-01"), T("2026-02-02"))
    assert len(sel) > 500
    age = (sel["startTime"] - sel["publishTime"]).dt.total_seconds() / 3600
    assert (age >= h).all()
    assert (age <= 48).all()
    # It must be the latest eligible run: no run in the frame for that target is
    # published in (chosen, t-H].
    merged = sel.merge(FORECASTS[["startTime", "publishTime"]], on="startTime", suffixes=("", "_other"))
    later = merged[(merged["publishTime_other"] > merged["publishTime"]) &
                   (merged["publishTime_other"] <= merged["startTime"] - pd.Timedelta(hours=h))]
    assert later.empty


def test_day_ahead_never_leaks_after_cutoff():
    for d in [dt.date(2026, 1, 2) + dt.timedelta(days=i) for i in range(31)]:
        for cutoff in ["00:00", "02:29", "02:30", "09:00", "12:00", "23:59"]:
            cts, pub, pts = an.select_day_ahead(FORECASTS, d, cutoff)
            assert pub is not None and pub <= cts
            assert cts == pd.Timestamp(d - dt.timedelta(days=1), tz="UTC") + pd.Timedelta(
                hours=int(cutoff[:2]), minutes=int(cutoff[3:]))
            # latest eligible run
            assert not ((FORECASTS_ALL["publishTime"] > pub) & (FORECASTS_ALL["publishTime"] <= cts)).any()
            assert pts["horizon_h"].between(0, 48).all()
            assert (pts["publishTime"] == pub).all()
            # The 22:30 run only extends to 21:00 two days out, so cutoffs before
            # 02:30 yield 22 hourly points; all later cutoffs give a full day.
            assert len(pts) == (22 if cutoff < "02:30" else 24)
            assert (pts["startTime"].dt.date == d).all()


def test_day_ahead_example_run():
    _, pub, _ = an.select_day_ahead(FORECASTS, dt.date(2026, 1, 15), "09:00")
    assert pub == T("2026-01-14 07:30")


def test_metric_math():
    df = pd.DataFrame({
        "forecast": [1100.0, 2500.0, 900.0, 600.0],
        "actual": [1000.0, 2000.0, 1000.0, 500.0],
    })
    m = an.compute_metrics(df)
    err = np.array([100, 500, -100, 100])
    assert m["n"] == 4
    assert m["mae"] == 200.0
    assert m["bias"] == 150.0
    assert m["rmse"] == round(float(np.sqrt((err ** 2).mean())), 1)
    # MAPE excludes actual < 1000 (the 500 row): (10% + 25% + 10%) / 3 = 15%
    assert m["mape"] == 15.0
    assert m["mean_actual"] == 1125.0
    assert m["nmae_pct"] == round(200 / 1125 * 100, 1)
    hist = m["histogram"]
    assert sum(b["count"] for b in hist) == 4
    assert all(b["bin_end"] - b["bin_start"] == 500 for b in hist)
    assert hist[0]["bin_start"] == -500 and hist[-1]["bin_end"] == 1000


def test_metrics_empty_is_json_safe():
    m = an.compute_metrics(pd.DataFrame({"forecast": [1.0], "actual": [np.nan]}))
    assert m["n"] == 0 and m["mae"] is None and m["histogram"] == []

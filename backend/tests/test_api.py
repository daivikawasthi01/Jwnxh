import json
import math

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def _no_nan(obj):
    s = json.dumps(obj)
    assert "NaN" not in s and "Infinity" not in s


def test_health():
    assert client.get("/api/health").json() == {"status": "ok"}


def test_meta():
    m = client.get("/api/meta").json()
    assert m["delivery_dates"][0] == "2026-01-02" and m["delivery_dates"][-1] == "2026-02-01"
    assert len(m["delivery_dates"]) == 31
    assert m["default_cutoff"] == "09:00" and m["max_horizon_h"] == 48
    assert m["actuals_range"]["start"] == "2026-01-01T00:00:00Z"
    assert m["forecast_publish_range"]["start"] == "2025-12-30T02:30:00Z"


def test_actuals():
    r = client.get("/api/actuals", params={"start": "2026-01-15T00:00:00Z", "end": "2026-01-16T00:00:00Z"})
    data = r.json()
    assert r.status_code == 200 and len(data) == 48
    assert data[0]["startTime"] == "2026-01-15T00:00:00Z"


def test_forecasts_horizon():
    r = client.get("/api/forecasts/horizon", params={"start": "2026-01-15T00:00:00Z",
                                                     "end": "2026-01-16T00:00:00Z", "horizon_h": 4})
    data = r.json()
    assert r.status_code == 200 and len(data) == 24
    for p in data:
        assert p["horizon_h"] >= 4
        assert p["error"] == round(p["forecast"] - p["actual"], 1)
    _no_nan(data)
    assert client.get("/api/forecasts/horizon", params={"horizon_h": 49}).status_code == 422
    assert client.get("/api/forecasts/horizon", params={"horizon_h": -1}).status_code == 422
    assert len(client.get("/api/forecasts/horizon").json()) > 700


def test_day_ahead():
    r = client.get("/api/forecasts/day-ahead", params={"delivery_date": "2026-01-15", "cutoff": "09:00"})
    d = r.json()
    assert r.status_code == 200
    assert d["cutoff"] == "2026-01-14T09:00:00Z"
    assert d["publishTime"] == "2026-01-14T07:30:00Z"
    assert len(d["points"]) == 24
    p = d["points"][0]
    assert p["horizon_h"] == 16.5
    assert p["p10"] <= p["p90"]
    s = d["summary"]
    assert s["p10_energy_mwh"] <= s["p90_energy_mwh"]
    assert math.isclose(s["forecast_energy_mwh"], sum(x["forecast"] for x in d["points"]), abs_tol=1)
    _no_nan(d)
    # default cutoff
    assert client.get("/api/forecasts/day-ahead", params={"delivery_date": "2026-01-15"}).json()["publishTime"] == d["publishTime"]


def test_day_ahead_errors():
    assert client.get("/api/forecasts/day-ahead", params={"delivery_date": "2026-03-01"}).status_code == 404
    assert client.get("/api/forecasts/day-ahead", params={"delivery_date": "2026-01-15", "cutoff": "25:00"}).status_code == 422
    assert client.get("/api/forecasts/day-ahead", params={"delivery_date": "nope"}).status_code == 422


def test_day_ahead_last_date_has_band():
    d = client.get("/api/forecasts/day-ahead", params={"delivery_date": "2026-02-01"}).json()
    assert len(d["points"]) == 24 and d["points"][0]["p10"] is not None
    _no_nan(d)


def test_metrics():
    m = client.get("/api/metrics", params={"horizon_h": 4}).json()
    assert m["n"] > 700 and m["mae"] > 0
    assert m["error_quantiles"]["p10"] <= m["error_quantiles"]["p50"] <= m["error_quantiles"]["p90"]
    assert sum(b["count"] for b in m["histogram"]) == m["n"]
    _no_nan(m)
    empty = client.get("/api/metrics", params={"start": "2020-01-01T00:00:00Z", "end": "2020-01-02T00:00:00Z"}).json()
    assert empty["n"] == 0 and empty["mae"] is None


def test_horizon_curve():
    c = client.get("/api/metrics/horizon-curve").json()
    assert [x["horizon_h"] for x in c] == list(range(49))
    assert c[24]["mae"] > c[0]["mae"]
    assert c[48]["n"] == 0 and c[48]["mae"] is None
    _no_nan(c)


def test_hourly():
    h = client.get("/api/metrics/hourly", params={"horizon_h": 4}).json()
    assert [x["hour"] for x in h] == list(range(24))
    assert all(x["n"] >= 28 for x in h)
    _no_nan(h)

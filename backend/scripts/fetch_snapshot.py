"""Fetch the January 2026 wind actuals (FUELHH) and forecasts (WINDFOR) from Elexon
and write them to backend/data/ as compact JSON snapshots."""
import json
from pathlib import Path

import httpx

BASE = "https://data.elexon.co.uk/bmrs/api/v1/datasets"
DATA_DIR = Path(__file__).resolve().parents[1] / "data"


def fetch(url: str, params: dict) -> list[dict]:
    resp = httpx.get(url, params=params, timeout=120)
    resp.raise_for_status()
    return resp.json()


def main() -> None:
    DATA_DIR.mkdir(exist_ok=True)
    actuals = fetch(
        f"{BASE}/FUELHH/stream",
        {"settlementDateFrom": "2026-01-01", "settlementDateTo": "2026-02-01", "fuelType": "WIND"},
    )
    forecasts = fetch(
        f"{BASE}/WINDFOR/stream",
        {"publishDateTimeFrom": "2025-12-30T00:00:00Z", "publishDateTimeTo": "2026-02-01T00:00:00Z"},
    )
    actuals = sorted(
        ({"startTime": r["startTime"], "generation": r["generation"]} for r in actuals),
        key=lambda r: r["startTime"],
    )
    forecasts = sorted(
        ({"publishTime": r["publishTime"], "startTime": r["startTime"], "generation": r["generation"]} for r in forecasts),
        key=lambda r: (r["publishTime"], r["startTime"]),
    )
    (DATA_DIR / "actuals.json").write_text(json.dumps(actuals, separators=(",", ":")))
    (DATA_DIR / "forecasts.json").write_text(json.dumps(forecasts, separators=(",", ":")))
    print(f"actuals: {len(actuals)}  forecasts: {len(forecasts)}")


if __name__ == "__main__":
    main()

# Wind Forecast Day-Ahead Tool

**Live app:** `https://<TBD>.vercel.app` ⚠️ **PLACEHOLDER: replace with the deployed URL**

A web app for a UK utility's **day-ahead trading team**. The team buys power for delivery day D on D−1, before the GB day-ahead auction gate (about 09:20 UK time), and needs to know how much to buy on top of what wind will supply. The app shows:

1. **The latest national wind forecast available at decision time** for each delivery day (Elexon `WINDFOR`, with a default cutoff of 09:00 on D−1 that selects the 07:30 run).
2. **Quantified forecast accuracy** against actual wind generation (Elexon `FUELHH`, `fuelType=WIND`) for purchase decisions made in **January 2026**. This includes an out-of-sample P10/P90 band the team can size purchases against.

More detail:
- [`docs/DESIGN.md`](docs/DESIGN.md): architecture, algorithms, metrics and trade-offs (technical lead)
- [`docs/PITCH.md`](docs/PITCH.md): problem, demo script and how to use the band (trading desk)
- [`docs/api-contract.md`](docs/api-contract.md): REST API contract

## Product walkthrough

| Page | Question it answers | What you see |
|---|---|---|
| **Day-Ahead decision** | "What did the forecast say when I had to buy, and how much wind can I rely on?" | Pick a delivery date and cutoff. You get the 24 hourly points from the single latest WINDFOR run before the cutoff, with a P10–P90 band and the actual outturn overlaid. Summary cards show forecast, P10 and P90 energy (MWh), peak and minimum MW, and the day's MAE and bias. |
| **Explorer** | "How did forecasts at a given lead time compare with reality?" | Pick a date range and a forecast horizon (0–48 h). The chart compares forecast with actual, using for each hour the latest forecast published at least H hours before. Errors are shown per hour. |
| **Accuracy** | "How good is the forecast overall, and where is it weak?" | Headline metrics (MAE, RMSE, bias, MAPE, nMAE, P90/P99 absolute error), the error-by-horizon curve (0–48 h), the error histogram and the error profile by hour of day. |

All times are UTC. In January, UTC is the same as UK local time (GMT).

## Features

- **Day-Ahead decision view**: the latest WINDFOR forecast available before a configurable cutoff, with a P10–P90 band and actual outturn overlaid, plus daily forecast/P10/P90 energy, peak/minimum MW, MAE and bias.
- **Explorer view**: compares forecasts at a chosen lead time (0–48h) against actual outturn over any date range, with per-hour error.
- **Accuracy view**: headline error metrics (MAE, RMSE, bias, MAPE, nMAE, P90/P99), an error-by-horizon curve, an error histogram, and an error profile by hour of day.
- **Reproducible data**: reads a committed JSON snapshot of Elexon WINDFOR/FUELHH data for fast, consistent results; a script re-downloads a fresh snapshot on demand.
- **Containerized**: one-command `docker compose up` runs the FastAPI backend and an nginx-served React frontend together, or either can run standalone.

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.11, FastAPI, pandas, Pydantic |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS v4, Recharts |
| Data source | Elexon Insights API (`WINDFOR`, `FUELHH`), committed as a JSON snapshot |
| Deployment | Docker + nginx, or Vercel (Python serverless function + static frontend) |

## Repository layout

```
.
├── api/
│   └── index.py              # Vercel Python function: adds backend/ to sys.path, re-exports FastAPI `app`
├── backend/
│   ├── app/
│   │   ├── main.py           # FastAPI app factory / entrypoint (uvicorn app.main:app)
│   │   ├── routes.py         # /api/* endpoints (health, meta, actuals, forecasts, metrics)
│   │   ├── analytics.py      # Horizon and day-ahead selection, error metrics, P10/P90 band
│   │   ├── store.py          # Loads the JSON snapshot into cached pandas DataFrames
│   │   └── schemas.py        # Pydantic response models
│   ├── data/
│   │   ├── actuals.json      # FUELHH WIND half-hourly outturn, Jan 2026 (committed snapshot)
│   │   └── forecasts.json    # WINDFOR hourly forecasts, published 30 Dec 2025 to 1 Feb 2026 (~1.8 MB)
│   ├── scripts/
│   │   └── fetch_snapshot.py # Re-downloads both datasets from the Elexon Insights API
│   ├── tests/                # pytest suite (selection rules, metrics, API contract)
│   ├── requirements.txt      # Backend runtime and test dependencies
│   ├── Dockerfile            # python:3.11-slim image running uvicorn on :8000
│   └── .dockerignore
├── frontend/
│   ├── src/
│   │   ├── pages/            # Day-Ahead, Explorer and Accuracy pages
│   │   ├── components/       # Charts, cards and controls
│   │   ├── hooks/            # useApi (fetch + state), useChartColors (theme-aware colours)
│   │   ├── mocks/            # Mock API handlers for `npm run dev:mock`
│   │   ├── api.ts            # Typed client for relative /api endpoints
│   │   ├── types.ts          # TypeScript types mirroring the API contract
│   │   ├── format.ts         # Number and date formatting helpers
│   │   └── index.css         # Tailwind v4 entry
│   ├── index.html
│   ├── package.json          # Vite + React + TypeScript + Tailwind v4
│   ├── vite.config.ts        # Dev server on :5173, proxies /api to :8000
│   ├── Dockerfile            # Multi-stage: node:20-alpine build, then nginx:alpine serving dist/
│   ├── nginx.conf            # SPA fallback and /api/ reverse proxy to backend:8000
│   └── .dockerignore
├── docs/
│   ├── api-contract.md       # Shared backend/frontend API contract
│   ├── DESIGN.md             # Technical design notes
│   └── PITCH.md              # Client-facing pitch and demo script
├── docker-compose.yml        # backend (host :8001 -> :8000) + frontend (:8080)
├── vercel.json               # Vercel build, Python function and rewrites
├── requirements.txt          # Runtime deps for the Vercel Python function (fastapi, pandas, numpy)
├── .vercelignore
└── .gitignore
```

## Getting started

### Option A: Docker (recommended)

```bash
docker compose up --build
```

Open **http://localhost:8080**. nginx serves the frontend and proxies `/api/*` to the backend. The API is also exposed directly at http://localhost:8001 (interactive docs at http://localhost:8001/docs).

### Option B: Local development without Docker

Backend (Python 3.11+):

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Frontend (Node 20+), in a second terminal:

```bash
cd frontend
npm install
npm run dev                      # http://localhost:5173, /api proxied to :8000
# or: npm run dev:mock           # runs against mock data, no backend needed
```

## Refreshing the data

The app reads a committed snapshot in `backend/data/`, so cold starts are fast and results are reproducible. To download a fresh copy from the public Elexon Insights API (no API key needed):

```bash
cd backend
source .venv/bin/activate
python scripts/fetch_snapshot.py
```

The script writes `actuals.json` (FUELHH, `fuelType=WIND`) and `forecasts.json` (WINDFOR). Change the date parameters in the script to cover a different period. Restart the backend afterwards, because the data is cached in memory.

## Tests

```bash
cd backend
source .venv/bin/activate
pytest -q
```

Frontend type-check and production build:

```bash
cd frontend
npm run build
```

## Deploying to Vercel

The repository is set up to deploy as one Vercel project:

- **Static frontend**: Vercel runs `npm install` and `npm run build` in `frontend/` and serves `frontend/dist` from the CDN.
- **API**: `api/index.py` is a Python Vercel Function that imports the FastAPI `app` from `backend/app/main.py`. `vercel.json` adds `backend/**` to the function bundle (excluding `.venv`, tests and scripts). Dependencies come from the root `requirements.txt`.
- **Routing**: `/api/(.*)` is rewritten to `/api/index`. The original path (for example `/api/metrics`) still reaches FastAPI, so the routes match. All other paths fall back to `index.html` for the SPA.

```bash
npm i -g vercel
vercel            # preview deployment
vercel --prod     # production deployment
```

Or import the Git repository in the Vercel dashboard. All settings are read from `vercel.json`, so leave the Root Directory as the repository root. After deploying, update the **Live app** link at the top of this README.

## AI tools used

This assessment was built with **Claude Code** (Anthropic's agentic coding CLI). The work was split across **several Claude Code agents running in parallel**, all working against a shared API contract (`docs/api-contract.md`):

- a **backend agent** (FastAPI, pandas analytics, tests),
- a **frontend agent** (React, Vite, TypeScript, Tailwind UI and charts),
- an **infra/docs agent** (Dockerfiles, docker-compose, Vercel config, README and docs).

A human lead wrote the brief, checked the Elexon data facts against the live API, reviewed and integrated each agent's output, and made the final product and design decisions.

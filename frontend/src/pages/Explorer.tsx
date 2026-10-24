import { useMemo, useState } from "react";
import { CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../api";
import { makeTooltip } from "../components/ChartTooltip";
import { axisProps, compactMW, gridProps } from "../components/chartProps";
import { Card, CardHeader, ChartFrame, ErrorBox, Field, HorizonSlider, inputCls, Legend, PageHeader } from "../components/ui";
import { useApi, useDebounced } from "../hooks/useApi";
import { useChartColors } from "../hooks/useChartColors";
import { addDays, fmt1, fmtDay, fmtDayHM, fmtMW, fmtSigned, ymdToIso } from "../format";

const MIN_DATE = "2026-01-01";
const MAX_DATE = "2026-02-01";

interface Row {
  t: number;
  actual: number | null;
  forecast: number | null;
  horizon: number | null;
}

const tooltip = makeTooltip<Row>(
  (d) => `${fmtDayHM(d.t)} UTC`,
  (d) => [
    { label: "Actual", value: d.actual == null ? "—" : `${fmtMW(d.actual)} MW`, kind: "solid" },
    { label: "Forecast", value: d.forecast == null ? "—" : `${fmtMW(d.forecast)} MW`, kind: "dashed" },
    ...(d.forecast != null && d.actual != null
      ? [{ label: "Error", value: `${fmtSigned(d.forecast - d.actual)} MW`, kind: "none" as const }]
      : []),
    ...(d.horizon != null ? [{ label: "Horizon", value: `${fmt1(d.horizon)}h`, kind: "none" as const }] : []),
  ],
);

export function Explorer() {
  const [start, setStart] = useState("2026-01-08");
  const [end, setEnd] = useState("2026-01-14");
  const [horizon, setHorizon] = useState(4);
  const h = useDebounced(horizon, 250);
  const c = useChartColors();

  const valid = start <= end;
  const range = { start: ymdToIso(start), end: ymdToIso(addDays(end, 1)) };

  const actuals = useApi(valid ? (s) => api.actuals(range, s) : null, [start, end]);
  const forecasts = useApi(valid ? (s) => api.forecastsHorizon({ ...range, horizon_h: h }, s) : null, [start, end, h]);
  const metrics = useApi(valid ? (s) => api.metrics({ ...range, horizon_h: h }, s) : null, [start, end, h]);

  const rows = useMemo(() => {
    const map = new Map<number, Row>();
    for (const a of actuals.data ?? []) {
      const t = Date.parse(a.startTime);
      map.set(t, { t, actual: a.generation, forecast: null, horizon: null });
    }
    for (const f of forecasts.data ?? []) {
      const t = Date.parse(f.startTime);
      const r = map.get(t) ?? { t, actual: f.actual, forecast: null, horizon: null };
      r.forecast = f.forecast;
      r.horizon = f.horizon_h;
      map.set(t, r);
    }
    return [...map.values()].sort((a, b) => a.t - b.t);
  }, [actuals.data, forecasts.data]);

  const t0 = Date.parse(range.start);
  const t1 = Date.parse(range.end);
  const days = Math.round((t1 - t0) / 86400_000);
  const step = Math.max(1, Math.ceil(days / 8));
  const ticks = Array.from({ length: Math.floor(days / step) + 1 }, (_, i) => t0 + i * step * 86400_000);
  const m = metrics.data;
  const err = actuals.error ?? forecasts.error ?? metrics.error;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Forecast explorer"
        description="Half-hourly actual wind generation against the forecast that was available a fixed number of hours ahead."
      >
        <Field label="Start">
          <input type="date" className={`${inputCls} num`} min={MIN_DATE} max={MAX_DATE} value={start} onChange={(e) => e.target.value && setStart(e.target.value)} />
        </Field>
        <Field label="End">
          <input type="date" className={`${inputCls} num`} min={MIN_DATE} max={MAX_DATE} value={end} onChange={(e) => e.target.value && setEnd(e.target.value)} />
        </Field>
        <HorizonSlider value={horizon} onChange={setHorizon} />
      </PageHeader>

      {!valid && <ErrorBox message="Start date must be on or before end date." />}
      {err && <ErrorBox message={err} />}

      <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-border sm:grid-cols-5">
        {[
          ["Points", m ? fmtMW(m.n) : "—"],
          ["MAE", m ? `${fmtMW(m.mae)} MW` : "—"],
          ["RMSE", m ? `${fmtMW(m.rmse)} MW` : "—"],
          ["Bias", m ? `${fmtSigned(m.bias)} MW` : "—"],
          ["nMAE", m ? `${fmt1(m.nmae_pct)}%` : "—"],
        ].map(([k, v]) => (
          <div key={k} className="-mb-px -mr-px flex last:col-span-2 sm:last:col-span-1 flex-col gap-1 border-b border-r border-border bg-surface px-4 py-3">
            <span className="label">{k}</span>
            <span className="num text-base">{v}</span>
          </div>
        ))}
      </div>

      <Card>
        <CardHeader
          title="Actual vs forecast"
          subtitle={`${start} → ${end} · forecast published ≥ ${h}h before target · MW`}
          right={<Legend items={[{ label: "Actual (30 min)", kind: "solid" }, { label: `Forecast (+${h}h, hourly)`, kind: "dashed" }]} />}
        />
        <ChartFrame loading={actuals.loading || forecasts.loading} error={null} empty={!rows.length} height={380}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={rows} margin={{ top: 8, right: 24, bottom: 0, left: 0 }}>
              <CartesianGrid {...gridProps(c)} />
              <XAxis dataKey="t" type="number" scale="time" domain={[t0, t1]} ticks={ticks} tickFormatter={fmtDay} {...axisProps(c)} />
              <YAxis width={44} tickFormatter={compactMW} {...axisProps(c)} />
              <Tooltip content={tooltip} cursor={{ stroke: c.axis, strokeWidth: 1 }} />
              <Line dataKey="actual" stroke={c.fg} strokeWidth={1.75} dot={false} connectNulls isAnimationActive={false} activeDot={{ r: 4, fill: c.fg, stroke: c.surface, strokeWidth: 2 }} />
              <Line dataKey="forecast" stroke={c.forecast} strokeWidth={1.75} strokeDasharray="5 4" dot={false} connectNulls isAnimationActive={false} activeDot={{ r: 4, fill: c.forecast, stroke: c.surface, strokeWidth: 2 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartFrame>
      </Card>
    </div>
  );
}

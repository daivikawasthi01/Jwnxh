import { useMemo, useState } from "react";
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../api";
import { makeTooltip } from "../components/ChartTooltip";
import { axisProps, compactMW, gridProps } from "../components/chartProps";
import { Card, CardHeader, ChartFrame, ErrorBox, Field, IconButton, inputCls, Kpi, Legend, PageHeader } from "../components/ui";
import { useApi } from "../hooks/useApi";
import { useChartColors } from "../hooks/useChartColors";
import { fmt1, fmtDateTime, fmtGWh, fmtHM, fmtLongDate, fmtMW, fmtSigned } from "../format";
import type { Meta } from "../types";

interface Row {
  t: number;
  forecast: number;
  actual: number | null;
  band: [number, number];
  p10: number;
  p90: number;
  horizon: number;
}

const tooltip = makeTooltip<Row>(
  (d) => `${fmtHM(d.t)} UTC · +${fmt1(d.horizon)}h`,
  (d) => [
    { label: "Forecast", value: `${fmtMW(d.forecast)} MW`, kind: "dashed" },
    { label: "P10–P90", value: `${fmtMW(d.p10)}–${fmtMW(d.p90)}`, kind: "band" },
    { label: "Actual", value: d.actual == null ? "—" : `${fmtMW(d.actual)} MW`, kind: "solid" },
    ...(d.actual == null ? [] : [{ label: "Error", value: `${fmtSigned(d.forecast - d.actual)} MW`, kind: "none" as const }]),
  ],
);

export function DayAhead({ meta }: { meta: Meta }) {
  const dates = meta.delivery_dates;
  const [date, setDate] = useState(() => (dates.includes("2026-01-15") ? "2026-01-15" : dates[0]));
  const [cutoff, setCutoff] = useState(meta.default_cutoff);
  const idx = dates.indexOf(date);
  const c = useChartColors();

  const cutoffs = useMemo(() => {
    const set = new Set([meta.default_cutoff, ...meta.publish_times_utc]);
    return [...set].sort();
  }, [meta]);

  const { data, loading, error } = useApi((s) => api.dayAhead({ delivery_date: date, cutoff }, s), [date, cutoff]);

  const rows: Row[] = useMemo(
    () =>
      (data?.points ?? []).map((p) => ({
        t: Date.parse(p.startTime),
        forecast: p.forecast,
        actual: p.actual,
        band: [p.p10, p.p90],
        p10: p.p10,
        p90: p.p90,
        horizon: p.horizon_h,
      })),
    [data],
  );

  const s = data?.summary;
  const hMin = rows.length ? Math.min(...rows.map((r) => r.horizon)) : null;
  const hMax = rows.length ? Math.max(...rows.map((r) => r.horizon)) : null;
  const downside = s ? s.forecast_energy_mwh - s.p10_energy_mwh : null;
  const d0 = Date.parse(`${date}T00:00:00Z`);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Day-ahead position"
        description="What the latest wind forecast available before the auction said about each delivery day, and how wrong it might be."
      >
        <Field label="Delivery date">
          <div className="flex items-center gap-1.5">
            <IconButton label="Previous day" disabled={idx <= 0} onClick={() => setDate(dates[idx - 1])}>
              <Chevron dir="left" />
            </IconButton>
            <select className={`${inputCls} num`} value={date} onChange={(e) => setDate(e.target.value)}>
              {dates.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            <IconButton label="Next day" disabled={idx >= dates.length - 1} onClick={() => setDate(dates[idx + 1])}>
              <Chevron dir="right" />
            </IconButton>
          </div>
        </Field>
        <Field label="Decision cutoff (D−1, UTC)">
          <select className={`${inputCls} num`} value={cutoff} onChange={(e) => setCutoff(e.target.value)}>
            {cutoffs.map((t) => (
              <option key={t} value={t}>
                {t === meta.default_cutoff ? `${t} (default)` : t}
              </option>
            ))}
          </select>
        </Field>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
        <span className="text-fg">{fmtLongDate(date)}</span>
        <span aria-hidden="true">·</span>
        {data ? (
          <span className="num">
            Forecast run {fmtDateTime(data.publishTime)} UTC · horizon {fmt1(hMin)}–{fmt1(hMax)}h
          </span>
        ) : (
          <span>{loading ? "Loading forecast run…" : "—"}</span>
        )}
      </div>

      {error && <ErrorBox message={error} />}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Forecast wind energy" value={fmtGWh(s?.forecast_energy_mwh)} unit="GWh" sub="sum of 24 hourly MW" />
        <Kpi
          label="P10–P90 range"
          value={s ? `${fmtGWh(s.p10_energy_mwh)}–${fmtGWh(s.p90_energy_mwh)}` : "—"}
          unit="GWh"
          sub="out-of-sample error band"
        />
        <Kpi label="Peak / min forecast" value={s ? `${fmtMW(s.peak_forecast_mw)} / ${fmtMW(s.min_forecast_mw)}` : "—"} unit="MW" />
        {s?.actual_energy_mwh != null ? (
          <Kpi
            label="Actual energy"
            value={fmtGWh(s.actual_energy_mwh)}
            unit="GWh"
            sub={`MAE ${fmtMW(s.mae_mw)} MW · bias ${fmtSigned(s.bias_mw)} MW`}
          />
        ) : (
          <Kpi label="Actual energy" value="—" sub="actuals not yet available" />
        )}
      </div>

      {s && downside != null && (
        <div className="flex gap-3 rounded-lg border border-border bg-surface-2 px-4 py-3 text-sm">
          <InfoIcon />
          <p className="text-muted">
            <span className="text-fg">Plan to procure demand minus wind.</span> Wind could be{" "}
            <span className="num text-fg">{fmtGWh(downside)} GWh</span> lower than forecast (P10:{" "}
            <span className="num text-fg">{fmtGWh(s.p10_energy_mwh)} GWh</span>) — size the buy margin against that
            shortfall rather than the central forecast.
          </p>
        </div>
      )}

      <Card>
        <CardHeader
          title="Wind generation, delivery day"
          subtitle="Hourly average MW · UTC (= UK time in January)"
          right={
            <Legend
              items={[
                { label: "Actual", kind: "solid" },
                { label: "Forecast", kind: "dashed" },
                { label: "P10–P90", kind: "band" },
              ]}
            />
          }
        />
        <ChartFrame loading={loading} error={null} empty={!rows.length} height={340}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid {...gridProps(c)} />
              <XAxis
                dataKey="t"
                type="number"
                scale="time"
                domain={[d0, d0 + 23 * 3600_000]}
                ticks={Array.from({ length: 8 }, (_, i) => d0 + i * 3 * 3600_000)}
                tickFormatter={fmtHM}
                {...axisProps(c)}
              />
              <YAxis width={44} tickFormatter={compactMW} {...axisProps(c)} />
              <Tooltip content={tooltip} cursor={{ stroke: c.axis, strokeWidth: 1 }} />
              <Area dataKey="band" stroke="none" fill={c.band} fillOpacity={0.14} isAnimationActive={false} activeDot={false} />
              <Line dataKey="forecast" stroke={c.forecast} strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} activeDot={{ r: 4, fill: c.forecast, stroke: c.surface, strokeWidth: 2 }} />
              <Line dataKey="actual" stroke={c.fg} strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} activeDot={{ r: 4, fill: c.fg, stroke: c.surface, strokeWidth: 2 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartFrame>
      </Card>

      <p className="text-xs text-muted">
        The day-ahead auction gate is ~09:20 UK on D−1, so with a 09:00 cutoff the trader uses the 07:30 UTC run (16–40h ahead
        of delivery). All 24 hours come from that single run. The P10–P90 band applies the January distribution of day-ahead
        errors at the same cutoff, excluding this delivery date.
      </p>
    </div>
  );
}

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d={dir === "left" ? "M10 3 5 8l5 5" : "M6 3l5 5-5 5"} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg viewBox="0 0 16 16" className="mt-0.5 size-4 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
      <circle cx="8" cy="8" r="6.5" />
      <path d="M8 7.25V11M8 5v.01" strokeLinecap="round" />
    </svg>
  );
}

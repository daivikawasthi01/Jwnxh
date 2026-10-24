import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../api";
import { makeTooltip } from "../components/ChartTooltip";
import { axisProps, compactMW, gridProps } from "../components/chartProps";
import { Card, CardHeader, ChartFrame, ErrorBox, HorizonSlider, Kpi, Legend, PageHeader } from "../components/ui";
import { useApi, useDebounced } from "../hooks/useApi";
import { useChartColors } from "../hooks/useChartColors";
import { fmt1, fmtMW, fmtSigned } from "../format";
import type { HistogramBin, HorizonCurvePoint, HourlyPoint } from "../types";

const curveTip = makeTooltip<HorizonCurvePoint>(
  (d) => `Horizon ${d.horizon_h}h · n=${fmtMW(d.n)}`,
  (d) => [
    { label: "MAE", value: `${fmtMW(d.mae)} MW`, kind: "solid" },
    { label: "P90 |error|", value: `${fmtMW(d.p90_abs_error)} MW`, kind: "dashed" },
    { label: "Bias", value: `${fmtSigned(d.bias)} MW`, kind: "none" },
  ],
);

const hourlyTip = makeTooltip<HourlyPoint>(
  (d) => `${String(d.hour).padStart(2, "0")}:00 UTC · n=${d.n}`,
  (d) => [
    { label: "MAE", value: `${fmtMW(d.mae)} MW`, kind: "bar" },
    { label: "Bias", value: `${fmtSigned(d.bias)} MW`, kind: "none" },
  ],
);

type HistRow = HistogramBin & { mid: number };
const histTip = makeTooltip<HistRow>(
  (d) => `${fmtSigned(d.bin_start)} to ${fmtSigned(d.bin_end)} MW`,
  (d) => [{ label: "Hours", value: fmtMW(d.count), kind: "bar" }],
);

export function Accuracy() {
  const [horizon, setHorizon] = useState(4);
  const h = useDebounced(horizon, 250);
  const c = useChartColors();

  const metrics = useApi((s) => api.metrics({ horizon_h: h }, s), [h]);
  const curve = useApi((s) => api.horizonCurve({}, s).then((pts) => pts.filter((p) => p.n > 0)), []);
  const hourly = useApi((s) => api.hourly({ horizon_h: h }, s), [h]);
  const m = metrics.data;

  const hist: HistRow[] = useMemo(
    () => (m?.histogram ?? []).map((b) => ({ ...b, mid: (b.bin_start + b.bin_end) / 2 })),
    [m],
  );
  const err = metrics.error ?? curve.error ?? hourly.error;
  const ax = axisProps(c);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Forecast accuracy"
        description="How large wind forecast errors were across January 2026, by lead time and time of day. Use these to size the buying margin."
      >
        <HorizonSlider value={horizon} onChange={setHorizon} />
      </PageHeader>

      {err && <ErrorBox message={err} />}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <Kpi label="MAE" value={fmtMW(m?.mae)} unit="MW" sub={m ? `n = ${fmtMW(m.n)} hours` : undefined} />
        <Kpi label="RMSE" value={fmtMW(m?.rmse)} unit="MW" />
        <Kpi label="Bias" value={fmtSigned(m?.bias)} unit="MW" sub={m?.bias != null ? (m.bias > 0 ? "over-forecast on average" : "under-forecast on average") : undefined} />
        <Kpi label="P90 |error|" value={fmtMW(m?.p90_abs_error)} unit="MW" sub={m ? `P99 ${fmtMW(m.p99_abs_error)} MW` : undefined} />
        <Kpi label="nMAE" value={fmt1(m?.nmae_pct)} unit="%" sub={m ? `of mean ${fmtMW(m.mean_actual)} MW` : undefined} />
      </div>

      <Card>
        <CardHeader
          title="Error vs forecast horizon"
          subtitle="January 2026 · each target uses the latest forecast published at least H hours earlier"
          right={<Legend items={[{ label: "MAE", kind: "solid" }, { label: "P90 |error|", kind: "dashed" }]} />}
        />
        <ChartFrame loading={curve.loading} error={null} empty={!curve.data?.length} height={300}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={curve.data ?? []} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid {...gridProps(c)} />
              <XAxis dataKey="horizon_h" type="number" domain={[0, 48]} ticks={[0, 6, 12, 18, 24, 30, 36, 42, 48]} tickFormatter={(v) => `${v}h`} {...ax} />
              <YAxis width={44} tickFormatter={compactMW} {...ax} />
              <Tooltip content={curveTip} cursor={{ stroke: c.axis, strokeWidth: 1 }} />
              <ReferenceLine x={h} stroke={c.axis} strokeDasharray="2 3" />
              <Line dataKey="mae" stroke={c.fg} strokeWidth={2} dot={false} isAnimationActive={false} activeDot={{ r: 4, fill: c.fg, stroke: c.surface, strokeWidth: 2 }} />
              <Line dataKey="p90_abs_error" stroke={c.forecast} strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} activeDot={{ r: 4, fill: c.forecast, stroke: c.surface, strokeWidth: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartFrame>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="MAE by hour of day" subtitle={`Horizon ${h}h · UTC hour of target`} />
          <ChartFrame loading={hourly.loading} error={null} empty={!hourly.data?.length} height={260}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourly.data ?? []} margin={{ top: 8, right: 12, bottom: 0, left: 0 }} barCategoryGap={2}>
                <CartesianGrid {...gridProps(c)} />
                <XAxis dataKey="hour" interval={2} tickFormatter={(v) => String(v).padStart(2, "0")} {...ax} />
                <YAxis width={44} tickFormatter={compactMW} {...ax} />
                <Tooltip content={hourlyTip} cursor={{ fill: c.grid }} />
                <Bar dataKey="mae" fill={c.bar} radius={[3, 3, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </ChartFrame>
        </Card>

        <Card>
          <CardHeader title="Error distribution" subtitle={`Horizon ${h}h · forecast − actual, 500 MW bins`} />
          <ChartFrame loading={metrics.loading} error={null} empty={!hist.length} height={260}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hist} margin={{ top: 8, right: 12, bottom: 0, left: 0 }} barCategoryGap={1}>
                <CartesianGrid {...gridProps(c)} />
                <XAxis dataKey="mid" type="number" domain={["dataMin - 250", "dataMax + 250"]} tickFormatter={compactMW} {...ax} />
                <YAxis width={36} allowDecimals={false} {...ax} />
                <Tooltip content={histTip} cursor={{ fill: c.grid }} />
                <ReferenceLine x={0} stroke={c.axis} />
                <Bar dataKey="count" fill={c.bar} radius={[3, 3, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </ChartFrame>
        </Card>
      </div>

      <Card className="px-4 py-4 sm:px-5">
        <h2 className="label mb-3">Definitions</h2>
        <dl className="grid gap-x-8 gap-y-2 text-xs text-muted sm:grid-cols-2">
          <Def k="Error">forecast − actual (MW). Positive = wind over-forecast, so the desk under-buys.</Def>
          <Def k="Horizon">Hours between the forecast’s publish time and the target hour. At horizon H we use the latest run published ≥ H hours before the target (max 48h).</Def>
          <Def k="MAE">Mean of |error|. Typical size of a miss.</Def>
          <Def k="RMSE">Root-mean-square error; penalises large misses more than MAE.</Def>
          <Def k="Bias">Mean of error. Systematic over (+) or under (−) forecasting.</Def>
          <Def k="P90 |error|">90% of hours had an absolute error below this — a practical margin size.</Def>
          <Def k="nMAE">MAE as % of mean actual generation over the window.</Def>
          <Def k="Matching">Forecasts are hourly; compared with the on-the-hour half-hourly actual.</Def>
        </dl>
      </Card>
    </div>
  );
}

function Def({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="w-24 shrink-0 font-medium text-fg">{k}</dt>
      <dd>{children}</dd>
    </div>
  );
}

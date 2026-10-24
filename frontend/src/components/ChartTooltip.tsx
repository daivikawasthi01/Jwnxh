import type { TooltipProps } from "recharts";

export interface TooltipRow {
  label: string;
  value: string;
  kind?: "solid" | "dashed" | "band" | "bar" | "none";
}

/** Generic Recharts tooltip card; `rows` builds the content from the hovered datum. */
export function makeTooltip<T>(title: (d: T) => string, rows: (d: T) => TooltipRow[]) {
  return function ChartTooltip({ active, payload }: TooltipProps<number, string>) {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload as T;
    return (
      <div className="min-w-44 rounded-lg border border-border bg-bg/95 px-3 py-2.5 shadow-lg shadow-black/10 backdrop-blur">
        <div className="num mb-1.5 text-xs text-muted">{title(d)}</div>
        <dl className="flex flex-col gap-1">
          {rows(d).map((r) => (
            <div key={r.label} className="flex items-center justify-between gap-6 text-xs">
              <dt className="flex items-center gap-1.5 text-muted">
                {r.kind && r.kind !== "none" && <Mark kind={r.kind} />}
                {r.label}
              </dt>
              <dd className="num text-fg">{r.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    );
  };
}

function Mark({ kind }: { kind: NonNullable<TooltipRow["kind"]> }) {
  if (kind === "band") return <span className="h-2 w-3 rounded-sm bg-muted/30" />;
  if (kind === "bar") return <span className="size-2 rounded-sm bg-muted" />;
  return (
    <svg width="12" height="4" aria-hidden="true">
      <line x1="0" y1="2" x2="12" y2="2" strokeWidth="2" className={kind === "solid" ? "stroke-fg" : "stroke-subtle"} strokeDasharray={kind === "dashed" ? "3 2" : undefined} />
    </svg>
  );
}

import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-lg border border-border bg-surface ${className}`}>{children}</section>;
}

export function CardHeader({ title, subtitle, right }: { title: string; subtitle?: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
      <div className="min-w-0">
        <h2 className="text-sm font-medium">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

export function Kpi({ label, value, unit, sub }: { label: string; value: ReactNode; unit?: string; sub?: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-lg border border-border bg-surface p-4">
      <span className="label">{label}</span>
      <span className="num truncate text-2xl font-medium tracking-tight">
        {value}
        {unit && <span className="ml-1 text-sm font-normal text-muted">{unit}</span>}
      </span>
      {sub && <span className="num truncate text-xs text-muted">{sub}</span>}
    </div>
  );
}

export function PageHeader({ title, description, children }: { title: string; description: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p>
      </div>
      {children && <div className="flex flex-wrap items-end gap-3">{children}</div>}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

export const inputCls =
  "h-9 rounded-md border border-border bg-bg px-3 text-sm text-fg outline-none transition-colors hover:border-border-strong focus-visible:border-fg";

export function IconButton({ onClick, disabled, label, children }: { onClick: () => void; disabled?: boolean; label: string; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="grid size-9 cursor-pointer place-items-center rounded-md border border-border bg-bg text-muted transition-colors hover:border-border-strong hover:text-fg disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

export function HorizonSlider({ value, onChange, max = 48 }: { value: number; onChange: (v: number) => void; max?: number }) {
  return (
    <label className="flex min-w-56 flex-col gap-1.5">
      <span className="flex items-baseline justify-between gap-4">
        <span className="label">Forecast horizon</span>
        <span className="num text-sm">{value}h</span>
      </span>
      <input
        type="range"
        min={0}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-9 w-full cursor-pointer"
        aria-label="Forecast horizon in hours"
      />
    </label>
  );
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div role="alert" className="rounded-lg border border-border bg-surface-2 px-4 py-3 text-sm">
      <span className="font-medium">Couldn’t load data.</span> <span className="num text-muted">{message}</span>
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-hover ${className}`} />;
}

export function ChartFrame({ loading, error, empty, height = 320, children }: {
  loading: boolean;
  error: string | null;
  empty?: boolean;
  height?: number;
  children: ReactNode;
}) {
  return (
    <div className="relative px-1 pb-3 pt-4 sm:px-3" style={{ height }}>
      {error ? (
        <div className="grid h-full place-items-center px-4 text-center text-sm text-muted">{error}</div>
      ) : empty && !loading ? (
        <div className="grid h-full place-items-center text-sm text-muted">No data for this selection.</div>
      ) : (
        children
      )}
      {loading && (
        <div className="pointer-events-none absolute right-4 top-3 flex items-center gap-2 text-xs text-muted">
          <span className="size-1.5 animate-pulse rounded-full bg-muted" /> Loading
        </div>
      )}
    </div>
  );
}

export type LegendItem = { label: string; kind: "solid" | "dashed" | "band" | "bar" };

export function Legend({ items }: { items: LegendItem[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <Swatch kind={i.kind} />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

function Swatch({ kind }: { kind: LegendItem["kind"] }) {
  if (kind === "band") return <span className="h-2.5 w-4 rounded-sm bg-muted/25" />;
  if (kind === "bar") return <span className="h-2.5 w-2.5 rounded-sm bg-muted" />;
  return (
    <svg width="18" height="4" aria-hidden="true">
      <line
        x1="0" y1="2" x2="18" y2="2"
        strokeWidth="2"
        className={kind === "solid" ? "stroke-fg" : "stroke-subtle"}
        strokeDasharray={kind === "dashed" ? "4 3" : undefined}
      />
    </svg>
  );
}

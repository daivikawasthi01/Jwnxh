export type TabId = "day-ahead" | "explorer" | "accuracy";

export const TABS: { id: TabId; label: string }[] = [
  { id: "day-ahead", label: "Day-Ahead" },
  { id: "explorer", label: "Explorer" },
  { id: "accuracy", label: "Accuracy" },
];

export function Nav({ tab, onTab }: { tab: TabId; onTab: (t: TabId) => void }) {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-bg/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:px-6">
        <span className="truncate text-sm font-medium">GridBricks</span>
        <Slash />
        <span className="truncate text-sm text-muted">Wind Forecast Monitor</span>
        <span className="ml-auto hidden rounded-full border border-border px-2 py-0.5 text-xs text-muted sm:inline">
          GB · Jan 2026
        </span>
      </div>
      <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-2 sm:px-4" aria-label="Sections">
        {TABS.map((t) => {
          const active = t.id === tab;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onTab(t.id)}
              aria-current={active ? "page" : undefined}
              className={`relative cursor-pointer px-3 pb-3 pt-2 text-sm transition-colors ${
                active ? "text-fg" : "text-muted hover:text-fg"
              }`}
            >
              <span className="rounded-md px-1 py-1">{t.label}</span>
              {active && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-fg" />}
            </button>
          );
        })}
      </nav>
    </header>
  );
}

function Slash() {
  return (
    <svg viewBox="0 0 24 24" className="size-5 shrink-0 stroke-border-strong" fill="none" aria-hidden="true">
      <path d="M16.88 3.549 7.12 20.451" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

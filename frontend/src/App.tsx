import { useEffect, useState } from "react";
import { api } from "./api";
import { Nav, TABS, type TabId } from "./components/Nav";
import { ErrorBox, Skeleton } from "./components/ui";
import { useApi } from "./hooks/useApi";
import { Accuracy } from "./pages/Accuracy";
import { DayAhead } from "./pages/DayAhead";
import { Explorer } from "./pages/Explorer";

const readHash = (): TabId => {
  const h = window.location.hash.replace("#", "") as TabId;
  return TABS.some((t) => t.id === h) ? h : "day-ahead";
};

export default function App() {
  const [tab, setTab] = useState<TabId>(readHash);
  const meta = useApi((s) => api.meta(s), []);

  useEffect(() => {
    const on = () => setTab(readHash());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);

  const go = (t: TabId) => {
    window.location.hash = t;
    setTab(t);
  };

  return (
    <div className="min-h-dvh overflow-x-clip bg-bg text-fg">
      <Nav tab={tab} onTab={go} />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {tab === "day-ahead" &&
          (meta.data ? (
            <DayAhead meta={meta.data} />
          ) : meta.error ? (
            <ErrorBox message={meta.error} />
          ) : (
            <div className="flex flex-col gap-4">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-24" />
              <Skeleton className="h-80" />
            </div>
          ))}
        {tab === "explorer" && <Explorer />}
        {tab === "accuracy" && <Accuracy />}
      </main>
      <footer className="mx-auto max-w-6xl border-t border-border px-4 py-6 text-xs text-muted sm:px-6">
        Data: Elexon BMRS FUELHH (actual) and WINDFOR (forecast), GB national wind. Times in UTC.
      </footer>
    </div>
  );
}

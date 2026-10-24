const nf0 = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("en-GB", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const fmtMW = (v: number | null | undefined) => (v == null ? "—" : nf0.format(v));
export const fmt1 = (v: number | null | undefined) => (v == null ? "—" : nf1.format(v));
export const fmtGWh = (mwh: number | null | undefined) => (mwh == null ? "—" : nf1.format(mwh / 1000));
export const fmtSigned = (v: number | null | undefined) =>
  v == null ? "—" : `${v > 0 ? "+" : v < 0 ? "−" : ""}${nf0.format(Math.abs(v))}`;

/** "2026-01-14T07:30:00Z" -> "2026-01-14 07:30" */
export const fmtDateTime = (iso: string) => iso.replace("T", " ").slice(0, 16);
export const fmtHM = (ms: number) => new Date(ms).toISOString().slice(11, 16);
export const fmtDayHM = (ms: number) => {
  const d = new Date(ms);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.toISOString().slice(11, 16)}`;
};
export const fmtDay = (ms: number) => {
  const d = new Date(ms);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
};
export const fmtLongDate = (ymd: string) => {
  const d = new Date(`${ymd}T00:00:00Z`);
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const addDays = (ymd: string, n: number) => {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
export const ymdToIso = (ymd: string) => `${ymd}T00:00:00Z`;

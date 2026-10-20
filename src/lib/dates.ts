// Datele circulă în aplicație ca text ISO (yyyy-mm-dd), fără oră și fără fus orar.
// În Sheet se scriu ca număr de serie (zile de la 30.12.1899), ca să fie date reale
// pe care formulele (ex: zile până la nuntă) le pot folosi.

const MS_DAY = 86_400_000;
const SHEETS_EPOCH = Date.UTC(1899, 11, 30);

export function isoToSerial(iso: string): number | "" {
  const t = parseIso(iso);
  return t === null ? "" : Math.round((t - SHEETS_EPOCH) / MS_DAY);
}

export function serialToIso(serial: number): string {
  return new Date(SHEETS_EPOCH + Math.round(serial) * MS_DAY).toISOString().slice(0, 10);
}

function parseIso(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  return Date.UTC(+m[1], +m[2] - 1, +m[3]);
}

// Acceptă ce poate veni din Sheet: număr de serie, ISO sau dd.mm.yyyy / dd/mm/yyyy scris de mână.
export function toIso(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) return serialToIso(value);
  if (typeof value !== "string") return "";
  const s = value.trim();
  if (!s) return "";
  if (parseIso(s) !== null) return s;
  const m = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(s);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return "";
}

export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Zile de azi până la data dată (negativ = în trecut). null dacă data lipsește. */
export function daysUntil(iso: string, from = todayIso()): number | null {
  const a = parseIso(from);
  const b = parseIso(iso);
  if (a === null || b === null) return null;
  return Math.round((b - a) / MS_DAY);
}

export function addMonths(iso: string, months: number): string {
  const t = parseIso(iso);
  if (t === null) return "";
  const d = new Date(t);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const t = parseIso(iso);
  return t === null ? "" : new Date(t + days * MS_DAY).toISOString().slice(0, 10);
}

const MONTHS = ["ian.", "feb.", "mar.", "apr.", "mai", "iun.", "iul.", "aug.", "sept.", "oct.", "nov.", "dec."];

export function formatDate(iso: string): string {
  const t = parseIso(iso);
  if (t === null) return "";
  const d = new Date(t);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function relativeDays(days: number): string {
  if (days === 0) return "azi";
  if (days === 1) return "mâine";
  if (days === -1) return "ieri";
  if (days > 0) return `în ${days} zile`;
  return `acum ${-days} zile`;
}

import { newId } from "./ids";
import type { Forma, Guest, Table, TipElement } from "./types";

// Geometria planului sălii. Unitățile sunt pixeli la zoom 100%; x/y = colțul stânga-sus
// al elementului nerotit, iar rotirea se face în jurul centrului.

const SEAT_GAP = 6; // distanța dintre masă și loc
export const GRID = 20;
export const MIN_SIZE = 40;
export const ZOOM_MIN = 0.3;
export const ZOOM_MAX = 2.5;

/** Ce scriem în bulina unui loc; locurile cresc ca să încapă textul. */
export type LabelMode = "initiale" | "scurt" | "complet";
export const SEAT_SIZE: Record<LabelMode, number> = { initiale: 34, scurt: 52, complet: 66 };
export const LABEL_MODES: { value: LabelMode; label: string }[] = [
  { value: "initiale", label: "AB" },
  { value: "scurt", label: "Prenume" },
  { value: "complet", label: "Nume întreg" },
];

export interface Preset {
  label: string;
  tip: TipElement;
  forma: Forma;
  locuri: number;
  latime: number;
  inaltime: number;
  nume: (n: number) => string;
}

export const PRESETS: Preset[] = [
  { label: "Masă rotundă", tip: "Masă", forma: "Rotundă", locuri: 10, latime: 130, inaltime: 130, nume: (n) => `Masa ${n}` },
  { label: "Masă pătrată", tip: "Masă", forma: "Dreptunghiulară", locuri: 8, latime: 110, inaltime: 110, nume: (n) => `Masa ${n}` },
  { label: "Masă dreptunghiulară", tip: "Masă", forma: "Dreptunghiulară", locuri: 10, latime: 220, inaltime: 80, nume: (n) => `Masa ${n}` },
  { label: "Masa mirilor", tip: "Masa mirilor", forma: "Dreptunghiulară", locuri: 4, latime: 260, inaltime: 70, nume: () => "Masa mirilor" },
  { label: "Scenă", tip: "Scenă", forma: "Dreptunghiulară", locuri: 0, latime: 240, inaltime: 120, nume: () => "Scenă" },
  { label: "Scena formației", tip: "Scena formației", forma: "Dreptunghiulară", locuri: 0, latime: 200, inaltime: 100, nume: () => "Scena formației" },
  { label: "Ring de dans", tip: "Ring de dans", forma: "Dreptunghiulară", locuri: 0, latime: 260, inaltime: 200, nume: () => "Ring de dans" },
];

export function makeElement(p: Preset, x: number, y: number, tableCount: number): Table {
  return {
    id: newId(),
    nume: p.nume(tableCount + 1),
    tip: p.tip,
    forma: p.forma,
    locuri: p.locuri,
    x: Math.round(x - p.latime / 2),
    y: Math.round(y - p.inaltime / 2),
    latime: p.latime,
    inaltime: p.inaltime,
    rotatie: 0,
    note: "",
  };
}

export const rotation = (t: Table) => normalizeAngle(t.rotatie || 0);
export const normalizeAngle = (deg: number) => ((Math.round(deg) % 360) + 360) % 360;

/** Pozițiile centrelor locurilor, relativ la colțul stânga-sus al mesei (înainte de rotire). */
export function seatPositions(t: Table, seat: number): { x: number; y: number }[] {
  const n = Math.max(0, t.locuri);
  const w = t.latime;
  const h = t.inaltime;
  const o = SEAT_GAP + seat / 2;
  if (!n) return [];

  if (t.forma === "Rotundă") {
    // cercul de locuri se lărgește dacă locurile nu încap unul lângă altul
    const needed = (n * (seat + 4)) / (2 * Math.PI);
    const grow = Math.max(1, needed / ((w + h) / 4 + o));
    const rx = (w / 2 + o) * grow;
    const ry = (h / 2 + o) * grow;
    return Array.from({ length: n }, (_, i) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      return { x: w / 2 + rx * Math.cos(a), y: h / 2 + ry * Math.sin(a) };
    });
  }

  // Masa mirilor: toți stau pe o singură latură, cu fața spre sală (dacă nu încap, ies puțin în lateral)
  if (t.tip === "Masa mirilor") {
    const step = Math.max(w / n, seat + 4);
    const start = w / 2 - (step * n) / 2;
    return Array.from({ length: n }, (_, i) => ({ x: start + (i + 0.5) * step, y: -o }));
  }

  // Dreptunghi: locurile se împart egal pe perimetru, în sensul acelor de ceasornic.
  // Dacă nu încap, le așezăm pe un dreptunghi puțin mai mare decât masa.
  const e = Math.max(0, (n * (seat + 4) - 2 * (w + h)) / 8);
  const W = w + 2 * e;
  const H = h + 2 * e;
  const P = 2 * (W + H);
  return Array.from({ length: n }, (_, i) => {
    const d = ((i + 0.5) * P) / n;
    let p: { x: number; y: number };
    if (d < W) p = { x: d, y: -o };
    else if (d < W + H) p = { x: W + o, y: d - W };
    else if (d < 2 * W + H) p = { x: W - (d - W - H), y: H + o };
    else p = { x: -o, y: H - (d - 2 * W - H) };
    return { x: p.x - e, y: p.y - e };
  });
}

export const snap = (v: number, on: boolean) => (on ? Math.round(v / GRID) * GRID : Math.round(v));

/** Dreptunghiul ocupat pe plan de un element rotit (cu tot cu locuri). */
function extent(e: Table, seat: number) {
  const pad = e.locuri > 0 ? seat + SEAT_GAP : 0;
  const w = e.latime + 2 * pad;
  const h = e.inaltime + 2 * pad;
  const a = (rotation(e) * Math.PI) / 180;
  const W = Math.abs(w * Math.cos(a)) + Math.abs(h * Math.sin(a));
  const H = Math.abs(w * Math.sin(a)) + Math.abs(h * Math.cos(a));
  const cx = e.x + e.latime / 2;
  const cy = e.y + e.inaltime / 2;
  return { minX: cx - W / 2, minY: cy - H / 2, maxX: cx + W / 2, maxY: cy + H / 2 };
}

/** Dimensiunea planului: cel puțin 1400×900, extinsă ca să încapă toate elementele. */
export function boardSize(elements: Table[], seat: number) {
  let w = 1400;
  let h = 900;
  for (const e of elements) {
    const b = extent(e, seat);
    w = Math.max(w, b.maxX + 300);
    h = Math.max(h, b.maxY + 300);
  }
  return { w: Math.ceil(w), h: Math.ceil(h) };
}

/** Marginile tuturor elementelor (inclusiv locurile), pentru „încadrează tot”. */
export function contentBounds(elements: Table[], seat: number) {
  if (!elements.length) return null;
  const all = elements.map((e) => extent(e, seat));
  return {
    minX: Math.min(...all.map((b) => b.minX)),
    minY: Math.min(...all.map((b) => b.minY)),
    maxX: Math.max(...all.map((b) => b.maxX)),
    maxY: Math.max(...all.map((b) => b.maxY)),
  };
}

const cleanName = (name: string) => name.replace(/\(.*?\)/g, "").replace(/\s+/g, " ").trim();
const SKIP = new Set(["familia", "fam.", "fam", "dl.", "dl", "dna.", "dna", "d-na", "d-l"]);

export function initials(name: string): string {
  const words = cleanName(name).split(" ").filter((w) => /\p{L}/u.test(w) && w.toLowerCase() !== "și");
  if (!words.length) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/** Primul cuvânt relevant: „Elena Popescu” → „Elena”, „Familia Constantin” → „Constantin”. */
export function shortName(name: string): string {
  const words = cleanName(name).split(" ").filter(Boolean);
  return words.find((w) => !SKIP.has(w.toLowerCase())) ?? words[0] ?? "?";
}

export function seatLabel(g: Guest, kind: "principal" | "insotitor" | "copil", mode: LabelMode): string {
  if (kind !== "principal") {
    if (mode === "initiale") return kind === "copil" ? "c" : "+";
    return kind === "copil" ? "copil" : `+ ${shortName(g.nume)}`;
  }
  if (mode === "initiale") return initials(g.nume);
  if (mode === "scurt") return shortName(g.nume);
  return cleanName(g.nume);
}

import { newId } from "./ids";
import type { Forma, Table, TipElement } from "./types";

// Geometria planului sălii. Unitățile sunt pixeli la zoom 100%; x/y = colțul stânga-sus.

export const SEAT = 34; // diametrul unui loc
const SEAT_GAP = 6; // distanța dintre masă și loc
export const GRID = 20;
export const MIN_SIZE = 40;

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
    note: "",
  };
}

/** Pozițiile centrelor locurilor, relativ la colțul stânga-sus al mesei. */
export function seatPositions(t: Table): { x: number; y: number }[] {
  const n = Math.max(0, t.locuri);
  const w = t.latime;
  const h = t.inaltime;
  const o = SEAT_GAP + SEAT / 2;
  if (!n) return [];

  if (t.forma === "Rotundă") {
    const rx = w / 2 + o;
    const ry = h / 2 + o;
    return Array.from({ length: n }, (_, i) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      return { x: w / 2 + rx * Math.cos(a), y: h / 2 + ry * Math.sin(a) };
    });
  }

  // Masa mirilor: toți stau pe o singură latură, cu fața spre sală
  if (t.tip === "Masa mirilor") {
    return Array.from({ length: n }, (_, i) => ({ x: ((i + 0.5) * w) / n, y: -o }));
  }

  // Dreptunghi: locurile se împart egal pe perimetru, în sensul acelor de ceasornic
  const P = 2 * (w + h);
  return Array.from({ length: n }, (_, i) => {
    const d = ((i + 0.5) * P) / n;
    if (d < w) return { x: d, y: -o };
    if (d < w + h) return { x: w + o, y: d - w };
    if (d < 2 * w + h) return { x: w - (d - w - h), y: h + o };
    return { x: -o, y: h - (d - 2 * w - h) };
  });
}

export const snap = (v: number, on: boolean) => (on ? Math.round(v / GRID) * GRID : Math.round(v));

/** Dimensiunea planului: cel puțin 1400×900, extinsă ca să încapă toate elementele. */
export function boardSize(elements: Table[]) {
  let w = 1400;
  let h = 900;
  for (const e of elements) {
    w = Math.max(w, e.x + e.latime + 300);
    h = Math.max(h, e.y + e.inaltime + 300);
  }
  return { w, h };
}

/** Marginile tuturor elementelor (inclusiv locurile), pentru „încadrează tot”. */
export function contentBounds(elements: Table[]) {
  if (!elements.length) return null;
  const pad = SEAT + SEAT_GAP;
  return {
    minX: Math.min(...elements.map((e) => e.x)) - pad,
    minY: Math.min(...elements.map((e) => e.y)) - pad,
    maxX: Math.max(...elements.map((e) => e.x + e.latime)) + pad,
    maxY: Math.max(...elements.map((e) => e.y + e.inaltime)) + pad,
  };
}

export function initials(name: string): string {
  const words = name.replace(/\(.*?\)/g, "").trim().split(/\s+/).filter((w) => /\p{L}/u.test(w));
  if (!words.length) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

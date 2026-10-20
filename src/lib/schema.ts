import {
  FORMA, MONEDE, PARTE, RSVP, STATUS_COST, STATUS_SARCINA, TIP_COST, TIP_ELEMENT,
  type EntityMap, type Settings, type TableKey,
} from "./types";
import { isoToSerial, toIso } from "./dates";

// Structura Sheet-ului. Coloanele scrise de aplicație sunt primele (A..), iar coloanele
// calculate (formule ARRAYFORMULA în rândul de antet) vin după ele: aplicația nu le
// scrie niciodată, doar oamenii care deschid Sheet-ul le văd. Literele coloanelor din
// formule se calculează din listele de mai jos, ca o coloană nouă să nu strice formulele.

export const SCHEMA_VERSION = "1";
export const APP_PROPERTY = "planificatorNunta";

export type ColType = "text" | "number" | "optNumber" | "date" | "bool" | "enum";

export interface Col<T> {
  key: keyof T & string;
  header: string;
  type: ColType;
  options?: readonly string[];
  width?: number;
}

export interface Computed {
  header: string;
  formula: string;
  width?: number;
  format?: "money" | "int";
}

export interface TableDef<K extends TableKey> {
  key: K;
  tab: string;
  color: string;
  cols: Col<EntityMap[K]>[];
  computed: Computed[];
}

export function colLetter(index: number): string {
  let s = "";
  let n = index + 1;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

// ---------- coloane ----------

const GUEST_COLS: Col<EntityMap["guests"]>[] = [
  { key: "id", header: "ID", type: "text", width: 90 },
  { key: "nume", header: "Nume", type: "text", width: 200 },
  { key: "grup", header: "Grup / familie", type: "text", width: 150 },
  { key: "parte", header: "Partea", type: "enum", options: PARTE, width: 90 },
  { key: "rsvp", header: "RSVP", type: "enum", options: RSVP, width: 100 },
  { key: "insotitori", header: "Însoțitori (adulți)", type: "number", width: 110 },
  { key: "copii", header: "Copii", type: "number", width: 70 },
  { key: "restrictii", header: "Restricții alimentare", type: "text", width: 160 },
  { key: "telefon", header: "Telefon", type: "text", width: 120 },
  { key: "masaId", header: "Masă (ID)", type: "text", width: 90 },
  { key: "loc", header: "Loc", type: "optNumber", width: 50 },
  { key: "note", header: "Note", type: "text", width: 200 },
];

const TABLE_COLS: Col<EntityMap["tables"]>[] = [
  { key: "id", header: "ID", type: "text", width: 90 },
  { key: "nume", header: "Nume", type: "text", width: 160 },
  { key: "tip", header: "Tip", type: "enum", options: TIP_ELEMENT, width: 130 },
  { key: "forma", header: "Formă", type: "enum", options: FORMA, width: 120 },
  { key: "locuri", header: "Locuri", type: "number", width: 70 },
  { key: "x", header: "X", type: "number", width: 60 },
  { key: "y", header: "Y", type: "number", width: 60 },
  { key: "latime", header: "Lățime", type: "number", width: 70 },
  { key: "inaltime", header: "Înălțime", type: "number", width: 70 },
  { key: "rotatie", header: "Rotire (°)", type: "number", width: 70 },
  { key: "note", header: "Note", type: "text", width: 200 },
];

const COST_COLS: Col<EntityMap["costs"]>[] = [
  { key: "id", header: "ID", type: "text", width: 90 },
  { key: "categorie", header: "Categorie", type: "text", width: 150 },
  { key: "furnizor", header: "Furnizor", type: "text", width: 180 },
  { key: "contact", header: "Contact", type: "text", width: 150 },
  { key: "tip", header: "Tip cost", type: "enum", options: TIP_COST, width: 110 },
  { key: "moneda", header: "Monedă", type: "enum", options: MONEDE, width: 75 },
  { key: "estimat", header: "Estimat", type: "number", width: 100 },
  { key: "contractat", header: "Preț final", type: "optNumber", width: 100 },
  { key: "status", header: "Status", type: "enum", options: STATUS_COST, width: 130 },
  { key: "note", header: "Note", type: "text", width: 200 },
];

const PAYMENT_COLS: Col<EntityMap["payments"]>[] = [
  { key: "id", header: "ID", type: "text", width: 90 },
  { key: "costId", header: "Cost (ID)", type: "text", width: 90 },
  { key: "descriere", header: "Descriere", type: "text", width: 150 },
  { key: "suma", header: "Sumă", type: "number", width: 100 },
  { key: "moneda", header: "Monedă", type: "enum", options: MONEDE, width: 75 },
  { key: "scadenta", header: "Scadență", type: "date", width: 110 },
  { key: "platit", header: "Plătit", type: "bool", width: 70 },
  { key: "dataPlata", header: "Data plății", type: "date", width: 110 },
  { key: "note", header: "Note", type: "text", width: 200 },
];

const TASK_COLS: Col<EntityMap["tasks"]>[] = [
  { key: "id", header: "ID", type: "text", width: 90 },
  { key: "titlu", header: "De rezolvat", type: "text", width: 260 },
  { key: "categorie", header: "Categorie", type: "text", width: 140 },
  { key: "termen", header: "Termen", type: "date", width: 110 },
  { key: "responsabil", header: "Responsabil", type: "text", width: 130 },
  { key: "status", header: "Status", type: "enum", options: STATUS_SARCINA, width: 100 },
  { key: "costPotential", header: "Cost potențial", type: "optNumber", width: 110 },
  { key: "monedaCost", header: "Monedă cost", type: "enum", options: MONEDE, width: 90 },
  { key: "note", header: "Note", type: "text", width: 220 },
];

/** Interval deschis pentru o coloană, ex: "Invitati!J2:J" (tab = "" pentru același tab). */
function rng<T>(cols: Col<T>[], key: keyof T & string, tab = ""): string {
  const i = cols.findIndex((c) => c.key === key);
  if (i < 0) throw new Error(`Coloană necunoscută: ${key}`);
  const L = colLetter(i);
  return `${tab ? `${tab}!` : ""}${L}2:${L}`;
}
const computedRng = (cols: Col<unknown>[], k: number, tab = "") => {
  const L = colLetter(cols.length + k);
  return `${tab ? `${tab}!` : ""}${L}2:${L}`;
};

const formula = (header: string, body: string) => `={"${header}";ARRAYFORMULA(IF(A2:A="",,${body}))}`;

const setting = (key: keyof Settings, fallback = `""`) => `IFERROR(VLOOKUP("${key}",Setari!A:B,2,FALSE),${fallback})`;
const RATE = setting("cursEur", "5");
const MAIN = setting("moneda", `"RON"`);
/** factor de conversie din moneda din `range` în moneda principală */
const toMain = (range: string) => `IF(${range}=${MAIN},1,IF(${range}="EUR",${RATE},1/${RATE}))`;

// referințe între tab-uri
const G = {
  rsvp: rng(GUEST_COLS, "rsvp", "Invitati"),
  masa: rng(GUEST_COLS, "masaId", "Invitati"),
  persoane: computedRng(GUEST_COLS as Col<unknown>[], 0, "Invitati"),
};
const T = { locuri: rng(TABLE_COLS, "locuri", "Mese"), ocupate: computedRng(TABLE_COLS as Col<unknown>[], 0, "Mese") };
const C = {
  moneda: rng(COST_COLS, "moneda", "Costuri"),
  total: computedRng(COST_COLS as Col<unknown>[], 0, "Costuri"),
  idSiMoneda: `{Costuri!A2:A,${rng(COST_COLS, "moneda", "Costuri")}}`,
  idSiFurnizor: "Costuri!A2:C",
};
const P = {
  cost: rng(PAYMENT_COLS, "costId", "Plati"),
  suma: rng(PAYMENT_COLS, "suma", "Plati"),
  moneda: rng(PAYMENT_COLS, "moneda", "Plati"),
  platit: rng(PAYMENT_COLS, "platit", "Plati"),
  inMonedaCostului: computedRng(PAYMENT_COLS as Col<unknown>[], 1, "Plati"),
};
const S = {
  status: rng(TASK_COLS, "status", "Sarcini"),
  cost: rng(TASK_COLS, "costPotential", "Sarcini"),
  moneda: rng(TASK_COLS, "monedaCost", "Sarcini"),
};

// Persoanele unui rând = invitatul + însoțitori + copii
const persoane = `1+IFERROR(${rng(GUEST_COLS, "insotitori")}*1,0)+IFERROR(${rng(GUEST_COLS, "copii")}*1,0)`;
// Locurile ocupate nu includ invitații care au refuzat
const ocupate = `SUMIF(${G.masa}&"|"&${G.rsvp},A2:A&"|Da",${G.persoane})+SUMIF(${G.masa}&"|"&${G.rsvp},A2:A&"|Necunoscut",${G.persoane})`;
// Persoanele estimate = toți invitații care nu au refuzat (Da + Necunoscut)
const PERSOANE_ESTIMATE = `SUMIF(${G.rsvp},"<>Nu",${G.persoane})`;
const pret = `IF(${rng(COST_COLS, "contractat")}<>"",${rng(COST_COLS, "contractat")},${rng(COST_COLS, "estimat")})`;
const totalCost = `IF(${rng(COST_COLS, "tip")}="Per persoană",${pret}*${PERSOANE_ESTIMATE},${pret})`;
const platitCost = `SUMIF(${P.cost}&"|"&${P.platit},A2:A&"|TRUE",${P.inMonedaCostului})`;
const monedaCostului = `IFERROR(VLOOKUP(${rng(PAYMENT_COLS, "costId")},${C.idSiMoneda},2,FALSE),${rng(PAYMENT_COLS, "moneda")})`;
const sumaPlata = rng(PAYMENT_COLS, "suma");
const monedaPlata = rng(PAYMENT_COLS, "moneda");

export const GUESTS: TableDef<"guests"> = {
  key: "guests",
  tab: "Invitati",
  color: "#9f4f5f",
  cols: GUEST_COLS,
  computed: [
    { header: "Persoane", formula: formula("Persoane", persoane), width: 80, format: "int" },
    { header: "Nume masă", formula: formula("Nume masă", `IFERROR(VLOOKUP(${rng(GUEST_COLS, "masaId")},Mese!A2:B,2,FALSE),"")`), width: 140 },
  ],
};

export const TABLES: TableDef<"tables"> = {
  key: "tables",
  tab: "Mese",
  color: "#b07d3a",
  cols: TABLE_COLS,
  computed: [
    { header: "Ocupate", formula: formula("Ocupate", ocupate), width: 80, format: "int" },
    { header: "Libere", formula: formula("Libere", `${rng(TABLE_COLS, "locuri")}-(${ocupate})`), width: 80, format: "int" },
  ],
};

export const COSTS: TableDef<"costs"> = {
  key: "costs",
  tab: "Costuri",
  color: "#3f7a5a",
  cols: COST_COLS,
  computed: [
    { header: "Total", formula: formula("Total", totalCost), width: 100, format: "money" },
    { header: "Plătit", formula: formula("Plătit", platitCost), width: 100, format: "money" },
    { header: "Rest", formula: formula("Rest", `${totalCost}-${platitCost}`), width: 100, format: "money" },
  ],
};

export const PAYMENTS: TableDef<"payments"> = {
  key: "payments",
  tab: "Plati",
  color: "#2f6690",
  cols: PAYMENT_COLS,
  computed: [
    { header: "Furnizor", formula: formula("Furnizor", `IFERROR(VLOOKUP(${rng(PAYMENT_COLS, "costId")},${C.idSiFurnizor},3,FALSE),"")`), width: 180 },
    {
      header: "Sumă în moneda costului",
      formula: formula(
        "Sumă în moneda costului",
        `IF(${monedaPlata}=${monedaCostului},${sumaPlata},IF(${monedaCostului}="EUR",${sumaPlata}/${RATE},${sumaPlata}*${RATE}))`,
      ),
      width: 150,
      format: "money",
    },
  ],
};

export const TASKS: TableDef<"tasks"> = {
  key: "tasks",
  tab: "Sarcini",
  color: "#6b4f9f",
  cols: TASK_COLS,
  computed: [],
};

export const TABLE_DEFS = { guests: GUESTS, costs: COSTS, payments: PAYMENTS, tables: TABLES, tasks: TASKS } as const;
export const TABLE_ORDER: TableKey[] = ["guests", "costs", "payments", "tables", "tasks"];

// Setări: tab cheie/valoare. Cheia rămâne fixă, eticheta e pentru oameni.
export const SETTINGS_TAB = "Setari";
export const SETTING_FIELDS: { key: keyof Settings; label: string; type: "text" | "number" | "date" }[] = [
  { key: "partener1", label: "Partener 1", type: "text" },
  { key: "partener2", label: "Partener 2", type: "text" },
  { key: "dataNunta", label: "Data nunții (petrecerea)", type: "date" },
  { key: "dataCivila", label: "Data cununiei civile", type: "date" },
  { key: "locatiePetrecere", label: "Locația petrecerii", type: "text" },
  { key: "locatieCeremonie", label: "Locația ceremoniei", type: "text" },
  { key: "bugetTotal", label: "Buget total (în moneda principală)", type: "number" },
  { key: "moneda", label: "Moneda principală (RON sau EUR)", type: "text" },
  { key: "cursEur", label: "Curs: câți lei face 1 EUR", type: "number" },
];

export const SUMMARY_TAB = "Rezumat";

const costTotalMain = `=ARRAYFORMULA(SUM(IFERROR(${C.total}*${toMain(C.moneda)},0)))`;
const platitMain = `=ARRAYFORMULA(SUM(IF(${P.platit}=TRUE,IFERROR(${P.suma}*${toMain(P.moneda)},0),0)))`;
const strip = (f: string) => f.slice(1); // fără „=” ca să le putem combina

/** Tab-ul Rezumat, doar formule, pentru cine deschide Sheet-ul direct. Sumele sunt în moneda principală. */
export const SUMMARY_ROWS: [string, string, "date" | "money" | "int" | "text"][] = [
  ["Nunta", `=${setting("partener1")}&" & "&${setting("partener2")}`, "text"],
  ["Data nunții", `=${setting("dataNunta")}`, "date"],
  ["Zile până la nuntă", `=IFERROR(${setting("dataNunta")}-TODAY(),"")`, "int"],
  ["", "", "text"],
  ["Invitați (rânduri)", `=COUNTA(Invitati!A2:A)`, "int"],
  ["Persoane în total", `=SUM(${G.persoane})`, "int"],
  ["Persoane confirmate", `=SUMIF(${G.rsvp},"Da",${G.persoane})`, "int"],
  ["Persoane fără răspuns", `=SUMIF(${G.rsvp},"Necunoscut",${G.persoane})`, "int"],
  ["Persoane care au refuzat", `=SUMIF(${G.rsvp},"Nu",${G.persoane})`, "int"],
  ["", "", "text"],
  ["Sumele de mai jos sunt în", `=${MAIN}`, "text"],
  ["Buget total", `=${setting("bugetTotal")}`, "money"],
  ["Cost total (estimat / final)", costTotalMain, "money"],
  ["Plătit până acum", platitMain, "money"],
  ["Rest de plată", `=${strip(costTotalMain)}-${strip(platitMain)}`, "money"],
  ["Diferență față de buget", `=IFERROR(${setting("bugetTotal")}-${strip(costTotalMain)},"")`, "money"],
  ["Costuri potențiale (De rezolvat)", `=ARRAYFORMULA(SUM(IF(${S.status}<>"Gata",IFERROR(${S.cost}*${toMain(S.moneda)},0),0)))`, "money"],
  ["", "", "text"],
  ["Locuri la mese", `=SUM(${T.locuri})`, "int"],
  ["Persoane așezate", `=SUM(${T.ocupate})`, "int"],
  ["Sarcini rămase", `=COUNTIFS(Sarcini!A2:A,"<>",${S.status},"<>Gata")`, "int"],
];

// ---------- conversie rând <-> obiect ----------

type Cell = string | number | boolean;

export function encodeRow<K extends TableKey>(def: TableDef<K>, row: EntityMap[K]): Cell[] {
  return def.cols.map((c) => {
    const v = row[c.key] as unknown;
    switch (c.type) {
      case "number":
        return Number(v) || 0;
      case "optNumber":
        return v === null || v === undefined || v === "" ? "" : Number(v) || 0;
      case "date":
        return isoToSerial(String(v ?? ""));
      case "bool":
        return v === true;
      default:
        return String(v ?? "");
    }
  });
}

export function decodeRow<K extends TableKey>(def: TableDef<K>, values: unknown[]): EntityMap[K] {
  const out: Record<string, unknown> = {};
  def.cols.forEach((c, i) => {
    const v = values[i];
    switch (c.type) {
      case "number":
        out[c.key] = toNumber(v) ?? 0;
        break;
      case "optNumber":
        out[c.key] = toNumber(v);
        break;
      case "date":
        out[c.key] = toIso(v);
        break;
      case "bool":
        out[c.key] = v === true || String(v).toUpperCase() === "TRUE";
        break;
      case "enum": {
        const s = String(v ?? "").trim();
        out[c.key] = c.options!.find((o) => o.toLowerCase() === s.toLowerCase()) ?? c.options![0];
        break;
      }
      default:
        out[c.key] = v === undefined || v === null ? "" : String(v);
    }
  });
  return out as unknown as EntityMap[K];
}

function toNumber(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string" || !v.trim()) return null;
  // acceptă "1.500,50" și "1500.50"
  const s = v.replace(/\s/g, "");
  const normalized = /,\d{1,2}$/.test(s) ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

export function encodeSetting(field: (typeof SETTING_FIELDS)[number], value: unknown): Cell {
  if (field.type === "number") return Number(value) || 0;
  if (field.type === "date") return isoToSerial(String(value ?? ""));
  return String(value ?? "");
}

export function decodeSetting(field: (typeof SETTING_FIELDS)[number], value: unknown): unknown {
  if (field.type === "number") return toNumber(value) ?? 0;
  if (field.type === "date") return toIso(value);
  if (field.key === "moneda") return String(value ?? "").trim().toUpperCase() === "EUR" ? "EUR" : "RON";
  return value === undefined || value === null ? "" : String(value);
}

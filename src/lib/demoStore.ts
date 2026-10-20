import { addDays, addMonths, todayIso } from "./dates";
import { newId } from "./ids";
import type { PlannerStore } from "./store";
import { DEFAULT_SETTINGS, type EntityMap, type Guest, type PlannerData, type Settings, type Table, type TableKey } from "./types";

// Mod demo: aceleași operații ca pe Sheet, dar în localStorage-ul browserului.
// Folosit ca să încerci aplicația fără cont Google.

const KEY = "pn_demo_v2";
const delay = () => new Promise((r) => setTimeout(r, 120));

export class DemoStore implements PlannerStore {
  kind = "demo" as const;
  id = "demo";
  title = "Planificator demo";

  private read(): PlannerData {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw) as PlannerData;
    } catch {
      /* date corupte: o luăm de la capăt */
    }
    const seeded = demoData();
    this.write(seeded);
    return seeded;
  }

  private write(data: PlannerData) {
    localStorage.setItem(KEY, JSON.stringify(data));
  }

  static reset() {
    localStorage.removeItem(KEY);
  }

  async load(): Promise<PlannerData> {
    await delay();
    return structuredClone(this.read());
  }

  async add<K extends TableKey>(table: K, rows: EntityMap[K][]): Promise<void> {
    await delay();
    const data = this.read();
    (data[table] as EntityMap[K][]).push(...rows);
    this.write(data);
  }

  async update<K extends TableKey>(table: K, rows: EntityMap[K][]): Promise<void> {
    await delay();
    const data = this.read();
    const list = data[table] as EntityMap[K][];
    for (const row of rows) {
      const i = list.findIndex((r) => r.id === row.id);
      if (i < 0) throw new Error("Rândul nu mai există.");
      list[i] = row;
    }
    this.write(data);
  }

  async remove<K extends TableKey>(table: K, ids: string[]): Promise<void> {
    await delay();
    const data = this.read();
    (data as unknown as Record<string, { id: string }[]>)[table] = (data[table] as { id: string }[]).filter(
      (r) => !ids.includes(r.id),
    );
    this.write(data);
  }

  async saveSettings(patch: Partial<Settings>): Promise<void> {
    await delay();
    const data = this.read();
    data.settings = { ...data.settings, ...patch };
    this.write(data);
  }
}

function demoData(): PlannerData {
  const today = todayIso();
  const wedding = addMonths(today, 8);
  const el = (nume: string, tip: Table["tip"], forma: Table["forma"], locuri: number, x: number, y: number, latime: number, inaltime: number): Table => ({
    id: newId(), nume, tip, forma, locuri, x, y, latime, inaltime, note: "",
  });
  const miri = el("Masa mirilor", "Masa mirilor", "Dreptunghiulară", 4, 520, 80, 260, 70);
  const nasi = el("Masa nașilor", "Masă", "Rotundă", 8, 260, 260, 120, 120);
  const m1 = el("Masa 1 – familia Popescu", "Masă", "Rotundă", 10, 860, 260, 130, 130);
  const m2 = el("Masa 2 – colegi", "Masă", "Dreptunghiulară", 10, 200, 520, 220, 80);
  const m3 = el("Masa 3 – prieteni", "Masă", "Dreptunghiulară", 8, 900, 520, 110, 110);
  const tables: Table[] = [
    miri, nasi, m1, m2, m3,
    el("Scena formației", "Scena formației", "Dreptunghiulară", 0, 120, 60, 200, 100),
    el("Ring de dans", "Ring de dans", "Rotundă", 0, 520, 330, 260, 200),
  ];
  const c = { loc: newId(), foto: newId(), muz: newId(), rochie: newId(), flori: newId() };
  const g = (nume: string, grup: string, parte: Guest["parte"], rsvp: Guest["rsvp"], insotitori = 0, copii = 0, masaId = "", loc: number | null = null, restrictii = ""): Guest => ({
    id: newId(), nume, grup, parte, rsvp, insotitori, copii, restrictii, telefon: "", masaId, loc, note: "",
  });
  return {
    settings: {
      ...DEFAULT_SETTINGS,
      partener1: "Ana",
      partener2: "Mihai",
      dataNunta: wedding,
      dataCivila: addDays(wedding, -14),
      locatiePetrecere: "Restaurant Grădina, Brașov",
      locatieCeremonie: "Biserica Sf. Nicolae",
      bugetTotal: 120000,
      moneda: "RON",
      cursEur: 4.98,
    },
    tables,
    guests: [
      g("Ana Ionescu (mireasa)", "Miri", "Comun", "Da", 0, 0, miri.id, 1),
      g("Mihai Ionescu (mirele)", "Miri", "Comun", "Da", 0, 0, miri.id, 2),
      g("Ion și Maria Ionescu (nași)", "Nași", "Comun", "Da", 1, 0, nasi.id, 0),
      g("Elena Popescu", "Familia mireasă", "Mireasă", "Da", 1, 1, m1.id, 0),
      g("Gheorghe Popescu", "Familia mireasă", "Mireasă", "Da", 0, 0, m1.id, 3),
      g("Andrei Vasile", "Familia mire", "Mire", "Necunoscut", 1),
      g("Ioana Marin", "Colegi", "Mireasă", "Da", 0, 0, m2.id, 0, "vegetariană"),
      g("Radu Stan", "Colegi", "Mire", "Nu"),
      g("Cristina Dobre", "Prieteni", "Comun", "Da", 1),
      g("Vlad Neagu", "Prieteni", "Comun", "Necunoscut"),
      g("Familia Constantin", "Vecini", "Mire", "Da", 1, 2),
    ],
    costs: [
      { id: c.loc, categorie: "Locație și meniu", furnizor: "Restaurant Grădina", contact: "0722 000 000", tip: "Per persoană", moneda: "EUR", estimat: 90, contractat: 95, status: "Contract semnat", note: "meniu complet + băuturi" },
      { id: c.foto, categorie: "Foto", furnizor: "Studio Lumina", contact: "", tip: "Fix", moneda: "EUR", estimat: 1400, contractat: 1500, status: "Rezervat", note: "" },
      { id: c.muz, categorie: "Muzică", furnizor: "Formația Ritm", contact: "", tip: "Fix", moneda: "RON", estimat: 9000, contractat: null, status: "Ofertă", note: "" },
      { id: c.rochie, categorie: "Rochie", furnizor: "Atelier Albă", contact: "", tip: "Fix", moneda: "RON", estimat: 6000, contractat: null, status: "De ales", note: "" },
      { id: c.flori, categorie: "Flori și decor", furnizor: "", contact: "", tip: "Fix", moneda: "RON", estimat: 5000, contractat: null, status: "De ales", note: "" },
    ],
    payments: [
      { id: newId(), costId: c.loc, descriere: "Avans", suma: 1000, moneda: "EUR", scadenta: addDays(today, -30), platit: true, dataPlata: addDays(today, -32), note: "" },
      { id: newId(), costId: c.loc, descriere: "A doua tranșă", suma: 10000, moneda: "RON", scadenta: addDays(today, 12), platit: false, dataPlata: "", note: "plătită în lei la curs" },
      { id: newId(), costId: c.foto, descriere: "Avans", suma: 400, moneda: "EUR", scadenta: addDays(today, -3), platit: false, dataPlata: "", note: "" },
      { id: newId(), costId: c.foto, descriere: "Rest de plată", suma: 1100, moneda: "EUR", scadenta: wedding, platit: false, dataPlata: "", note: "în ziua nunții" },
    ],
    tasks: [
      { id: newId(), titlu: "Stabilim lista finală de invitați", categorie: "Invitați", termen: addDays(today, 20), responsabil: "Ana", status: "În lucru", costPotential: null, monedaCost: "RON", note: "" },
      { id: newId(), titlu: "Comandăm invitațiile", categorie: "Invitații", termen: addDays(today, 45), responsabil: "Mihai", status: "De făcut", costPotential: 1200, monedaCost: "RON", note: "" },
      { id: newId(), titlu: "Degustare meniu la restaurant", categorie: "Locație", termen: addDays(today, -5), responsabil: "", status: "De făcut", costPotential: null, monedaCost: "RON", note: "" },
      { id: newId(), titlu: "Alegem fotobooth", categorie: "Distracție", termen: addDays(today, 60), responsabil: "", status: "De făcut", costPotential: 250, monedaCost: "EUR", note: "" },
      { id: newId(), titlu: "Rezervăm fotograful", categorie: "Foto", termen: addDays(today, -40), responsabil: "Ana", status: "Gata", costPotential: null, monedaCost: "RON", note: "" },
    ],
  };
}

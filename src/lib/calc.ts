import { daysUntil } from "./dates";
import type { Cost, Guest, Moneda, Payment, PlannerData, Settings, Table, Task } from "./types";

// Toate cifrele din ecrane vin din funcțiile de aici, ca Rezumatul, Costurile și Mesele
// să arate mereu aceleași numere (aceleași reguli ca formulele din Sheet).

export const persons = (g: Guest) => 1 + (g.insotitori || 0) + (g.copii || 0);

export function guestStats(guests: Guest[]) {
  const sum = (list: Guest[]) => list.reduce((s, g) => s + persons(g), 0);
  const da = guests.filter((g) => g.rsvp === "Da");
  const nu = guests.filter((g) => g.rsvp === "Nu");
  const nec = guests.filter((g) => g.rsvp === "Necunoscut");
  return {
    rows: guests.length,
    total: sum(guests),
    confirmed: sum(da),
    declined: sum(nu),
    unknown: sum(nec),
    /** Da + Necunoscut: baza pentru costurile „per persoană” */
    expected: sum(da) + sum(nec),
    kids: guests.filter((g) => g.rsvp !== "Nu").reduce((s, g) => s + (g.copii || 0), 0),
    withRestrictions: guests.filter((g) => g.rsvp !== "Nu" && g.restrictii.trim()).length,
  };
}

// ---------- monede ----------

export const rateOf = (s: Settings) => (s.cursEur > 0 ? s.cursEur : 5);

export function convert(amount: number, from: Moneda, to: Moneda, rate: number): number {
  if (from === to) return amount;
  return from === "EUR" ? amount * rate : amount / rate;
}

// ---------- costuri ----------

export const unitPrice = (c: Cost) => c.contractat ?? c.estimat;

/** Totalul costului, în moneda costului. */
export function costTotal(c: Cost, expectedPersons: number): number {
  return c.tip === "Per persoană" ? unitPrice(c) * expectedPersons : unitPrice(c);
}

/** Totaluri pe un cost, toate în moneda costului (plățile în altă monedă se convertesc). */
export function costDetails(c: Cost, payments: Payment[], expectedPersons: number, rate: number) {
  const own = payments.filter((p) => p.costId === c.id);
  const inCost = (p: Payment) => convert(p.suma, p.moneda, c.moneda, rate);
  const total = costTotal(c, expectedPersons);
  const paid = own.filter((p) => p.platit).reduce((s, p) => s + inCost(p), 0);
  const scheduled = own.reduce((s, p) => s + inCost(p), 0);
  const next = own
    .filter((p) => !p.platit && p.scadenta)
    .sort((a, b) => a.scadenta.localeCompare(b.scadenta))[0];
  return {
    payments: own.sort((a, b) => (a.scadenta || "9999").localeCompare(b.scadenta || "9999")),
    total,
    paid,
    remaining: total - paid,
    /** partea din total care nu are încă nicio plată programată */
    unscheduled: Math.max(0, total - scheduled),
    next,
  };
}

/** Bugetul, cu toate sumele convertite în moneda principală. */
export function budgetSummary(data: PlannerData) {
  const expected = guestStats(data.guests).expected;
  const main = data.settings.moneda;
  const rate = rateOf(data.settings);
  let total = 0;
  let paid = 0;
  const byCategory = new Map<string, number>();
  const byCurrency: Record<Moneda, number> = { RON: 0, EUR: 0 };
  for (const c of data.costs) {
    const d = costDetails(c, data.payments, expected, rate);
    const t = convert(d.total, c.moneda, main, rate);
    total += t;
    paid += convert(d.paid, c.moneda, main, rate);
    byCurrency[c.moneda] += d.total;
    const cat = c.categorie.trim() || "Altele";
    byCategory.set(cat, (byCategory.get(cat) ?? 0) + t);
  }
  const potential = data.tasks
    .filter((t) => t.status !== "Gata" && t.costPotential)
    .reduce((s, t) => s + convert(t.costPotential ?? 0, t.monedaCost, main, rate), 0);
  const budget = data.settings.bugetTotal || 0;
  return {
    total,
    paid,
    remaining: total - paid,
    budget,
    overBudget: budget > 0 && total > budget,
    leftInBudget: budget - total,
    /** costuri estimate din „De rezolvat” încă nerezolvate (nu intră în total) */
    potential,
    byCurrency,
    byCategory: [...byCategory.entries()].sort((a, b) => b[1] - a[1]),
  };
}

export type PaymentState = "platit" | "restant" | "curand" | "viitor" | "fara_termen";

export const SOON_DAYS = 14;

export function paymentState(p: Payment): PaymentState {
  if (p.platit) return "platit";
  const d = daysUntil(p.scadenta);
  if (d === null) return "fara_termen";
  if (d < 0) return "restant";
  if (d <= SOON_DAYS) return "curand";
  return "viitor";
}

/** Plățile neachitate: restante + cele din următoarele `days` zile, în ordinea scadenței. */
export function upcomingPayments(data: PlannerData, days = 30) {
  return data.payments
    .filter((p) => {
      if (p.platit || !p.scadenta) return false;
      const d = daysUntil(p.scadenta);
      return d !== null && d <= days;
    })
    .sort((a, b) => a.scadenta.localeCompare(b.scadenta))
    .map((p) => ({ payment: p, cost: data.costs.find((c) => c.id === p.costId) }));
}

// ---------- mese ----------

export const hasSeats = (t: Table) => t.tip === "Masă" || t.tip === "Masa mirilor";
export const seatTables = (tables: Table[]) => tables.filter(hasSeats);

/** Invitații care au refuzat nu ocupă loc, chiar dacă au rămas asignați unei mese. */
export function seatedAt(table: Table, guests: Guest[]) {
  return guests.filter((g) => g.masaId === table.id && g.rsvp !== "Nu");
}

export interface SeatOccupant {
  guest: Guest;
  /** 0 = invitatul principal, apoi însoțitorii, apoi copiii */
  index: number;
  kind: "principal" | "insotitor" | "copil";
}

/**
 * Cine stă pe fiecare loc al mesei. Fiecare invitat începe de la locul lui (`loc`) și
 * însoțitorii ocupă locurile libere următoare; cine nu mai încape intră la `overflow`.
 */
export function seatMap(table: Table, guests: Guest[]) {
  const n = Math.max(0, table.locuri);
  const seats: (SeatOccupant | null)[] = Array(n).fill(null);
  let overflow = 0;
  const list = seatedAt(table, guests).sort((a, b) => (a.loc ?? 1e9) - (b.loc ?? 1e9) || a.nume.localeCompare(b.nume, "ro"));
  for (const g of list) {
    const count = persons(g);
    let cursor = Math.min(Math.max(0, g.loc ?? 0), Math.max(0, n - 1));
    for (let i = 0; i < count; i++) {
      let placed = false;
      for (let step = 0; step < n; step++) {
        const k = (cursor + step) % n;
        if (!seats[k]) {
          seats[k] = { guest: g, index: i, kind: i === 0 ? "principal" : i <= (g.insotitori || 0) ? "insotitor" : "copil" };
          cursor = k;
          placed = true;
          break;
        }
      }
      if (!placed) overflow++;
    }
  }
  return { seats, overflow, used: list.reduce((s, g) => s + persons(g), 0) };
}

/** Primul loc de unde încape tot grupul (sau primul loc liber, dacă nu încape nicăieri). */
export function firstFreeSeat(table: Table, guests: Guest[], need: number, ignoreGuestId?: string): number {
  const { seats } = seatMap(table, guests.filter((g) => g.id !== ignoreGuestId));
  const n = seats.length;
  for (let start = 0; start < n; start++) {
    let ok = true;
    for (let i = 0; i < need && ok; i++) if (seats[(start + i) % n]) ok = false;
    if (ok) return start;
  }
  const free = seats.findIndex((s) => !s);
  return free < 0 ? 0 : free;
}

export function seatingStats(data: PlannerData) {
  const tables = seatTables(data.tables);
  const known = new Set(tables.map((t) => t.id));
  const attending = data.guests.filter((g) => g.rsvp !== "Nu");
  const seated = attending.filter((g) => known.has(g.masaId));
  const seats = tables.reduce((s, t) => s + (t.locuri || 0), 0);
  const overfull = tables.filter((t) => seatedAt(t, data.guests).reduce((s, g) => s + persons(g), 0) > t.locuri);
  return {
    tables: tables.length,
    seats,
    seatedPersons: seated.reduce((s, g) => s + persons(g), 0),
    unseatedPersons: attending.filter((g) => !known.has(g.masaId)).reduce((s, g) => s + persons(g), 0),
    overfull,
  };
}

// ---------- sarcini ----------

export type TaskBucket = "restante" | "curand" | "mai_tarziu" | "fara_termen" | "gata";

export function taskBucket(t: Task): TaskBucket {
  if (t.status === "Gata") return "gata";
  const d = daysUntil(t.termen);
  if (d === null) return "fara_termen";
  if (d < 0) return "restante";
  if (d <= 30) return "curand";
  return "mai_tarziu";
}

export function sortTasks(tasks: Task[]) {
  return [...tasks].sort((a, b) => (a.termen || "9999").localeCompare(b.termen || "9999") || a.titlu.localeCompare(b.titlu));
}

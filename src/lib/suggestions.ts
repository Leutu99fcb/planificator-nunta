import { addMonths } from "./dates";
import { newId } from "./ids";
import type { Moneda, Task } from "./types";

// Listă de pornire pentru „De rezolvat”, cu termene relative la data nunții.
// Se adaugă doar ce nu există deja (după titlu).

const SUGGESTED: [months: number, titlu: string, categorie: string][] = [
  [-12, "Stabilim bugetul și data", "Organizare"],
  [-12, "Facem prima listă de invitați", "Invitați"],
  [-11, "Rezervăm locația petrecerii", "Locație"],
  [-11, "Rezervăm biserica / ceremonia", "Ceremonie"],
  [-10, "Alegem nașii", "Organizare"],
  [-10, "Rezervăm fotograful și videograful", "Foto"],
  [-9, "Rezervăm formația / DJ-ul", "Muzică"],
  [-8, "Alegem rochia de mireasă", "Ținute"],
  [-6, "Alegem florăria și decorul", "Decor"],
  [-6, "Programăm cununia civilă", "Ceremonie"],
  [-5, "Alegem costumul mirelui", "Ținute"],
  [-4, "Comandăm invitațiile", "Invitații"],
  [-4, "Cumpărăm verighetele", "Ceremonie"],
  [-3, "Trimitem invitațiile", "Invitații"],
  [-3, "Degustare meniu și tort", "Locație"],
  [-2, "Comandăm mărturiile", "Decor"],
  [-2, "Programăm machiajul și coafura", "Ținute"],
  [-1, "Confirmăm numărul final de invitați la restaurant", "Invitați"],
  [-1, "Facem planul de așezare la mese", "Invitați"],
  [-1, "Confirmăm programul zilei cu toți furnizorii", "Organizare"],
  [0, "Pregătim plicurile cu plata furnizorilor din ziua nunții", "Plăți"],
];

export function suggestedTasks(weddingDate: string, existing: Task[], moneda: Moneda): Task[] {
  const titles = new Set(existing.map((t) => t.titlu.trim().toLowerCase()));
  return SUGGESTED.filter(([, titlu]) => !titles.has(titlu.toLowerCase())).map(([months, titlu, categorie]) => ({
    id: newId(),
    titlu,
    categorie,
    termen: weddingDate ? addMonths(weddingDate, months) : "",
    responsabil: "",
    status: "De făcut" as const,
    costPotential: null,
    monedaCost: moneda,
    note: "",
  }));
}

export const COST_CATEGORIES = [
  "Locație și meniu", "Băuturi", "Tort", "Foto", "Video", "Muzică", "Rochie", "Costum",
  "Verighete", "Machiaj și coafură", "Flori și decor", "Invitații", "Mărturii", "Biserică",
  "Starea civilă", "Nași", "Transport", "Cazare", "Luna de miere", "Altele",
];

export const PAYMENT_LABELS = ["Avans", "A doua tranșă", "Rest de plată", "Plată integrală"];

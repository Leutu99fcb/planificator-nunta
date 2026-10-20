// Valorile enum sunt chiar textele afișate în Sheet (dropdown-uri), ca tabelul să rămână
// ușor de editat și direct din Google Sheets.
export const RSVP = ["Necunoscut", "Da", "Nu"] as const;
export type Rsvp = (typeof RSVP)[number];

export const PARTE = ["Comun", "Mireasă", "Mire"] as const;
export type Parte = (typeof PARTE)[number];

export const MONEDE = ["RON", "EUR"] as const;
export type Moneda = (typeof MONEDE)[number];

export const TIP_COST = ["Fix", "Per persoană"] as const;
export type TipCost = (typeof TIP_COST)[number];

export const STATUS_COST = ["De ales", "Ofertă", "Rezervat", "Contract semnat"] as const;
export type StatusCost = (typeof STATUS_COST)[number];

export const STATUS_SARCINA = ["De făcut", "În lucru", "Gata"] as const;
export type StatusSarcina = (typeof STATUS_SARCINA)[number];

/** Elementele din planul sălii. Doar „Masă” și „Masa mirilor” au locuri. */
export const TIP_ELEMENT = ["Masă", "Masa mirilor", "Scenă", "Scena formației", "Ring de dans"] as const;
export type TipElement = (typeof TIP_ELEMENT)[number];

export const FORMA = ["Rotundă", "Dreptunghiulară"] as const;
export type Forma = (typeof FORMA)[number];

export interface Guest {
  id: string;
  nume: string;
  grup: string;
  parte: Parte;
  rsvp: Rsvp;
  insotitori: number; // adulți în plus față de invitatul principal
  copii: number;
  restrictii: string;
  telefon: string;
  masaId: string;
  /** primul loc ocupat la masă (index de la 0); însoțitorii stau pe locurile următoare */
  loc: number | null;
  note: string;
}

export interface Cost {
  id: string;
  categorie: string;
  furnizor: string;
  contact: string;
  tip: TipCost;
  moneda: Moneda;
  estimat: number; // la "Per persoană" e prețul pe persoană
  contractat: number | null; // null = încă nu există preț final
  status: StatusCost;
  note: string;
}

export interface Payment {
  id: string;
  costId: string;
  descriere: string;
  suma: number;
  moneda: Moneda;
  scadenta: string; // ISO yyyy-mm-dd sau ""
  platit: boolean;
  dataPlata: string;
  note: string;
}

/** Un element din planul sălii: masă, masa mirilor, scenă, scena formației, ring de dans. */
export interface Table {
  id: string;
  nume: string;
  tip: TipElement;
  forma: Forma;
  locuri: number;
  /** colțul stânga-sus și dimensiunile, în unități de plan (1 unitate = 1px la zoom 100%) */
  x: number;
  y: number;
  latime: number;
  inaltime: number;
  note: string;
}

export interface Task {
  id: string;
  titlu: string;
  categorie: string;
  termen: string;
  responsabil: string;
  status: StatusSarcina;
  costPotential: number | null;
  monedaCost: Moneda;
  note: string;
}

export interface Settings {
  partener1: string;
  partener2: string;
  dataNunta: string;
  dataCivila: string;
  locatiePetrecere: string;
  locatieCeremonie: string;
  bugetTotal: number;
  /** moneda în care se afișează totalurile și bugetul */
  moneda: Moneda;
  /** câți lei face 1 euro */
  cursEur: number;
}

export const DEFAULT_SETTINGS: Settings = {
  partener1: "",
  partener2: "",
  dataNunta: "",
  dataCivila: "",
  locatiePetrecere: "",
  locatieCeremonie: "",
  bugetTotal: 0,
  moneda: "RON",
  cursEur: 5,
};

export interface PlannerData {
  settings: Settings;
  guests: Guest[];
  costs: Cost[];
  payments: Payment[];
  tables: Table[];
  tasks: Task[];
}

export type Entity = Guest | Cost | Payment | Table | Task;

export interface EntityMap {
  guests: Guest;
  costs: Cost;
  payments: Payment;
  tables: Table;
  tasks: Task;
}
export type TableKey = keyof EntityMap;

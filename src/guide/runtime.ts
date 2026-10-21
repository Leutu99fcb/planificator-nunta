import type { Route } from "../state/route";

// Modul ghid: aplicația se deschide într-un iframe cu ?guide=<pagina> și rulează un scenariu
// cu „degetul” care apasă butoanele reale. Totul se întâmplă pe date demo ținute în memorie:
// localStorage din iframe e înlocuit cu o memorie temporară, ca ghidul să pornească mereu
// de la zero și să nu atingă nimic din ce a salvat utilizatorul (date demo, zoom, temă).

const ROUTES: Route[] = ["rezumat", "invitati", "costuri", "mese", "sarcini", "setari"];

function readScene(): Route | null {
  if (typeof window === "undefined") return null;
  const s = new URLSearchParams(window.location.search).get("guide");
  return s && (ROUTES as string[]).includes(s) ? (s as Route) : null;
}

export const GUIDE_SCENE: Route | null = readScene();
export const IS_GUIDE = GUIDE_SCENE !== null;

/** Doar tema se citește din setarea reală, ca ghidul să arate ca aplicația. */
const READ_THROUGH = new Set(["pn_theme"]);

/** Valori de pornire în ghid (ex: planul de mese la un zoom lizibil pe ecranul de telefon). */
const SEED: Record<string, string> = { pn_zoom: "0.8", pn_seat_mode: "seat", pn_seat_labels: "scurt" };

export function installSandboxStorage() {
  const memory = new Map<string, string>(Object.entries(SEED));
  const real = {
    getItem: Storage.prototype.getItem,
  };
  Storage.prototype.getItem = function (key: string) {
    if (memory.has(key)) return memory.get(key)!;
    return READ_THROUGH.has(key) ? real.getItem.call(this, key) : null;
  };
  Storage.prototype.setItem = function (key: string, value: string) {
    memory.set(key, String(value));
  };
  Storage.prototype.removeItem = function (key: string) {
    memory.delete(key);
  };
}

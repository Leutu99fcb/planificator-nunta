import { useSyncExternalStore } from "react";

// Tema: „system” urmează setarea telefonului/calculatorului; „light”/„dark” o forțează.
// Alegerea stă în localStorage, iar index.html o aplică înainte de primul desen.

export type ThemePref = "system" | "light" | "dark";

const KEY = "pn_theme";
const listeners = new Set<() => void>();

function read(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

let current: ThemePref = read();

export function setTheme(pref: ThemePref) {
  current = pref;
  try {
    if (pref === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, pref);
  } catch {
    /* fără localStorage: tema ține doar până la reîncărcare */
  }
  const root = document.documentElement;
  if (pref === "system") delete root.dataset.theme;
  else root.dataset.theme = pref;
  listeners.forEach((fn) => fn());
}

export function useTheme(): ThemePref {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => current,
  );
}

export const THEME_OPTIONS: { value: ThemePref; label: string }[] = [
  { value: "system", label: "Sistem" },
  { value: "light", label: "Luminos" },
  { value: "dark", label: "Întunecat" },
];

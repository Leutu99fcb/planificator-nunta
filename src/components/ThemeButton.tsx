import { Monitor, Moon, Sun } from "lucide-react";
import { setTheme, useTheme, type ThemePref } from "../state/theme";

const NEXT: Record<ThemePref, ThemePref> = { system: "light", light: "dark", dark: "system" };
const LABEL: Record<ThemePref, string> = {
  system: "Tema: ca sistemul",
  light: "Tema: luminoasă",
  dark: "Tema: întunecată",
};

/** Buton mic care trece prin Sistem → Luminos → Întunecat. */
export function ThemeButton() {
  const theme = useTheme();
  const Icon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;
  return (
    <button
      type="button"
      onClick={() => setTheme(NEXT[theme])}
      className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-text"
      title={`${LABEL[theme]} (apasă ca să schimbi)`}
      aria-label={`${LABEL[theme]}. Schimbă tema`}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

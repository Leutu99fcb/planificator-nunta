import { CalendarHeart, HandCoins, Home, LayoutGrid, ListChecks, RefreshCw, Settings as SettingsIcon, Users } from "lucide-react";
import type { GoogleUser } from "../lib/google/auth";
import { daysUntil, formatDate } from "../lib/dates";
import { usePlanner } from "../state/planner";
import { href, useRoute, type Route } from "../state/route";
import { Badge, cx } from "../components/ui";
import { Summary } from "./Summary";
import { Guests } from "./Guests";
import { Costs } from "./Costs";
import { Seating } from "./seating/Seating";
import { Tasks } from "./Tasks";
import { SettingsPage } from "./SettingsPage";

const NAV: { route: Route; label: string; icon: typeof Home }[] = [
  { route: "rezumat", label: "Rezumat", icon: Home },
  { route: "invitati", label: "Invitați", icon: Users },
  { route: "costuri", label: "Costuri", icon: HandCoins },
  { route: "mese", label: "Mese", icon: LayoutGrid },
  { route: "sarcini", label: "De rezolvat", icon: ListChecks },
  { route: "setari", label: "Setări", icon: SettingsIcon },
];

export function Shell({ user, onLeave, onSwitch }: { user?: GoogleUser; onLeave: () => void; onSwitch?: () => void }) {
  const { data, store, fetching, refresh } = usePlanner();
  const route = useRoute();
  const s = data.settings;
  const names = [s.partener1, s.partener2].filter((n) => n.trim()).join(" & ") || "Nunta noastră";
  const days = daysUntil(s.dataNunta);

  return (
    <div className="min-h-screen pb-20 md:pb-8">
      <header className="sticky top-0 z-30 border-b border-border bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-fg">
            <CalendarHeart className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate font-serif text-base font-semibold leading-tight">{names}</div>
            <div className="truncate text-xs text-muted">
              {s.dataNunta ? (
                <>
                  {formatDate(s.dataNunta)}
                  {days !== null && days >= 0 && ` · ${days === 0 ? "azi e ziua cea mare!" : `încă ${days} zile`}`}
                </>
              ) : (
                "Data nunții nu e setată"
              )}
            </div>
          </div>
          {store.kind === "demo" && <Badge tone="warning">Demo</Badge>}
          <button
            type="button"
            onClick={refresh}
            className="rounded-lg p-2 text-muted hover:bg-surface-2"
            title="Reîncarcă datele din Sheet"
            aria-label="Reîncarcă datele"
          >
            <RefreshCw className={cx("h-4 w-4", fetching && "animate-spin")} />
          </button>
        </div>
        <nav className="mx-auto hidden max-w-6xl gap-1 px-3 md:flex">
          {NAV.map((n) => (
            <a
              key={n.route}
              href={href(n.route)}
              className={cx(
                "flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium",
                route === n.route ? "border-primary text-primary" : "border-transparent text-muted hover:text-text",
              )}
            >
              <n.icon className="h-4 w-4" />
              {n.label}
            </a>
          ))}
        </nav>
      </header>

      <main className={cx("mx-auto px-4 py-5", route === "mese" ? "max-w-[1600px]" : "max-w-6xl")}>
        {route === "rezumat" && <Summary />}
        {route === "invitati" && <Guests />}
        {route === "costuri" && <Costs />}
        {route === "mese" && <Seating />}
        {route === "sarcini" && <Tasks />}
        {route === "setari" && <SettingsPage user={user} onLeave={onLeave} onSwitch={onSwitch} />}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-6 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden">
        {NAV.map((n) => (
          <a
            key={n.route}
            href={href(n.route)}
            className={cx("flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium", route === n.route ? "text-primary" : "text-muted")}
          >
            <n.icon className="h-5 w-5" />
            <span className="truncate">{n.label}</span>
          </a>
        ))}
      </nav>
    </div>
  );
}

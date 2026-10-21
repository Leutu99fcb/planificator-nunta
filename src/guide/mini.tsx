import type { ReactNode } from "react";
import { CalendarHeart, HandCoins, Home, LayoutGrid, ListChecks, Settings, Users } from "lucide-react";
import { cx } from "../components/ui";

// Mini-ecranele din ghiduri: aceleași culori și forme ca aplicația, la scară de telefon.

const NAV = [
  { id: "rezumat", icon: Home, label: "Rezumat" },
  { id: "invitati", icon: Users, label: "Invitați" },
  { id: "costuri", icon: HandCoins, label: "Costuri" },
  { id: "mese", icon: LayoutGrid, label: "Mese" },
  { id: "sarcini", icon: ListChecks, label: "De rezolvat" },
  { id: "setari", icon: Settings, label: "Setări" },
];

export function MiniApp({ page, title, children, theme }: { page: string; title: string; children: ReactNode; theme?: "dark" }) {
  return (
    <div data-theme={theme} className="flex h-full flex-col bg-bg text-text transition-colors duration-500">
      <div className="flex items-center gap-2 border-b border-border bg-surface px-3 py-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-fg">
          <CalendarHeart className="h-3.5 w-3.5" />
        </span>
        <span className="font-serif text-[13px] font-semibold">Ana & Mihai</span>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden px-3 py-2.5">
        <div className="mb-2 font-serif text-[17px] font-semibold">{title}</div>
        {children}
      </div>
      <div className="grid grid-cols-6 border-t border-border bg-surface">
        {NAV.map((n) => (
          <div key={n.id} className={cx("flex flex-col items-center gap-0.5 py-1.5 text-[8px] font-medium", n.id === page ? "text-primary-ink" : "text-muted")}>
            <n.icon className="h-3.5 w-3.5" />
            {n.label}
          </div>
        ))}
      </div>
    </div>
  );
}

export function MCard({ children, className, target }: { children: ReactNode; className?: string; target?: string }) {
  return (
    <div data-target={target} className={cx("rounded-lg border border-border bg-surface", className)}>
      {children}
    </div>
  );
}

export function MBtn({ children, target, primary, className }: { children: ReactNode; target?: string; primary?: boolean; className?: string }) {
  return (
    <span
      data-target={target}
      className={cx(
        "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium",
        primary ? "bg-primary text-primary-fg" : "border border-border bg-surface",
        className,
      )}
    >
      {children}
    </span>
  );
}

type Tone = "success" | "warning" | "danger" | "info" | "primary" | "neutral";
const TONE: Record<Tone, string> = {
  success: "bg-success-soft text-success-ink",
  warning: "bg-warning-soft text-warning-ink",
  danger: "bg-danger-soft text-danger-ink",
  info: "bg-info-soft text-info-ink",
  primary: "bg-primary-soft text-primary-ink",
  neutral: "bg-surface-2 text-muted",
};

export function MBadge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cx("inline-flex items-center rounded-full px-1.5 py-px text-[9px] font-medium", TONE[tone], className)}>{children}</span>;
}

export function MCheck({ on, target }: { on: boolean; target?: string }) {
  return (
    <span
      data-target={target}
      className={cx(
        "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] border transition-colors duration-300",
        on ? "border-primary bg-primary text-primary-fg" : "border-muted/60 bg-surface",
      )}
    >
      {on && <svg viewBox="0 0 12 12" className="h-2.5 w-2.5"><path d="M2.5 6.5l2.2 2.2L9.5 3.8" fill="none" stroke="currentColor" strokeWidth="2" /></svg>}
    </span>
  );
}

/** Element care apare cu o mică animație când `show` devine true. */
export function Appear({ show, delay = 0, children, className }: { show: boolean; delay?: number; children: ReactNode; className?: string }) {
  if (!show) return null;
  return (
    <div className={cx("guide-in", className)} style={{ animationDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

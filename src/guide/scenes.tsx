import { useEffect, useState } from "react";
import { AlertTriangle, ListPlus, Music, Plus, RotateCw, Sparkles } from "lucide-react";
import { cx } from "../components/ui";
import type { Route } from "../state/route";
import { Appear, MBadge, MBtn, MCard, MCheck, MiniApp } from "./mini";
import type { GuideScene, ScreenProps } from "./types";

// Scenariile ghidurilor, câte unul pe pagină (~10 secunde fiecare).
// Datele sunt cele din modul demo (Ana & Mihai), nimic real.

/** Bară care se umple animat până la `to` (procente) după ce apare. */
function FillBar({ to, tone = "primary" }: { to: number; tone?: "primary" | "success" }) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setW(to));
    return () => cancelAnimationFrame(id);
  }, [to]);
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
      <div className={cx("h-full rounded-full transition-[width] duration-1000 ease-out", tone === "success" ? "bg-success" : "bg-primary")} style={{ width: `${w}%` }} />
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "success" }) {
  return (
    <MCard className="px-2 py-1.5">
      <div className="text-[8px] uppercase tracking-wide text-muted">{label}</div>
      <div className={cx("text-[13px] font-semibold tabular-nums", tone === "success" && "text-success-ink")}>{value}</div>
    </MCard>
  );
}

function Rsvp({ value, target }: { value: "Da" | "?" | "Nu"; target?: string }) {
  return (
    <span className="inline-flex rounded-md border border-border bg-surface-2 p-px text-[9px] font-medium">
      {(["Da", "?", "Nu"] as const).map((v) => (
        <span
          key={v}
          data-target={v === "Da" ? target : undefined}
          className={cx(
            "rounded px-1.5 py-px transition-colors duration-300",
            v === value ? (v === "Da" ? "bg-success-soft text-success-ink" : v === "Nu" ? "bg-danger-soft text-danger-ink" : "bg-warning-soft text-warning-ink") : "text-muted",
          )}
        >
          {v}
        </span>
      ))}
    </span>
  );
}

// ---------- Rezumat ----------

function SummaryScreen({ step, acted }: ScreenProps) {
  return (
    <MiniApp page="rezumat" title="Rezumat">
      <div className="space-y-2">
        <div className="rounded-lg bg-primary-soft py-3 text-center">
          <div className="font-serif text-3xl font-semibold text-primary-ink">243</div>
          <div className="text-[10px] text-muted">zile până la nuntă · 20 iun. 2027</div>
        </div>
        <Appear show={step >= 1} className="grid grid-cols-2 gap-1.5">
          <Stat label="Confirmați" value="13 / 17" />
          <Stat label="Cost total" value="35.986 lei" />
          <Stat label="Plătit" value="4.980 lei" tone="success" />
          <Stat label="Așezați" value="11 / 40" />
        </Appear>
        <Appear show={step >= 2}>
          <MCard className="space-y-1 px-2 py-1.5">
            <div className="flex justify-between text-[10px]">
              <span>Buget folosit</span>
              <span className="text-muted">35.986 / 120.000 lei</span>
            </div>
            <FillBar to={30} />
          </MCard>
        </Appear>
        <Appear show={step >= 3}>
          <div
            data-target="alert"
            className={cx(
              "flex items-center gap-1.5 rounded-lg border border-warning/40 bg-warning-soft px-2 py-1.5 text-[10px] text-warning-ink transition-shadow",
              acted && "ring-2 ring-primary",
            )}
          >
            <AlertTriangle className="h-3 w-3" /> 1 plată restantă · Studio Lumina
            {acted && <span className="ml-auto font-semibold">→ Costuri</span>}
          </div>
        </Appear>
      </div>
    </MiniApp>
  );
}

// ---------- Invitați ----------

const NEW_GUESTS = ["Andrei Vasile", "Cristina Dobre", "Vlad Neagu"];

function GuestsScreen({ step, acted }: ScreenProps) {
  const sheet = (step === 0 && acted) || step === 1 || (step === 2 && !acted);
  const added = step >= 3 || (step === 2 && acted);
  const da = step === 3 && acted;
  const row = (name: string, grup: string, rsvp: "Da" | "?" | "Nu", target?: string) => (
    <div key={name} className="flex items-center gap-2 px-2 py-1.5">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[11px] font-medium">{name}</span>
        <span className="block text-[9px] text-muted">{grup}</span>
      </span>
      <Rsvp value={rsvp} target={target} />
    </div>
  );
  return (
    <MiniApp page="invitati" title="Invitați">
      <div className="mb-2 flex gap-1.5">
        <MBtn target="bulk">
          <ListPlus className="h-3 w-3" /> Mai mulți
        </MBtn>
        <MBtn primary>
          <Plus className="h-3 w-3" /> Adaugă invitat
        </MBtn>
      </div>
      <div className="mb-1 text-[10px] font-semibold">Familia mireasă</div>
      <MCard className="divide-y divide-border">
        {row("Elena Popescu", "+1 · 1 copil", "Da")}
        {row("Gheorghe Popescu", "Familia mireasă", "Da")}
      </MCard>
      {added && (
        <>
          <div className="mb-1 mt-2 text-[10px] font-semibold">Prieteni</div>
          <MCard className="divide-y divide-border">
            {NEW_GUESTS.map((n, i) => (
              <div key={n} className="guide-in" style={{ animationDelay: `${i * 120}ms` }}>
                {row(n, "Prieteni", i === 0 && da ? "Da" : "?", i === 0 ? "rsvp" : undefined)}
              </div>
            ))}
          </MCard>
        </>
      )}

      {sheet && (
        <div className="guide-in absolute inset-x-0 bottom-0 z-10 rounded-t-2xl border-t border-border bg-surface p-3 shadow-2xl">
          <div className="mb-1.5 font-serif text-[13px] font-semibold">Adaugă mai mulți invitați</div>
          <div className="mb-2 h-20 rounded-md border border-border bg-bg p-1.5 text-[11px] leading-snug">
            {step >= 1 &&
              NEW_GUESTS.map((n, i) => (
                <div key={n} className="guide-in" style={{ animationDelay: `${300 + i * 550}ms` }}>
                  {n}
                </div>
              ))}
          </div>
          <div className="flex justify-end">
            <MBtn primary target="add">
              Adaugă {step >= 1 ? 3 : ""}
            </MBtn>
          </div>
        </div>
      )}
    </MiniApp>
  );
}

// ---------- Costuri ----------

function CostsScreen({ step, acted }: ScreenProps) {
  const card = step >= 1 || (step === 0 && acted);
  const open = step >= 2 || (step === 1 && acted);
  const paid = step >= 3 || (step === 2 && acted);
  const calendar = step === 3;
  return (
    <MiniApp page="costuri" title="Costuri și plăți">
      <div className="mb-2 grid grid-cols-2 gap-1.5">
        <Stat label="Cost total" value={card ? "11.400 €" : "1.500 €"} />
        <Stat label="Plătit" value={paid ? "2.000 €" : "0 €"} tone="success" />
      </div>
      <div className="mb-2">
        <MBtn primary target="add">
          <Plus className="h-3 w-3" /> Adaugă cost
        </MBtn>
      </div>
      <div className="space-y-1.5">
        <MCard className="px-2 py-1.5">
          <div className="flex items-center gap-1.5 text-[11px] font-medium">
            Studio Lumina <MBadge tone="warning">Rezervat</MBadge> <MBadge tone="info">EUR</MBadge>
          </div>
          <div className="text-[9px] text-muted">Foto · total 1.500 € (≈ 7.470 lei)</div>
        </MCard>
        {card && (
          <MCard target="card" className="guide-in px-2 py-1.5">
            <div className="flex items-center gap-1.5 text-[11px] font-medium">
              Restaurant Grădina <MBadge tone="success">Contract</MBadge>
            </div>
            <div className="mb-1 text-[9px] text-muted">Meniu · 95 € × 120 persoane = 11.400 €</div>
            <FillBar key={String(paid)} to={paid ? 18 : 0} tone="success" />
            {open && (
              <div className="guide-in mt-1.5 divide-y divide-border rounded-md border border-border">
                <div className="flex items-center gap-1.5 px-1.5 py-1">
                  <MCheck on={paid} target="check" />
                  <span className={cx("flex-1 text-[10px]", paid && "text-muted line-through")}>Avans · scadență 1 nov.</span>
                  <span className="text-[10px] font-medium">2.000 €</span>
                  <MBadge tone={paid ? "success" : "warning"}>{paid ? "plătit" : "în 12 zile"}</MBadge>
                </div>
                <div className="flex items-center gap-1.5 px-1.5 py-1">
                  <MCheck on={false} />
                  <span className="flex-1 text-[10px]">Rest de plată · 1 iun.</span>
                  <span className="text-[10px] font-medium">9.400 €</span>
                  <MBadge tone="info">în 223 zile</MBadge>
                </div>
              </div>
            )}
          </MCard>
        )}
      </div>
      {calendar && (
        <div className="guide-in absolute inset-x-0 bottom-9 z-10 mx-3 rounded-xl border border-border bg-surface p-2 shadow-2xl">
          <div className="mb-1 font-serif text-[12px] font-semibold">Calendar plăți rămase</div>
          {[
            ["Studio Lumina · Avans", "400 €", "acum 3 zile", "danger"],
            ["Restaurant · Rest de plată", "9.400 €", "în 223 zile", "info"],
          ].map(([t, s, w, tone]) => (
            <div key={t} className="flex items-center gap-1.5 py-1 text-[10px]">
              <span className="flex-1">{t}</span>
              <span className="font-medium">{s}</span>
              <MBadge tone={tone as "danger" | "info"}>{w}</MBadge>
            </div>
          ))}
        </div>
      )}
    </MiniApp>
  );
}

// ---------- Mese ----------

const ROUND_SEATS = ["IM", "+", "EP", "", "GP", ""];

function SeatingScreen({ step, acted }: ScreenProps) {
  const armed = (step === 0 && acted) || (step === 1 && !acted);
  const seated = step >= 2 || (step === 1 && acted);
  const arrange = step >= 3 || (step === 2 && acted);
  const rotated = step === 3 && acted;
  const seat = (i: number, label: string, cx0: number, cy0: number) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / ROUND_SEATS.length;
    const filled = label || (i === 3 && seated);
    return (
      <span
        key={i}
        data-target={i === 3 ? "seat" : undefined}
        className={cx(
          "absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border text-[8px] font-semibold transition-colors duration-300",
          filled ? "border-success/60 bg-success-soft text-success-ink" : armed ? "border-dashed border-primary bg-primary-soft" : "border-dashed border-border bg-surface",
        )}
        style={{ left: cx0 + 46 * Math.cos(a), top: cy0 + 46 * Math.sin(a) }}
      >
        {label || (i === 3 && seated ? "Elena" : "")}
      </span>
    );
  };
  return (
    <MiniApp page="mese" title="Plan de mese">
      <div className="mb-2 inline-flex rounded-md border border-border bg-surface-2 p-px text-[10px] font-medium">
        <span className={cx("rounded px-2 py-0.5 transition-colors", !arrange ? "bg-surface shadow-sm" : "text-muted")}>Așază invitații</span>
        <span data-target="mode" className={cx("rounded px-2 py-0.5 transition-colors", arrange ? "bg-surface shadow-sm" : "text-muted")}>
          Aranjează sala
        </span>
      </div>
      <div className="mb-2 flex gap-1">
        {!seated && (
          <span data-target="chip" className={cx("rounded-md border border-success/30 bg-success-soft px-1.5 py-0.5 text-[10px]", armed && "ring-2 ring-primary")}>
            Elena Popescu
          </span>
        )}
        <span className="rounded-md border border-warning/30 bg-warning-soft px-1.5 py-0.5 text-[10px]">Radu ?</span>
        <span className="rounded-md border border-success/30 bg-success-soft px-1.5 py-0.5 text-[10px]">Ioana</span>
      </div>
      <div
        className="relative h-[230px] rounded-xl border border-border"
        style={{ backgroundImage: "radial-gradient(var(--border) 1px, transparent 1px)", backgroundSize: "12px 12px" }}
      >
        {armed && (
          <div className="guide-in absolute inset-x-1.5 top-1.5 z-10 rounded-md border border-primary/40 bg-surface px-2 py-1 text-[9px]">
            Atinge un loc pentru <b>Elena Popescu</b>
          </div>
        )}
        <div className="absolute left-2 top-9 flex h-9 w-20 flex-col items-center justify-center rounded-md border border-info/50 bg-info-soft text-[8px]">
          <Music className="h-3 w-3 text-info-ink" /> Scena formației
        </div>
        <div className="absolute flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border-2 border-border bg-surface text-[8px]" style={{ left: 72, top: 150 }}>
          Masa 1<span className="text-muted">{seated ? 4 : 3}/6</span>
        </div>
        {ROUND_SEATS.map((l, i) => seat(i, l, 72, 150))}
        <div
          className="absolute transition-transform duration-1000 ease-out motion-reduce:transition-none"
          style={{ left: 150, top: 120, width: 80, height: 40, transform: rotated ? "rotate(45deg)" : undefined }}
        >
          <div className={cx("flex h-full w-full items-center justify-center rounded-md border-2 border-border bg-surface text-[8px]", arrange && "ring-2 ring-primary")}>
            <span style={{ transform: rotated ? "rotate(-45deg)" : undefined }} className="transition-transform duration-1000">
              Masa 2
            </span>
          </div>
          {[14, 40, 66].map((x) => (
            <span key={x} className="absolute h-4 w-4 -translate-x-1/2 rounded-full border border-dashed border-border bg-surface" style={{ left: x, top: -20 }} />
          ))}
          {[14, 40, 66].map((x) => (
            <span key={x} className="absolute h-4 w-4 -translate-x-1/2 rounded-full border border-dashed border-border bg-surface" style={{ left: x, top: 44 }} />
          ))}
          {arrange && (
            <span data-target="rotate" className="absolute -top-11 left-1/2 flex h-5 w-5 -translate-x-1/2 items-center justify-center rounded-full border-2 border-primary bg-surface text-primary-ink">
              <RotateCw className="h-2.5 w-2.5" />
            </span>
          )}
        </div>
      </div>
    </MiniApp>
  );
}

// ---------- De rezolvat ----------

function TasksScreen({ step, acted }: ScreenProps) {
  const list = step >= 1 || (step === 0 && acted);
  const done = step === 2 && acted;
  const task = (title: string, sub: string, extra?: React.ReactNode, target?: string, on = false, late = false) => (
    <div className="flex items-center gap-2 px-2 py-1.5">
      <MCheck on={on} target={target} />
      <span className="min-w-0 flex-1">
        <span className={cx("block truncate text-[11px] font-medium", on && "text-muted line-through")}>{title}</span>
        <span className="block text-[9px] text-muted">{sub}</span>
      </span>
      {extra}
      {late && !on && <MBadge tone="danger">acum 5 zile</MBadge>}
    </div>
  );
  return (
    <MiniApp page="sarcini" title="De rezolvat">
      <div className="mb-2 flex gap-1.5">
        <MBtn target="suggest">
          <Sparkles className="h-3 w-3" /> Listă sugerată
        </MBtn>
        <MBtn primary>
          <Plus className="h-3 w-3" /> Adaugă
        </MBtn>
      </div>
      <div className="mb-1 text-[10px] font-semibold text-danger-ink">Termen depășit</div>
      <MCard className="mb-2">{task("Degustare meniu", "15 oct. · Locație", undefined, "check", done, true)}</MCard>
      {list && (
        <>
          <div className="mb-1 text-[10px] font-semibold">Mai târziu</div>
          <MCard className="divide-y divide-border">
            {[
              ["Rezervăm formația / DJ-ul", "20 sept. 2026 · Muzică", null],
              ["Alegem fotobooth", "19 dec. · Distracție", step >= 1 ? <MBadge tone="info" className="guide-in">~250 €</MBadge> : null],
              ["Comandăm invitațiile", "21 feb. 2027 · Invitații", null],
              ["Trimitem invitațiile", "21 mar. 2027 · Invitații", null],
            ].map(([t, s, e], i) => (
              <div key={t as string} className={cx("guide-in", step === 1 && i === 1 && "bg-info-soft/60")} style={{ animationDelay: `${i * 140}ms` }}>
                {task(t as string, s as string, e as React.ReactNode)}
              </div>
            ))}
          </MCard>
        </>
      )}
    </MiniApp>
  );
}

// ---------- Setări ----------

function SettingsScreen({ step, acted }: ScreenProps) {
  const typed = step >= 1 || (step === 0 && acted);
  const invited = step >= 2 || (step === 1 && acted);
  const dark = step === 2 && acted;
  return (
    <MiniApp page="setari" title="Setări" theme={dark ? "dark" : undefined}>
      <MCard className="mb-2 p-2">
        <div className="mb-1 text-[11px] font-semibold">Partener și acces</div>
        <div className="mb-1.5 flex gap-1.5">
          <span data-target="email" className="flex h-6 min-w-0 flex-1 items-center overflow-hidden rounded-md border border-border bg-bg px-1.5 text-[10px]">
            {typed ? <span className="guide-in">mihai@gmail.com</span> : <span className="text-muted">partener@gmail.com</span>}
          </span>
          <MBtn primary target="invite">Invită</MBtn>
        </div>
        <div className="divide-y divide-border rounded-md border border-border text-[10px]">
          <div className="flex items-center justify-between px-1.5 py-1">
            Ana (tu) <MBadge tone="primary">proprietar</MBadge>
          </div>
          {invited && (
            <div className="guide-in flex items-center justify-between px-1.5 py-1">
              mihai@gmail.com <MBadge>editor</MBadge>
            </div>
          )}
        </div>
        {invited && step === 1 && <div className="guide-in mt-1.5 text-[9px] text-success-ink">✓ A primit un email de la Google cu linkul.</div>}
      </MCard>
      <MCard className="p-2">
        <div className="mb-1 text-[11px] font-semibold">Aspect</div>
        <span className="inline-flex rounded-md border border-border bg-surface-2 p-px text-[10px] font-medium">
          {["Sistem", "Luminos", "Întunecat"].map((t) => (
            <span
              key={t}
              data-target={t === "Întunecat" ? "dark" : undefined}
              className={cx("rounded px-2 py-0.5 transition-colors", (dark ? t === "Întunecat" : t === "Sistem") ? "bg-surface shadow-sm" : "text-muted")}
            >
              {t}
            </span>
          ))}
        </span>
      </MCard>
    </MiniApp>
  );
}

// ---------- scenariile ----------

export const SCENES: Record<Route, GuideScene> = {
  rezumat: {
    id: "rezumat",
    title: "Rezumat",
    Screen: SummaryScreen,
    steps: [
      { caption: "Vezi câte zile mai sunt până la nuntă.", ms: 2400 },
      { caption: "Confirmările, costul total și cât ai plătit, dintr-o privire.", ms: 2700 },
      { caption: "Bara arată cât din buget ai folosit.", ms: 2300 },
      { caption: "Alertele te duc direct la ce e urgent, de exemplu o plată restantă.", ms: 2900, target: "alert", tap: true },
    ],
  },
  invitati: {
    id: "invitati",
    title: "Invitați",
    Screen: GuestsScreen,
    steps: [
      { caption: "Apeși „Mai mulți” ca să adaugi o listă întreagă.", ms: 2300, target: "bulk", tap: true },
      { caption: "Lipești numele, câte unul pe rând: din WhatsApp, Excel sau Notes.", ms: 2700 },
      { caption: "Apeși „Adaugă” și apar toți în listă.", ms: 2200, target: "add", tap: true },
      { caption: "Bifezi cine vine: Da, Nu, sau „?” dacă nu știi încă.", ms: 2800, target: "rsvp", tap: true },
    ],
  },
  costuri: {
    id: "costuri",
    title: "Costuri",
    Screen: CostsScreen,
    steps: [
      { caption: "Adaugi furnizorul, cu prețul în lei sau în euro.", ms: 2400, target: "add", tap: true },
      { caption: "Îl deschizi și programezi avansul și restul, fiecare cu termenul lui.", ms: 2600, target: "card", tap: true },
      { caption: "Bifezi plata când o faci: vezi cât ai plătit și cât mai ai.", ms: 2500, target: "check", tap: true },
      { caption: "Calendarul îți arată ce urmează și ce e restant.", ms: 2700 },
    ],
  },
  mese: {
    id: "mese",
    title: "Mese",
    Screen: SeatingScreen,
    steps: [
      { caption: "În „Așază invitații” atingi un invitat din listă…", ms: 2300, target: "chip", tap: true },
      { caption: "…apoi locul lui. Însoțitorii stau automat alături.", ms: 2500, target: "seat", tap: true },
      { caption: "În „Aranjează sala” muți, rotești și mărești mesele și scena.", ms: 2400, target: "mode", tap: true },
      { caption: "Tragi de butonul rotund ca să rotești masa. Zoom cu două degete.", ms: 2900, target: "rotate", tap: true },
    ],
  },
  sarcini: {
    id: "sarcini",
    title: "De rezolvat",
    Screen: TasksScreen,
    steps: [
      { caption: "Pornești de la lista sugerată: termenele se calculează din data nunții.", ms: 2900, target: "suggest", tap: true },
      { caption: "Poți pune un cost estimat. Nu intră în buget până nu-l transformi în cost.", ms: 3200 },
      { caption: "Bifezi ce ai rezolvat. Ce a depășit termenul apare cu roșu.", ms: 2800, target: "check", tap: true },
    ],
  },
  setari: {
    id: "setari",
    title: "Setări",
    Screen: SettingsScreen,
    steps: [
      { caption: "Invită partenerul cu adresa lui de Google…", ms: 2700, target: "email", tap: true },
      { caption: "…și lucrați amândoi în același planificator.", ms: 2700, target: "invite", tap: true },
      { caption: "Alegi tema: luminoasă, întunecată sau ca telefonul.", ms: 2800, target: "dark", tap: true },
    ],
  },
};

/** Turul de pe pagina de start: cele 4 pagini principale, una după alta (~40 s). */
export const TOUR: GuideScene[] = [SCENES.rezumat, SCENES.invitati, SCENES.costuri, SCENES.mese];

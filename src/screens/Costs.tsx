import { useState } from "react";
import { AlertTriangle, ChevronDown, HandCoins, Lightbulb, Pencil, Plus, Trash2 } from "lucide-react";
import { budgetSummary, convert, costDetails, guestStats, paymentState, rateOf, unitPrice, type PaymentState } from "../lib/calc";
import { daysUntil, formatDate, relativeDays, todayIso } from "../lib/dates";
import { money } from "../lib/format";
import { newId } from "../lib/ids";
import { COST_CATEGORIES, PAYMENT_LABELS } from "../lib/suggestions";
import { MONEDE, STATUS_COST, TIP_COST, type Cost, type Moneda, type Payment, type StatusCost, type TipCost } from "../lib/types";
import { usePlanner } from "../state/planner";
import { href } from "../state/route";
import { useFeedback } from "../components/feedback";
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Progress, SectionTitle, Segmented, Select, Stat, Textarea, cx } from "../components/ui";

const STATUS_TONE: Record<StatusCost, "neutral" | "info" | "warning" | "success"> = {
  "De ales": "neutral",
  Ofertă: "info",
  Rezervat: "warning",
  "Contract semnat": "success",
};

const PAY_TONE: Record<PaymentState, "success" | "danger" | "warning" | "neutral" | "info"> = {
  platit: "success",
  restant: "danger",
  curand: "warning",
  viitor: "info",
  fara_termen: "neutral",
};

const CURRENCY_OPTIONS = MONEDE.map((m) => ({ value: m, label: m === "RON" ? "lei" : "€ EUR" }));

function payLabel(p: Payment): string {
  const st = paymentState(p);
  if (st === "platit") return p.dataPlata ? `plătit ${formatDate(p.dataPlata)}` : "plătit";
  if (st === "fara_termen") return "fără termen";
  return relativeDays(daysUntil(p.scadenta)!);
}

export function Costs() {
  const { data, add, update, remove } = usePlanner();
  const { confirm } = useFeedback();
  const main = data.settings.moneda;
  const rate = rateOf(data.settings);
  const bs = budgetSummary(data);
  const expected = guestStats(data.guests).expected;
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [editCost, setEditCost] = useState<{ cost: Cost; isNew: boolean } | null>(null);
  const [editPay, setEditPay] = useState<{ payment: Payment; cost: Cost; isNew: boolean } | null>(null);

  const costs = [...data.costs].sort((a, b) => a.categorie.localeCompare(b.categorie, "ro") || a.furnizor.localeCompare(b.furnizor, "ro"));
  const toggle = (id: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const schedule = data.payments
    .filter((p) => !p.platit)
    .sort((a, b) => (a.scadenta || "9999").localeCompare(b.scadenta || "9999"));
  const scheduleTotal = schedule.reduce((s, p) => s + convert(p.suma, p.moneda, main, rate), 0);

  const saveCost = async (c: Cost, isNew: boolean) => {
    const ok = isNew ? await add("costs", [c], "Cost adăugat") : await update("costs", [c], "Salvat");
    if (ok) {
      setEditCost(null);
      if (isNew) setOpen((s) => new Set(s).add(c.id));
    }
  };

  const deleteCost = async (c: Cost) => {
    const pays = data.payments.filter((p) => p.costId === c.id);
    const ok = await confirm({
      title: "Ștergi costul?",
      text: `${c.furnizor || c.categorie}${pays.length ? ` și cele ${pays.length} plăți ale lui` : ""} vor fi șterse.`,
      confirmLabel: "Șterge",
      danger: true,
    });
    if (!ok) return;
    if (pays.length && !(await remove("payments", pays.map((p) => p.id)))) return;
    if (await remove("costs", [c.id], "Cost șters")) setEditCost(null);
  };

  const savePay = async (p: Payment, isNew: boolean) => {
    const ok = isNew ? await add("payments", [p], "Plată adăugată") : await update("payments", [p], "Salvat");
    if (ok) setEditPay(null);
  };

  const togglePaid = (p: Payment) =>
    update("payments", [{ ...p, platit: !p.platit, dataPlata: !p.platit ? p.dataPlata || todayIso() : "" }], p.platit ? "Marcată ca neplătită" : "Marcată ca plătită");

  const newPayment = (c: Cost): Payment => {
    const d = costDetails(c, data.payments, expected, rate);
    const first = d.payments.length === 0;
    return {
      id: newId(), costId: c.id, descriere: first ? "Avans" : "Rest de plată", suma: first ? 0 : Math.round(d.unscheduled),
      moneda: c.moneda, scadenta: "", platit: false, dataPlata: "", note: "",
    };
  };

  const openPayment = (p: Payment) => {
    const cost = data.costs.find((c) => c.id === p.costId);
    if (cost) setEditPay({ payment: p, cost, isNew: false });
  };

  const mixed = bs.byCurrency.RON > 0 && bs.byCurrency.EUR > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-semibold">Costuri și plăți</h1>
          <p className="text-sm text-muted">
            Fiecare furnizor cu avansurile, ratele și termenele lui, în lei sau euro. Totalurile sunt în {main === "EUR" ? "euro" : "lei"}, la cursul de{" "}
            {rate.toLocaleString("ro-RO")} lei/€ <a className="text-primary-ink underline" href={href("setari")}>(schimbă)</a>.
          </p>
        </div>
        <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setEditCost({ cost: emptyCost(main), isNew: true })}>
          Adaugă cost
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Cost total"
          value={money(bs.total, main)}
          tone={bs.overBudget ? "danger" : undefined}
          sub={mixed ? `${money(bs.byCurrency.RON, "RON")} + ${money(bs.byCurrency.EUR, "EUR")}` : "preț final sau estimat"}
        />
        <Stat label="Plătit" value={money(bs.paid, main)} tone="success" />
        <Stat label="Rest de plată" value={money(bs.remaining, main)} />
        <Stat
          label="Buget"
          value={bs.budget ? money(bs.budget, main) : "nesetat"}
          sub={bs.budget ? (bs.overBudget ? `depășit cu ${money(-bs.leftInBudget, main)}` : `rămân ${money(bs.leftInBudget, main)}`) : "setează-l în Setări"}
          tone={bs.overBudget ? "danger" : undefined}
        />
      </div>

      {bs.overBudget && (
        <div className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger-ink">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Costurile ({money(bs.total, main)}) depășesc bugetul ({money(bs.budget, main)}) cu {money(bs.total - bs.budget, main)}.
        </div>
      )}

      {bs.potential > 0 && (
        <a href={href("sarcini")} className="flex items-center gap-2 rounded-xl border border-info/30 bg-info-soft px-4 py-3 text-sm text-info-ink hover:opacity-90">
          <Lightbulb className="h-4 w-4 shrink-0" />
          Încă {money(bs.potential, main)} costuri potențiale în „De rezolvat” (nu intră în total până nu le transformi în cost).
        </a>
      )}

      {schedule.length > 0 && (
        <section>
          <SectionTitle action={<span className="text-sm text-muted">≈ {money(scheduleTotal, main)}</span>}>Calendar plăți rămase</SectionTitle>
          <Card className="divide-y divide-border">
            {schedule.map((p) => {
              const c = data.costs.find((x) => x.id === p.costId);
              const st = paymentState(p);
              return (
                <div key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                  <input type="checkbox" className="h-4 w-4 accent-[var(--primary)]" checked={p.platit} onChange={() => togglePaid(p)} aria-label="Marchează ca plătită" />
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => openPayment(p)}>
                    <div className="truncate text-sm font-medium">
                      {c?.furnizor || c?.categorie || "Cost șters"} · {p.descriere}
                    </div>
                    <div className="text-xs text-muted">{p.scadenta ? formatDate(p.scadenta) : "fără termen"}</div>
                  </button>
                  <div className="text-right">
                    <div className="text-sm font-semibold tabular-nums">{money(p.suma, p.moneda)}</div>
                    <Badge tone={PAY_TONE[st]}>{payLabel(p)}</Badge>
                  </div>
                </div>
              );
            })}
          </Card>
        </section>
      )}

      <section>
        <SectionTitle>Furnizori</SectionTitle>
        {costs.length === 0 ? (
          <EmptyState icon={<HandCoins className="h-6 w-6" />} title="Niciun cost încă">
            Adaugă locația, fotograful, formația… Fiecare poate avea avans și rest de plată cu termene, în lei sau euro.
          </EmptyState>
        ) : (
          <div className="space-y-3">
            {costs.map((c) => {
              const d = costDetails(c, data.payments, expected, rate);
              const isOpen = open.has(c.id);
              const cur = c.moneda;
              return (
                <Card key={c.id}>
                  <button type="button" onClick={() => toggle(c.id)} className="flex w-full items-start gap-3 p-4 text-left" aria-expanded={isOpen}>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{c.furnizor || c.categorie || "Cost fără nume"}</span>
                        <Badge tone={STATUS_TONE[c.status]}>{c.status}</Badge>
                        {c.contractat === null && <Badge>estimat</Badge>}
                        {cur !== main && <Badge tone="info">{cur}</Badge>}
                      </div>
                      <div className="mt-0.5 text-xs text-muted">
                        {c.furnizor && c.categorie}
                        {c.tip === "Per persoană" && ` · ${money(unitPrice(c), cur)} × ${expected} persoane`}
                      </div>
                      <div className="mt-3">
                        <Progress value={d.paid} max={d.total} tone="success" />
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted tabular-nums">
                        <span>
                          Total <b className="text-text">{money(d.total, cur)}</b>
                          {cur !== main && ` (≈ ${money(convert(d.total, cur, main, rate), main)})`}
                        </span>
                        <span>
                          Plătit <b className="text-success-ink">{money(d.paid, cur)}</b>
                        </span>
                        <span>
                          Rest <b className="text-text">{money(d.remaining, cur)}</b>
                        </span>
                        {d.next && (
                          <span className={cx(paymentState(d.next) === "restant" && "text-danger-ink")}>
                            Următoarea: {money(d.next.suma, d.next.moneda)} {payLabel(d.next)}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronDown className={cx("mt-1 h-5 w-5 shrink-0 text-muted transition-transform", isOpen && "rotate-180")} />
                  </button>

                  {isOpen && (
                    <div className="border-t border-border px-4 pb-4 pt-3">
                      {d.payments.length === 0 ? (
                        <p className="text-sm text-muted">Nicio plată programată.</p>
                      ) : (
                        <div className="divide-y divide-border rounded-lg border border-border">
                          {d.payments.map((p) => (
                            <div key={p.id} className="flex items-center gap-3 px-3 py-2">
                              <input type="checkbox" className="h-4 w-4 accent-[var(--primary)]" checked={p.platit} onChange={() => togglePaid(p)} aria-label="Plătit" />
                              <div className="min-w-0 flex-1">
                                <div className={cx("text-sm", p.platit && "text-muted line-through")}>{p.descriere}</div>
                                <div className="text-xs text-muted">{p.scadenta ? `scadență ${formatDate(p.scadenta)}` : "fără termen"}</div>
                              </div>
                              <span className="text-right text-sm font-medium tabular-nums">
                                {money(p.suma, p.moneda)}
                                {p.moneda !== cur && <span className="block text-xs font-normal text-muted">≈ {money(convert(p.suma, p.moneda, cur, rate), cur)}</span>}
                              </span>
                              <Badge tone={PAY_TONE[paymentState(p)]}>{payLabel(p)}</Badge>
                              <button type="button" className="rounded-md p-1 text-muted hover:bg-surface-2" onClick={() => setEditPay({ payment: p, cost: c, isNew: false })} aria-label="Editează plata">
                                <Pencil className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      {d.unscheduled > 0.5 && d.payments.length > 0 && (
                        <p className="mt-2 text-xs text-warning-ink">{money(d.unscheduled, cur)} din total nu au încă o plată programată.</p>
                      )}
                      {c.contact && <p className="mt-2 text-xs text-muted">Contact: {c.contact}</p>}
                      {c.note && <p className="mt-1 text-xs text-muted">{c.note}</p>}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button size="sm" variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setEditPay({ payment: newPayment(c), cost: c, isNew: true })}>
                          Adaugă plată
                        </Button>
                        <Button size="sm" icon={<Pencil className="h-4 w-4" />} onClick={() => setEditCost({ cost: c, isNew: false })}>
                          Editează costul
                        </Button>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {bs.byCategory.length > 1 && (
        <section>
          <SectionTitle>Pe categorii</SectionTitle>
          <Card className="space-y-3 p-4">
            {bs.byCategory.map(([cat, value]) => (
              <div key={cat}>
                <div className="mb-1 flex justify-between text-sm">
                  <span>{cat}</span>
                  <span className="tabular-nums text-muted">{money(value, main)}</span>
                </div>
                <Progress value={value} max={bs.total} />
              </div>
            ))}
          </Card>
        </section>
      )}

      {editCost && (
        <CostForm
          initial={editCost.cost}
          isNew={editCost.isNew}
          main={main}
          rate={rate}
          expected={expected}
          onClose={() => setEditCost(null)}
          onSave={(c) => saveCost(c, editCost.isNew)}
          onDelete={() => deleteCost(editCost.cost)}
        />
      )}
      {editPay && (
        <PaymentForm
          initial={editPay.payment}
          cost={editPay.cost}
          rate={rate}
          isNew={editPay.isNew}
          onClose={() => setEditPay(null)}
          onSave={(p) => savePay(p, editPay.isNew)}
          onDelete={async () => {
            if (await confirm({ title: "Ștergi plata?", text: `${editPay.payment.descriere} · ${money(editPay.payment.suma, editPay.payment.moneda)}`, confirmLabel: "Șterge", danger: true })) {
              if (await remove("payments", [editPay.payment.id], "Plată ștearsă")) setEditPay(null);
            }
          }}
        />
      )}
    </div>
  );
}

export const emptyCost = (moneda: Moneda): Cost => ({
  id: newId(), categorie: "", furnizor: "", contact: "", tip: "Fix", moneda, estimat: 0, contractat: null, status: "De ales", note: "",
});

export function CostForm({
  initial, isNew, main, rate, expected, onClose, onSave, onDelete,
}: { initial: Cost; isNew: boolean; main: Moneda; rate: number; expected: number; onClose: () => void; onSave: (c: Cost) => void; onDelete?: () => void }) {
  const [c, setC] = useState(initial);
  const set = <K extends keyof Cost>(k: K, v: Cost[K]) => setC((x) => ({ ...x, [k]: v }));
  const perPerson = c.tip === "Per persoană";
  const sym = c.moneda === "EUR" ? "€" : "lei";

  return (
    <Modal
      open
      onClose={onClose}
      title={isNew ? "Cost nou" : "Editează costul"}
      footer={
        <>
          {!isNew && onDelete && (
            <Button variant="ghost" className="mr-auto text-danger-ink" icon={<Trash2 className="h-4 w-4" />} onClick={onDelete}>
              Șterge
            </Button>
          )}
          <Button onClick={onClose}>Renunță</Button>
          <Button variant="primary" type="submit" form="cost-form">Salvează</Button>
        </>
      }
    >
      <form id="cost-form" className="space-y-3" onSubmit={(e) => { e.preventDefault(); onSave(c); }}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Categorie">
            <Input list="cost-cats" required value={c.categorie} onChange={(e) => set("categorie", e.target.value)} placeholder="ex: Foto" />
            <datalist id="cost-cats">{COST_CATEGORIES.map((x) => <option key={x} value={x} />)}</datalist>
          </Field>
          <Field label="Furnizor">
            <Input value={c.furnizor} onChange={(e) => set("furnizor", e.target.value)} placeholder="ex: Studio Lumina" />
          </Field>
        </div>
        <Field label="Contact">
          <Input value={c.contact} onChange={(e) => set("contact", e.target.value)} placeholder="telefon, email, persoană de contact" />
        </Field>
        <div className="grid gap-3 sm:grid-cols-[auto_1fr_1fr]">
          <Field label="Monedă">
            <div>
              <Segmented value={c.moneda} options={CURRENCY_OPTIONS} onChange={(v) => set("moneda", v)} />
            </div>
          </Field>
          <Field label="Tip cost">
            <Select value={c.tip} onChange={(e) => set("tip", e.target.value as TipCost)}>
              {TIP_COST.map((t) => <option key={t}>{t}</option>)}
            </Select>
          </Field>
          <Field label="Status">
            <Select value={c.status} onChange={(e) => set("status", e.target.value as StatusCost)}>
              {STATUS_COST.map((t) => <option key={t}>{t}</option>)}
            </Select>
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={perPerson ? `Preț estimat / persoană (${sym})` : `Cost estimat (${sym})`}>
            <Input type="number" min={0} step="any" value={c.estimat || ""} onChange={(e) => set("estimat", Number(e.target.value) || 0)} />
          </Field>
          <Field label={perPerson ? `Preț final / persoană (${sym})` : `Preț final (${sym})`} hint="Gol până ai contract sau ofertă fermă">
            <Input type="number" min={0} step="any" value={c.contractat ?? ""} onChange={(e) => set("contractat", e.target.value === "" ? null : Number(e.target.value) || 0)} />
          </Field>
        </div>
        {(perPerson || c.moneda !== main) && (
          <p className="rounded-lg bg-info-soft p-2.5 text-xs text-info-ink">
            {perPerson && `Totalul se calculează cu persoanele estimate (confirmate + fără răspuns): acum ${expected}, adică ${money(unitPrice(c) * expected, c.moneda)}. `}
            {c.moneda !== main && `În totaluri apare ca ≈ ${money(convert(perPerson ? unitPrice(c) * expected : unitPrice(c), c.moneda, main, rate), main)} (curs ${rate} lei/€).`}
          </p>
        )}
        <Field label="Note">
          <Textarea value={c.note} onChange={(e) => set("note", e.target.value)} />
        </Field>
      </form>
    </Modal>
  );
}

function PaymentForm({
  initial, cost, rate, isNew, onClose, onSave, onDelete,
}: { initial: Payment; cost: Cost; rate: number; isNew: boolean; onClose: () => void; onSave: (p: Payment) => void; onDelete: () => void }) {
  const [p, setP] = useState(initial);
  const set = <K extends keyof Payment>(k: K, v: Payment[K]) => setP((x) => ({ ...x, [k]: v }));

  return (
    <Modal
      open
      onClose={onClose}
      title={isNew ? `Plată nouă · ${cost.furnizor || cost.categorie}` : "Editează plata"}
      footer={
        <>
          {!isNew && (
            <Button variant="ghost" className="mr-auto text-danger-ink" icon={<Trash2 className="h-4 w-4" />} onClick={onDelete}>
              Șterge
            </Button>
          )}
          <Button onClick={onClose}>Renunță</Button>
          <Button variant="primary" type="submit" form="pay-form">Salvează</Button>
        </>
      }
    >
      <form id="pay-form" className="space-y-3" onSubmit={(e) => { e.preventDefault(); onSave(p); }}>
        <Field label="Descriere">
          <Input list="pay-labels" required value={p.descriere} onChange={(e) => set("descriere", e.target.value)} />
          <datalist id="pay-labels">{PAYMENT_LABELS.map((x) => <option key={x} value={x} />)}</datalist>
        </Field>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <Field label={`Sumă (${p.moneda === "EUR" ? "€" : "lei"})`}>
            <Input type="number" min={0} step="any" required value={p.suma || ""} onChange={(e) => set("suma", Number(e.target.value) || 0)} />
          </Field>
          <Field label="Monedă">
            <div>
              <Segmented value={p.moneda} options={CURRENCY_OPTIONS} onChange={(v) => set("moneda", v)} />
            </div>
          </Field>
        </div>
        {p.moneda !== cost.moneda && p.suma > 0 && (
          <p className="text-xs text-muted">
            Contractul e în {cost.moneda}: plata contează ca ≈ {money(convert(p.suma, p.moneda, cost.moneda, rate), cost.moneda)} (curs {rate} lei/€).
          </p>
        )}
        <Field label="Termen de plată (scadență)" hint="Până când trebuie plătită">
          <Input type="date" value={p.scadenta} onChange={(e) => set("scadenta", e.target.value)} />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-[var(--primary)]" checked={p.platit} onChange={(e) => setP((x) => ({ ...x, platit: e.target.checked, dataPlata: e.target.checked ? x.dataPlata || todayIso() : "" }))} />
          Plătită
        </label>
        {p.platit && (
          <Field label="Data plății">
            <Input type="date" value={p.dataPlata} onChange={(e) => set("dataPlata", e.target.value)} />
          </Field>
        )}
        <Field label="Note">
          <Textarea value={p.note} onChange={(e) => set("note", e.target.value)} placeholder="ex: transfer bancar, cash, chitanță nr." />
        </Field>
      </form>
    </Modal>
  );
}

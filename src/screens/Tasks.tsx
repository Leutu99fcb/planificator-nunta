import { useState } from "react";
import { ChevronDown, HandCoins, ListChecks, Plus, Sparkles, Trash2 } from "lucide-react";
import { budgetSummary, guestStats, rateOf, sortTasks, taskBucket, type TaskBucket } from "../lib/calc";
import { daysUntil, formatDate, relativeDays } from "../lib/dates";
import { newId } from "../lib/ids";
import { money, plural } from "../lib/format";
import { suggestedTasks } from "../lib/suggestions";
import { MONEDE, STATUS_SARCINA, type Cost, type Moneda, type StatusSarcina, type Task } from "../lib/types";
import { usePlanner } from "../state/planner";
import { useFeedback } from "../components/feedback";
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Segmented, Select, Textarea, cx } from "../components/ui";
import { CostForm, emptyCost } from "./Costs";

const BUCKETS: { key: TaskBucket; title: string }[] = [
  { key: "restante", title: "Termen depășit" },
  { key: "curand", title: "În următoarele 30 de zile" },
  { key: "mai_tarziu", title: "Mai târziu" },
  { key: "fara_termen", title: "Fără termen" },
  { key: "gata", title: "Gata" },
];

const emptyTask = (moneda: Moneda): Task => ({
  id: newId(), titlu: "", categorie: "", termen: "", responsabil: "", status: "De făcut", costPotential: null, monedaCost: moneda, note: "",
});

export function Tasks() {
  const { data, add, update, remove } = usePlanner();
  const { confirm } = useFeedback();
  const main = data.settings.moneda;
  const [editing, setEditing] = useState<{ task: Task; isNew: boolean } | null>(null);
  const [toCost, setToCost] = useState<{ task: Task; cost: Cost } | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [who, setWho] = useState("");

  const people = [...new Set(data.tasks.map((t) => t.responsabil.trim()).filter(Boolean))].sort();
  const categories = [...new Set(data.tasks.map((t) => t.categorie.trim()).filter(Boolean))].sort();
  const visible = sortTasks(data.tasks).filter((t) => !who || t.responsabil.trim() === who);
  const left = data.tasks.filter((t) => t.status !== "Gata").length;
  const potential = budgetSummary(data).potential;

  const toggleDone = (t: Task) => update("tasks", [{ ...t, status: t.status === "Gata" ? "De făcut" : "Gata" }]);

  const save = async (t: Task, isNew: boolean) => {
    const ok = isNew ? await add("tasks", [t], "Adăugat") : await update("tasks", [t], "Salvat");
    if (ok) setEditing(null);
  };

  const startConvert = (t: Task) => {
    setEditing(null);
    setToCost({
      task: t,
      cost: { ...emptyCost(t.monedaCost), categorie: t.categorie || "Altele", furnizor: "", estimat: t.costPotential ?? 0, note: t.titlu },
    });
  };

  // Costul nou intră în Costuri, iar sarcina rămâne, fără costul potențial (ca să nu-l numărăm de două ori)
  const finishConvert = async (cost: Cost) => {
    if (!toCost) return;
    if (!(await add("costs", [cost], "Cost adăugat în Costuri"))) return;
    await update("tasks", [{ ...toCost.task, costPotential: null }]);
    setToCost(null);
  };

  const addSuggested = async () => {
    const list = suggestedTasks(data.settings.dataNunta, data.tasks, main);
    if (!list.length) return;
    const ok = await confirm({
      title: "Adaugi lista sugerată?",
      text: data.settings.dataNunta
        ? `Adăugăm ${list.length} lucruri obișnuite la o nuntă, cu termene calculate față de data nunții. Le poți edita sau șterge după.`
        : `Adăugăm ${list.length} lucruri obișnuite la o nuntă. Setează data nunții în Setări ca să primească și termene.`,
      confirmLabel: "Adaugă",
    });
    if (ok) await add("tasks", list, `${plural(list.length, "lucru adăugat", "lucruri adăugate")}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-semibold">De rezolvat</h1>
          <p className="text-sm text-muted">
            {left ? `${plural(left, "lucru rămas", "lucruri rămase")}` : "Totul e rezolvat"}
            {potential > 0 && ` · costuri potențiale ${money(potential, main)}`}
          </p>
        </div>
        <div className="flex gap-2">
          {suggestedTasks(data.settings.dataNunta, data.tasks, main).length > 0 && (
            <Button icon={<Sparkles className="h-4 w-4" />} onClick={addSuggested}>
              Listă sugerată
            </Button>
          )}
          <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setEditing({ task: emptyTask(main), isNew: true })}>
            Adaugă
          </Button>
        </div>
      </div>

      {people.length > 1 && (
        <Select className="max-w-60" value={who} onChange={(e) => setWho(e.target.value)} aria-label="Filtru responsabil">
          <option value="">Toți responsabilii</option>
          {people.map((p) => <option key={p}>{p}</option>)}
        </Select>
      )}

      {data.tasks.length === 0 ? (
        <EmptyState icon={<ListChecks className="h-6 w-6" />} title="Nimic de rezolvat încă">
          Adaugă lucrurile de care trebuie să vă ocupați sau pornește de la „Listă sugerată”.
        </EmptyState>
      ) : (
        BUCKETS.map(({ key, title }) => {
          const list = visible.filter((t) => taskBucket(t) === key);
          if (!list.length) return null;
          const collapsed = key === "gata" && !showDone;
          return (
            <section key={key}>
              <button
                type="button"
                className="mb-1.5 flex items-center gap-2 px-1 text-sm font-semibold"
                onClick={() => key === "gata" && setShowDone(!showDone)}
                disabled={key !== "gata"}
              >
                <span className={cx(key === "restante" && "text-danger")}>{title}</span>
                <span className="text-xs font-normal text-muted">{list.length}</span>
                {key === "gata" && <ChevronDown className={cx("h-4 w-4 text-muted transition-transform", showDone && "rotate-180")} />}
              </button>
              {!collapsed && (
                <Card className="divide-y divide-border">
                  {list.map((t) => {
                    const d = daysUntil(t.termen);
                    return (
                      <div key={t.id} className="flex items-center gap-3 px-4 py-2.5">
                        <input
                          type="checkbox"
                          className="h-5 w-5 shrink-0 accent-[var(--primary)]"
                          checked={t.status === "Gata"}
                          onChange={() => toggleDone(t)}
                          aria-label={`Marchează „${t.titlu}” ca rezolvat`}
                        />
                        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setEditing({ task: t, isNew: false })}>
                          <div className={cx("text-sm font-medium", t.status === "Gata" && "text-muted line-through")}>{t.titlu}</div>
                          <div className="flex flex-wrap gap-x-2 text-xs text-muted">
                            {t.termen && <span>{formatDate(t.termen)}</span>}
                            {t.categorie && <span>{t.categorie}</span>}
                            {t.responsabil && <span>· {t.responsabil}</span>}
                          </div>
                        </button>
                        {t.costPotential ? <Badge tone="info">~{money(t.costPotential, t.monedaCost)}</Badge> : null}
                        {t.status === "În lucru" && <Badge tone="info">în lucru</Badge>}
                        {t.status !== "Gata" && d !== null && d <= 30 && <Badge tone={d < 0 ? "danger" : "warning"}>{relativeDays(d)}</Badge>}
                      </div>
                    );
                  })}
                </Card>
              )}
            </section>
          );
        })
      )}

      {editing && (
        <TaskForm
          initial={editing.task}
          isNew={editing.isNew}
          people={people}
          categories={categories}
          onClose={() => setEditing(null)}
          onSave={(t) => save(t, editing.isNew)}
          onConvert={editing.isNew ? undefined : startConvert}
          onDelete={async () => {
            if (await confirm({ title: "Ștergi?", text: editing.task.titlu, confirmLabel: "Șterge", danger: true })) {
              if (await remove("tasks", [editing.task.id], "Șters")) setEditing(null);
            }
          }}
        />
      )}

      {toCost && (
        <CostForm
          initial={toCost.cost}
          isNew
          main={main}
          rate={rateOf(data.settings)}
          expected={guestStats(data.guests).expected}
          onClose={() => setToCost(null)}
          onSave={finishConvert}
        />
      )}
    </div>
  );
}

function TaskForm({
  initial, isNew, people, categories, onClose, onSave, onDelete, onConvert,
}: {
  initial: Task;
  isNew: boolean;
  people: string[];
  categories: string[];
  onClose: () => void;
  onSave: (t: Task) => void;
  onDelete: () => void;
  onConvert?: (t: Task) => void;
}) {
  const [t, setT] = useState(initial);
  const set = <K extends keyof Task>(k: K, v: Task[K]) => setT((x) => ({ ...x, [k]: v }));
  return (
    <Modal
      open
      onClose={onClose}
      title={isNew ? "Lucru nou de rezolvat" : "Editează"}
      footer={
        <>
          {!isNew && (
            <Button variant="ghost" className="mr-auto text-danger" icon={<Trash2 className="h-4 w-4" />} onClick={onDelete}>
              Șterge
            </Button>
          )}
          <Button onClick={onClose}>Renunță</Button>
          <Button variant="primary" type="submit" form="task-form">Salvează</Button>
        </>
      }
    >
      <form id="task-form" className="space-y-3" onSubmit={(e) => { e.preventDefault(); onSave({ ...t, titlu: t.titlu.trim() }); }}>
        <Field label="Ce trebuie făcut">
          <Input required value={t.titlu} onChange={(e) => set("titlu", e.target.value)} placeholder="ex: Sunăm la florărie pentru ofertă" />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Termen">
            <Input type="date" value={t.termen} onChange={(e) => set("termen", e.target.value)} />
          </Field>
          <Field label="Status">
            <Select value={t.status} onChange={(e) => set("status", e.target.value as StatusSarcina)}>
              {STATUS_SARCINA.map((s) => <option key={s}>{s}</option>)}
            </Select>
          </Field>
          <Field label="Responsabil">
            <Input list="task-people" value={t.responsabil} onChange={(e) => set("responsabil", e.target.value)} />
            <datalist id="task-people">{people.map((p) => <option key={p} value={p} />)}</datalist>
          </Field>
          <Field label="Categorie">
            <Input list="task-cats" value={t.categorie} onChange={(e) => set("categorie", e.target.value)} />
            <datalist id="task-cats">{categories.map((p) => <option key={p} value={p} />)}</datalist>
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <Field label="Cost potențial (opțional)" hint="Cât crezi că va costa. Nu intră în total până nu-l transformi în cost.">
            <Input
              type="number"
              min={0}
              step="any"
              value={t.costPotential ?? ""}
              onChange={(e) => set("costPotential", e.target.value === "" ? null : Number(e.target.value) || 0)}
              placeholder="ex: 1500"
            />
          </Field>
          <Field label="Monedă">
            <div>
              <Segmented value={t.monedaCost} options={MONEDE.map((m) => ({ value: m, label: m === "RON" ? "lei" : "€ EUR" }))} onChange={(v) => set("monedaCost", v)} />
            </div>
          </Field>
        </div>
        {onConvert && (t.costPotential ?? 0) > 0 && (
          <Button size="sm" icon={<HandCoins className="h-4 w-4" />} onClick={() => onConvert(t)}>
            Transformă în cost (în Costuri)
          </Button>
        )}
        <Field label="Note">
          <Textarea value={t.note} onChange={(e) => set("note", e.target.value)} />
        </Field>
      </form>
    </Modal>
  );
}

import { useMemo, useState } from "react";
import { ListPlus, Pencil, Plus, Search, Trash2, UserRound, Users } from "lucide-react";
import { guestStats, persons, seatTables } from "../lib/calc";
import { newId } from "../lib/ids";
import { PARTE, RSVP, type Guest, type Parte, type Rsvp } from "../lib/types";
import { plural } from "../lib/format";
import { usePlanner } from "../state/planner";
import { useFeedback } from "../components/feedback";
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Segmented, Select, Textarea } from "../components/ui";

const RSVP_OPTIONS = [
  { value: "Da", label: "Da" },
  { value: "Necunoscut", label: "?" },
  { value: "Nu", label: "Nu" },
] as const satisfies readonly { value: Rsvp; label: string }[];
const RSVP_TONES = { Da: "success", Nu: "danger", Necunoscut: "warning" } as const;

const emptyGuest = (): Guest => ({
  id: newId(), nume: "", grup: "", parte: "Comun", rsvp: "Necunoscut", insotitori: 0, copii: 0,
  restrictii: "", telefon: "", masaId: "", loc: null, note: "",
});

export function Guests() {
  const { data, add, update, remove } = usePlanner();
  const { confirm } = useFeedback();
  const [query, setQuery] = useState("");
  const [rsvp, setRsvp] = useState<Rsvp | "">("");
  const [parte, setParte] = useState<Parte | "">("");
  const [editing, setEditing] = useState<{ guest: Guest; isNew: boolean } | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);

  const stats = guestStats(data.guests);
  const groups = useMemo(() => [...new Set(data.guests.map((g) => g.grup.trim()).filter(Boolean))].sort(), [data.guests]);
  const tableName = (id: string) => data.tables.find((t) => t.id === id)?.nume;

  const filtered = data.guests
    .filter((g) => {
      const q = query.trim().toLowerCase();
      if (q && !`${g.nume} ${g.grup} ${g.note} ${g.telefon}`.toLowerCase().includes(q)) return false;
      if (rsvp && g.rsvp !== rsvp) return false;
      if (parte && g.parte !== parte) return false;
      return true;
    })
    .sort((a, b) => (a.grup || "~").localeCompare(b.grup || "~", "ro") || a.nume.localeCompare(b.nume, "ro"));

  const byGroup = new Map<string, Guest[]>();
  for (const g of filtered) {
    const key = g.grup.trim() || "Fără grup";
    byGroup.set(key, [...(byGroup.get(key) ?? []), g]);
  }

  const save = async (g: Guest, isNew: boolean) => {
    const ok = isNew ? await add("guests", [g], "Invitat adăugat") : await update("guests", [g], "Salvat");
    if (ok) setEditing(null);
  };

  const del = async (g: Guest) => {
    if (!(await confirm({ title: "Ștergi invitatul?", text: `${g.nume} va fi șters din listă.`, confirmLabel: "Șterge", danger: true }))) return;
    if (await remove("guests", [g.id], "Invitat șters")) setEditing(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-semibold">Invitați</h1>
          <p className="text-sm text-muted">
            {plural(stats.total, "persoană", "persoane")} · <span className="text-success">{stats.confirmed} confirmate</span> ·{" "}
            <span className="text-warning">{stats.unknown} fără răspuns</span> · <span className="text-danger">{stats.declined} refuzuri</span>
          </p>
        </div>
        <div className="flex gap-2">
          <Button icon={<ListPlus className="h-4 w-4" />} onClick={() => setBulkOpen(true)}>
            Mai mulți
          </Button>
          <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setEditing({ guest: emptyGuest(), isNew: true })}>
            Adaugă invitat
          </Button>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input className="pl-9" placeholder="Caută după nume, grup, note…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <Select value={rsvp} onChange={(e) => setRsvp(e.target.value as Rsvp | "")} aria-label="Filtru RSVP">
          <option value="">Toate răspunsurile</option>
          {RSVP.map((r) => (
            <option key={r} value={r}>{r === "Necunoscut" ? "Fără răspuns" : r === "Da" ? "Vin" : "Nu vin"}</option>
          ))}
        </Select>
        <Select value={parte} onChange={(e) => setParte(e.target.value as Parte | "")} aria-label="Filtru partea">
          <option value="">Ambele părți</option>
          {PARTE.map((p) => (
            <option key={p} value={p}>{p === "Comun" ? "Comuni" : `Partea ${p.toLowerCase()}`}</option>
          ))}
        </Select>
      </div>

      {data.guests.length === 0 ? (
        <EmptyState icon={<Users className="h-6 w-6" />} title="Niciun invitat încă">
          Adaugă-i unul câte unul sau lipește o listă cu „Mai mulți”.
        </EmptyState>
      ) : filtered.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted">Niciun invitat nu se potrivește filtrelor.</Card>
      ) : (
        <div className="space-y-4">
          {[...byGroup.entries()].map(([group, list]) => (
            <section key={group}>
              <div className="mb-1.5 flex items-baseline gap-2 px-1">
                <h2 className="text-sm font-semibold">{group}</h2>
                <span className="text-xs text-muted">{plural(list.reduce((s, g) => s + persons(g), 0), "persoană", "persoane")}</span>
              </div>
              <Card className="divide-y divide-border">
                {list.map((g) => (
                  <div key={g.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5">
                    <button type="button" onClick={() => setEditing({ guest: g, isNew: false })} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                      <UserRound className="h-4 w-4 shrink-0 text-muted" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{g.nume || "(fără nume)"}</span>
                        <span className="flex flex-wrap gap-1 pt-0.5">
                          {g.insotitori > 0 && <Badge>+{g.insotitori}</Badge>}
                          {g.copii > 0 && <Badge tone="info">{plural(g.copii, "copil", "copii")}</Badge>}
                          {g.restrictii && <Badge tone="warning">{g.restrictii}</Badge>}
                          {g.parte !== "Comun" && <Badge tone="primary">{g.parte}</Badge>}
                          {tableName(g.masaId) && <Badge>{tableName(g.masaId)}</Badge>}
                        </span>
                      </span>
                    </button>
                    <Segmented
                      size="sm"
                      value={g.rsvp}
                      options={RSVP_OPTIONS}
                      tones={RSVP_TONES}
                      onChange={(v) => v !== g.rsvp && update("guests", [{ ...g, rsvp: v }])}
                    />
                    <button type="button" className="rounded-md p-1.5 text-muted hover:bg-surface-2" onClick={() => setEditing({ guest: g, isNew: false })} aria-label={`Editează ${g.nume}`}>
                      <Pencil className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </Card>
            </section>
          ))}
        </div>
      )}

      {editing && (
        <GuestForm
          initial={editing.guest}
          isNew={editing.isNew}
          groups={groups}
          tables={seatTables(data.tables)}
          onClose={() => setEditing(null)}
          onSave={(g) => save(g, editing.isNew)}
          onDelete={() => del(editing.guest)}
        />
      )}
      {bulkOpen && <BulkAdd groups={groups} onClose={() => setBulkOpen(false)} onAdd={async (rows) => (await add("guests", rows, `${plural(rows.length, "invitat adăugat", "invitați adăugați")}`)) && setBulkOpen(false)} />}
    </div>
  );
}

function GuestForm({
  initial, isNew, groups, tables, onClose, onSave, onDelete,
}: {
  initial: Guest;
  isNew: boolean;
  groups: string[];
  tables: { id: string; nume: string }[];
  onClose: () => void;
  onSave: (g: Guest) => void;
  onDelete: () => void;
}) {
  const [g, setG] = useState(initial);
  const set = <K extends keyof Guest>(k: K, v: Guest[K]) => setG((x) => ({ ...x, [k]: v }));

  return (
    <Modal
      open
      onClose={onClose}
      title={isNew ? "Invitat nou" : "Editează invitatul"}
      footer={
        <>
          {!isNew && (
            <Button variant="ghost" className="mr-auto text-danger" icon={<Trash2 className="h-4 w-4" />} onClick={onDelete}>
              Șterge
            </Button>
          )}
          <Button onClick={onClose}>Renunță</Button>
          <Button variant="primary" type="submit" form="guest-form">
            Salvează
          </Button>
        </>
      }
    >
      <form
        id="guest-form"
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          onSave({ ...g, nume: g.nume.trim(), grup: g.grup.trim() });
        }}
      >
        <Field label="Nume">
          <Input autoFocus required value={g.nume} onChange={(e) => set("nume", e.target.value)} placeholder="ex: Familia Popescu" />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Grup / familie">
            <Input list="guest-groups" value={g.grup} onChange={(e) => set("grup", e.target.value)} placeholder="ex: Colegi" />
            <datalist id="guest-groups">
              {groups.map((x) => <option key={x} value={x} />)}
            </datalist>
          </Field>
          <Field label="Partea">
            <Select value={g.parte} onChange={(e) => set("parte", e.target.value as Parte)}>
              {PARTE.map((p) => <option key={p}>{p}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Vine?">
          <div>
            <Segmented value={g.rsvp} options={[{ value: "Da", label: "Da" }, { value: "Necunoscut", label: "Nu știm încă" }, { value: "Nu", label: "Nu" }]} tones={RSVP_TONES} onChange={(v) => set("rsvp", v)} />
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Însoțitori (adulți)" hint="Pe lângă invitatul principal">
            <Input type="number" min={0} max={20} value={g.insotitori} onChange={(e) => set("insotitori", Math.max(0, Number(e.target.value) || 0))} />
          </Field>
          <Field label="Copii">
            <Input type="number" min={0} max={20} value={g.copii} onChange={(e) => set("copii", Math.max(0, Number(e.target.value) || 0))} />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Restricții alimentare">
            <Input value={g.restrictii} onChange={(e) => set("restrictii", e.target.value)} placeholder="ex: vegetarian, fără gluten" />
          </Field>
          <Field label="Telefon">
            <Input type="tel" value={g.telefon} onChange={(e) => set("telefon", e.target.value)} />
          </Field>
        </div>
        <Field label="Masă">
          <Select value={g.masaId} onChange={(e) => setG((x) => ({ ...x, masaId: e.target.value, loc: null }))}>
            <option value="">Neașezat</option>
            {tables.map((t) => <option key={t.id} value={t.id}>{t.nume}</option>)}
          </Select>
        </Field>
        <Field label="Note">
          <Textarea value={g.note} onChange={(e) => set("note", e.target.value)} />
        </Field>
      </form>
    </Modal>
  );
}

function BulkAdd({ groups, onClose, onAdd }: { groups: string[]; onClose: () => void; onAdd: (rows: Guest[]) => void }) {
  const [text, setText] = useState("");
  const [grup, setGrup] = useState("");
  const [parte, setParte] = useState<Parte>("Comun");
  const names = text.split("\n").map((l) => l.trim()).filter(Boolean);

  return (
    <Modal
      open
      onClose={onClose}
      title="Adaugă mai mulți invitați"
      footer={
        <>
          <Button onClick={onClose}>Renunță</Button>
          <Button variant="primary" disabled={!names.length} onClick={() => onAdd(names.map((nume) => ({ ...emptyGuest(), nume, grup: grup.trim(), parte })))}>
            Adaugă {names.length || ""}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Câte un nume pe linie" hint="Poți lipi direct o listă din WhatsApp, Excel sau Notes.">
          <Textarea className="min-h-40" value={text} onChange={(e) => setText(e.target.value)} placeholder={"Maria Ionescu\nFamilia Popescu\nAndrei Vasile"} autoFocus />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Grup (pentru toți)">
            <Input list="bulk-groups" value={grup} onChange={(e) => setGrup(e.target.value)} />
            <datalist id="bulk-groups">
              {groups.map((x) => <option key={x} value={x} />)}
            </datalist>
          </Field>
          <Field label="Partea">
            <Select value={parte} onChange={(e) => setParte(e.target.value as Parte)}>
              {PARTE.map((p) => <option key={p}>{p}</option>)}
            </Select>
          </Field>
        </div>
      </div>
    </Modal>
  );
}

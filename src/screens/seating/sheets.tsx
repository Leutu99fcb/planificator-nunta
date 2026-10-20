import { useState } from "react";
import { Hand, LayoutGrid, MoveRight, Search, UserMinus, UserPlus, Users } from "lucide-react";
import { persons, seatMap } from "../../lib/calc";
import { plural } from "../../lib/format";
import type { Guest, Table } from "../../lib/types";
import { Badge, Button, Input, Modal } from "../../components/ui";
import { ChoiceRow, tableFill } from "./parts";

// Ferestrele pentru așezarea „prin atingere” (fără drag): merg la fel pe telefon și pe desktop.

const describe = (g: Guest) =>
  [g.grup, persons(g) > 1 ? plural(persons(g), "persoană", "persoane") : "", g.restrictii].filter(Boolean).join(" · ");

/** Alege cine stă pe un loc (sau la o masă). Implicit arată neașezații; căutarea arată pe toată lumea. */
export function GuestPicker({
  title, guests, tables, onPick, onClose,
}: { title: string; guests: Guest[]; tables: Table[]; onPick: (g: Guest) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const tableIds = new Set(tables.map((t) => t.id));
  const attending = guests.filter((g) => g.rsvp !== "Nu");
  const query = q.trim().toLowerCase();
  const list = (query ? attending.filter((g) => `${g.nume} ${g.grup}`.toLowerCase().includes(query)) : attending.filter((g) => !tableIds.has(g.masaId)))
    .sort((a, b) => a.nume.localeCompare(b.nume, "ro"));
  const tableName = (id: string) => tables.find((t) => t.id === id)?.nume;

  return (
    <Modal open onClose={onClose} title={title}>
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <Input className="pl-9" placeholder="Caută (și printre cei deja așezați)…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {list.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">{query ? "Niciun invitat găsit." : "Toți invitații au deja un loc. Caută pe cineva ca să-l muți."}</p>
      ) : (
        <div className="space-y-1.5">
          {list.map((g) => (
            <ChoiceRow
              key={g.id}
              label={g.nume}
              sub={[describe(g), tableName(g.masaId) && `acum la ${tableName(g.masaId)}`].filter(Boolean).join(" · ")}
              right={g.rsvp === "Necunoscut" ? <Badge tone="warning">?</Badge> : null}
              onClick={() => onPick(g)}
            />
          ))}
        </div>
      )}
    </Modal>
  );
}

/** Ce poți face cu un invitat deja așezat. */
export function GuestSheet({
  guest, table, seat, onArm, onChooseTable, onUnseat, onClose,
}: { guest: Guest; table?: Table; seat?: number; onArm: () => void; onChooseTable: () => void; onUnseat: () => void; onClose: () => void }) {
  return (
    <Modal open onClose={onClose} title={guest.nume}>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-1.5 text-sm">
          <Badge tone={guest.rsvp === "Da" ? "success" : guest.rsvp === "Nu" ? "danger" : "warning"}>
            {guest.rsvp === "Da" ? "vine" : guest.rsvp === "Nu" ? "nu vine" : "fără răspuns"}
          </Badge>
          {persons(guest) > 1 && (
            <Badge>
              <Users className="h-3 w-3" /> {plural(persons(guest), "persoană", "persoane")}
            </Badge>
          )}
          {guest.grup && <Badge>{guest.grup}</Badge>}
          {guest.restrictii && <Badge tone="warning">{guest.restrictii}</Badge>}
        </div>
        {table && (
          <p className="text-sm text-muted">
            Stă la <b className="text-text">{table.nume}</b>
            {seat !== undefined && `, locul ${seat + 1}`}
            {persons(guest) > 1 && " (însoțitorii pe locurile de lângă)"}.
          </p>
        )}
        <div className="grid gap-2">
          <Button variant="primary" icon={<Hand className="h-4 w-4" />} onClick={onArm}>
            Mută pe alt loc (atingi locul pe plan)
          </Button>
          <Button icon={<MoveRight className="h-4 w-4" />} onClick={onChooseTable}>
            Alege masa din listă
          </Button>
          <Button variant="ghost" className="text-danger" icon={<UserMinus className="h-4 w-4" />} onClick={onUnseat}>
            Scoate de la masă
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/** Cine stă la o masă, cu adăugare și scoatere rapidă. */
export function TableSheet({
  table, guests, onGuest, onUnseat, onAdd, onArrange, onClose,
}: {
  table: Table;
  guests: Guest[];
  onGuest: (g: Guest) => void;
  onUnseat: (g: Guest) => void;
  onAdd: () => void;
  onArrange: () => void;
  onClose: () => void;
}) {
  const { seats, used, overflow } = seatMap(table, guests);
  const seated = [...new Map(seats.filter(Boolean).map((s) => [s!.guest.id, s!.guest])).values()];
  return (
    <Modal open onClose={onClose} title={table.nume}>
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm">
          <Badge tone={used > table.locuri ? "danger" : used === table.locuri ? "success" : "neutral"}>
            {used}/{table.locuri} locuri
          </Badge>
          {overflow > 0 && <span className="text-danger">{overflow} fără loc</span>}
        </div>
        {seated.length === 0 ? (
          <p className="py-3 text-sm text-muted">Nimeni nu stă încă aici.</p>
        ) : (
          <div className="divide-y divide-border rounded-lg border border-border">
            {seated.map((g) => (
              <div key={g.id} className="flex items-center gap-2 px-3 py-2">
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onGuest(g)}>
                  <span className="block truncate text-sm">{g.nume}</span>
                  {describe(g) && <span className="block truncate text-xs text-muted">{describe(g)}</span>}
                </button>
                <button type="button" className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-danger" onClick={() => onUnseat(g)} aria-label={`Scoate pe ${g.nume}`}>
                  <UserMinus className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" icon={<UserPlus className="h-4 w-4" />} onClick={onAdd} disabled={used >= table.locuri}>
            Adaugă invitat
          </Button>
          <Button icon={<LayoutGrid className="h-4 w-4" />} onClick={onArrange}>
            Mută / rotește masa
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/** Alege masa (primul loc liber), sau „Neașezat”. */
export function TableChooser({
  guest, tables, guests, onPick, onUnseat, onClose,
}: { guest: Guest; tables: Table[]; guests: Guest[]; onPick: (t: Table) => void; onUnseat: () => void; onClose: () => void }) {
  const known = new Set(tables.map((t) => t.id));
  return (
    <Modal open onClose={onClose} title={`Unde stă ${guest.nume}?`}>
      <div className="space-y-1.5">
        <ChoiceRow active={!known.has(guest.masaId)} label="Neașezat" onClick={onUnseat} />
        {tables.map((t) => {
          const { used, over } = tableFill(t, guests, guest);
          return (
            <ChoiceRow
              key={t.id}
              active={guest.masaId === t.id}
              label={t.nume}
              right={<span className={over ? "text-xs tabular-nums text-danger" : "text-xs tabular-nums text-muted"}>{used}/{t.locuri}</span>}
              onClick={() => onPick(t)}
            />
          );
        })}
      </div>
    </Modal>
  );
}

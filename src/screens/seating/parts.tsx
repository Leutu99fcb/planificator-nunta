import { useState, type CSSProperties, type ReactNode } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { Music, RotateCw, Search, Sparkles, Trash2, Users } from "lucide-react";
import { hasSeats, persons, seatMap, type SeatOccupant } from "../../lib/calc";
import { plural } from "../../lib/format";
import { MIN_SIZE, initials, rotation, seatLabel, seatPositions, type LabelMode } from "../../lib/layout";
import { FORMA, TIP_ELEMENT, type Forma, type Guest, type Table, type TipElement } from "../../lib/types";
import { Badge, Button, Card, Field, Input, Modal, Select, Textarea, cx } from "../../components/ui";

export const UNSEATED = "unseated";
export interface DragData {
  guestId: string;
}
export type Mode = "seat" | "arrange";
export type Interaction = "move" | "resize" | "rotate";

// ---------- invitați trași ----------

export function DraggableGuest({
  id, guestId, onClick, children, className, style, title,
}: { id: string; guestId: string; onClick: () => void; children: ReactNode; className?: string; style?: CSSProperties; title?: string }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id, data: { guestId } satisfies DragData });
  return (
    <button
      ref={setNodeRef}
      type="button"
      title={title}
      onClick={onClick}
      onPointerDown={(e) => e.stopPropagation()}
      {...listeners}
      {...attributes}
      style={style}
      className={cx("touch-manipulation text-left", isDragging && "opacity-30", className)}
    >
      {children}
    </button>
  );
}

export function GuestPill({ guest, lifted, armed }: { guest: Guest; lifted?: boolean; armed?: boolean }) {
  const n = persons(guest);
  return (
    <span
      className={cx(
        "flex max-w-64 cursor-grab items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm",
        guest.rsvp === "Da" ? "border-success/30 bg-success-soft" : "border-warning/30 bg-warning-soft",
        lifted && "cursor-grabbing shadow-xl",
        armed && "ring-2 ring-primary ring-offset-1",
      )}
    >
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface text-[10px] font-semibold">{initials(guest.nume)}</span>
      <span className="min-w-0 truncate">{guest.nume}</span>
      {n > 1 && (
        <span className="ml-auto flex shrink-0 items-center gap-0.5 text-xs text-muted">
          <Users className="h-3 w-3" />
          {n}
        </span>
      )}
      {guest.rsvp === "Necunoscut" && <span className="shrink-0 text-xs text-warning-ink">?</span>}
    </span>
  );
}

export function UnseatedPanel({
  className, full, guests, total, query, armedId, onQuery, onGuestClick, onClear,
}: {
  className?: string;
  full: boolean;
  guests: Guest[];
  total: number;
  query: string;
  armedId: string | null;
  onQuery: (q: string) => void;
  onGuestClick: (g: Guest) => void;
  onClear: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: UNSEATED });
  return (
    <div ref={setNodeRef} className={cx(className, "min-h-0")}>
      <Card className={cx("flex flex-col p-2.5 transition-colors lg:h-full lg:p-3", isOver && "border-primary bg-primary-soft", !full && "lg:max-h-[calc(100vh-250px)]")}>
        <div className="mb-2 flex items-center gap-2">
          <h2 className="font-serif text-base font-semibold">Neașezați</h2>
          <Badge tone={total ? "warning" : "success"}>{plural(total, "persoană", "persoane")}</Badge>
          <span className="flex-1" />
          <button type="button" className="text-xs text-muted underline-offset-2 hover:text-danger-ink hover:underline" onClick={onClear}>
            Golește locurile
          </button>
        </div>
        <div className="relative mb-2">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          <Input className="h-9 pl-8 text-sm" placeholder="Caută invitat…" value={query} onChange={(e) => onQuery(e.target.value)} />
        </div>
        {guests.length === 0 ? (
          <p className="py-2 text-center text-sm text-muted lg:py-4">{query ? "Niciun rezultat." : "Toți invitații au un loc 🎉"}</p>
        ) : (
          // pe telefon: un singur rând care se derulează lateral, ca planul să rămână la vedere
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 lg:flex-col lg:overflow-x-visible lg:overflow-y-auto lg:pb-0">
            {guests.map((g) => (
              <DraggableGuest key={g.id} id={`list:${g.id}`} guestId={g.id} onClick={() => onGuestClick(g)} className="shrink-0 lg:shrink">
                <GuestPill guest={g} armed={armedId === g.id} />
              </DraggableGuest>
            ))}
          </div>
        )}
        <p className="mt-1.5 text-xs text-muted lg:mt-2">
          <span className="lg:hidden">Atinge un invitat, apoi locul lui pe plan.</span>
          <span className="hidden lg:inline">Trage invitatul pe un loc sau apasă pe el și apoi pe loc. Cei care au refuzat nu apar aici.</span>
        </p>
      </Card>
    </div>
  );
}

// ---------- elementele planului ----------

export const ELEMENT_STYLE: Record<TipElement, string> = {
  Masă: "bg-surface border-border",
  "Masa mirilor": "bg-primary-soft border-primary/60",
  Scenă: "border-muted/40 bg-[repeating-linear-gradient(45deg,var(--surface-2),var(--surface-2)_8px,var(--surface)_8px,var(--surface)_16px)]",
  "Scena formației": "bg-info-soft border-info/50",
  "Ring de dans": "bg-warning-soft border-warning/40 border-dashed",
};

export function Element({
  el, guests, seatSize, labelMode, mode, selected, handles, armed, onInteraction, onBodyClick, onDoubleClick, onSeatClick,
}: {
  el: Table;
  guests: Guest[];
  seatSize: number;
  labelMode: LabelMode;
  mode: Mode;
  selected: boolean;
  /** butoanele de rotire și mărime apar doar când e selectat un singur element */
  handles: boolean;
  armed: boolean;
  onInteraction: (e: React.PointerEvent, kind: Interaction) => void;
  onBodyClick: () => void;
  onDoubleClick: () => void;
  onSeatClick: (index: number, occupant: SeatOccupant | null) => void;
}) {
  const seated = hasSeats(el);
  const { setNodeRef, isOver } = useDroppable({ id: `table:${el.id}`, disabled: !seated });
  const map = seated ? seatMap(el, guests) : null;
  const over = map ? map.used > el.locuri : false;
  const positions = seated ? seatPositions(el, seatSize) : [];
  const rot = rotation(el);
  const small = Math.min(el.latime, el.inaltime) < 70;
  const arrange = mode === "arrange";
  const seatPad = seated && el.locuri > 0 ? seatSize + 10 : 0;

  return (
    <div
      className="absolute"
      style={{ left: el.x, top: el.y, width: el.latime, height: el.inaltime, transform: rot ? `rotate(${rot}deg)` : undefined, zIndex: selected ? 2 : undefined }}
    >
      <div
        ref={setNodeRef}
        onPointerDown={arrange ? (e) => onInteraction(e, "move") : undefined}
        onClick={arrange ? undefined : onBodyClick}
        onDoubleClick={onDoubleClick}
        className={cx(
          "absolute inset-0 flex select-none items-center justify-center border-2 text-center shadow-sm transition-[box-shadow,border-color]",
          arrange ? "cursor-move touch-none" : seated ? "cursor-pointer" : "",
          el.forma === "Rotundă" ? "rounded-full" : "rounded-xl",
          ELEMENT_STYLE[el.tip],
          over && "border-danger",
          (isOver || (armed && seated)) && "border-primary",
          isOver && "ring-4 ring-primary/20",
          selected && "ring-2 ring-primary ring-offset-2 ring-offset-transparent",
        )}
      >
        {/* textul rămâne drept, chiar dacă masa e rotită */}
        <div className="flex max-w-full flex-col items-center" style={{ transform: rot ? `rotate(${-rot}deg)` : undefined }}>
          {el.tip === "Scena formației" && <Music className="mb-0.5 h-5 w-5 text-info-ink" />}
          {el.tip === "Ring de dans" && <Sparkles className="mb-0.5 h-5 w-5 text-warning-ink" />}
          <span className={cx("max-w-full px-2 font-medium leading-tight", small ? "text-[11px]" : "text-sm")}>{el.nume}</span>
          {map && (
            <span className={cx("text-[11px] tabular-nums", over ? "font-semibold text-danger-ink" : "text-muted")}>
              {map.used}/{el.locuri}
            </span>
          )}
        </div>
      </div>

      {map &&
        positions.map((p, k) => (
          <Seat
            key={k}
            tableId={el.id}
            index={k}
            x={p.x}
            y={p.y}
            size={seatSize}
            rot={rot}
            labelMode={labelMode}
            occupant={map.seats[k] ?? null}
            highlight={armed}
            onClick={(occ) => onSeatClick(k, occ)}
          />
        ))}

      {map && map.overflow > 0 && (
        <span
          className="absolute -right-2 -top-2 rounded-full bg-danger px-1.5 py-0.5 text-[10px] font-semibold text-white"
          style={{ transform: rot ? `rotate(${-rot}deg)` : undefined }}
          title="Persoane fără loc la această masă"
        >
          +{map.overflow}
        </span>
      )}

      {selected && arrange && handles && (
        <>
          <div className="pointer-events-none absolute left-1/2 w-px -translate-x-1/2 bg-primary/60" style={{ top: -seatPad - 22, height: 22 }} />
          <div
            onPointerDown={(e) => onInteraction(e, "rotate")}
            className="absolute left-1/2 flex h-7 w-7 -translate-x-1/2 cursor-grab touch-none items-center justify-center rounded-full border-2 border-primary bg-surface text-primary-ink shadow"
            style={{ top: -seatPad - 50 }}
            title="Trage ca să rotești"
          >
            <RotateCw className="h-3.5 w-3.5" />
          </div>
          <div
            onPointerDown={(e) => onInteraction(e, "resize")}
            className="absolute -bottom-3 -right-3 h-6 w-6 cursor-nwse-resize touch-none rounded-md border-2 border-primary bg-surface shadow"
            title="Trage ca să mărești sau micșorezi"
          />
        </>
      )}
    </div>
  );
}

function Seat({
  tableId, index, x, y, size, rot, labelMode, occupant, highlight, onClick,
}: {
  tableId: string;
  index: number;
  x: number;
  y: number;
  size: number;
  rot: number;
  labelMode: LabelMode;
  occupant: SeatOccupant | null;
  highlight: boolean;
  onClick: (occ: SeatOccupant | null) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `seat:${tableId}:${index}` });
  const base: CSSProperties = { left: x - size / 2, top: y - size / 2, width: size, height: size };
  const upright: CSSProperties | undefined = rot ? { transform: `rotate(${-rot}deg)` } : undefined;

  if (!occupant) {
    return (
      <button
        ref={setNodeRef}
        type="button"
        onClick={() => onClick(null)}
        onPointerDown={(e) => e.stopPropagation()}
        style={base}
        aria-label={`Loc liber ${index + 1}`}
        className={cx(
          "absolute flex items-center justify-center rounded-full border-2 border-dashed text-[10px] text-muted/70",
          isOver ? "border-primary bg-primary-soft" : highlight ? "border-primary/70 bg-primary-soft/60" : "border-border bg-surface/70 hover:border-primary/50",
        )}
      >
        {labelMode !== "initiale" && <span style={upright}>{index + 1}</span>}
      </button>
    );
  }

  const g = occupant.guest;
  const label = seatLabel(g, occupant.kind, labelMode);
  const who = occupant.kind === "principal" ? g.nume : `${occupant.kind === "copil" ? "Copil" : "Însoțitor"} · ${g.nume}`;
  return (
    <div ref={setNodeRef} style={base} className="absolute">
      <DraggableGuest
        id={`seat:${tableId}:${index}:${g.id}`}
        guestId={g.id}
        onClick={() => onClick(occupant)}
        className="block h-full w-full"
        title={`${who}${g.restrictii ? ` · ${g.restrictii}` : ""}`}
      >
        <span
          className={cx(
            "flex h-full w-full cursor-grab items-center justify-center overflow-hidden rounded-full border-2 px-1 text-center font-semibold shadow-sm",
            g.rsvp === "Da" ? "border-success/60 bg-success-soft text-success-ink" : "border-warning/60 bg-warning-soft text-warning-ink",
            occupant.kind !== "principal" && "opacity-75",
            isOver && "ring-2 ring-primary",
          )}
        >
          <span className="line-clamp-3 leading-[1.1]" style={{ ...upright, fontSize: fitFont(label, size, labelMode) }}>
            {label}
          </span>
        </span>
      </DraggableGuest>
    </div>
  );
}

/**
 * Mărimea fontului ca cel mai lung cuvânt să încapă întreg în bulină (fără „Gheorg-he”),
 * iar la „Nume întreg” să încapă până la 3 rânduri.
 */
function fitFont(label: string, seat: number, mode: LabelMode): number {
  const words = label.split(/\s+/).filter(Boolean);
  const longest = Math.max(1, ...words.map((w) => w.length));
  const inner = seat - 10; // fără bordură și padding
  const lines = mode === "complet" ? Math.min(3, words.length) : 1;
  const max = mode === "complet" ? 10 : 11;
  const byWidth = (inner * (lines > 1 ? 0.86 : 1)) / (longest * 0.62);
  const byHeight = inner / (lines * 1.15);
  return Math.max(6, Math.min(max, byWidth, byHeight));
}

export function PresetIcon({ tip, forma, square }: { tip: TipElement; forma: Forma; square: boolean }) {
  if (tip === "Scena formației") return <Music className="h-5 w-5 text-info-ink" />;
  if (tip === "Ring de dans") return <Sparkles className="h-5 w-5 text-warning-ink" />;
  return (
    <span
      className={cx(
        "inline-block shrink-0 border-2",
        forma === "Rotundă" ? "h-5 w-5 rounded-full" : square ? "h-4 w-4 rounded-sm" : "h-3.5 w-6 rounded-sm",
        ELEMENT_STYLE[tip],
      )}
    />
  );
}

// ---------- editare element ----------

export function ElementForm({ initial, onClose, onSave, onDelete }: { initial: Table; onClose: () => void; onSave: (t: Table) => void; onDelete: () => void }) {
  const [t, setT] = useState(initial);
  const set = <K extends keyof Table>(k: K, v: Table[K]) => setT((x) => ({ ...x, [k]: v }));
  const seated = hasSeats(t);
  return (
    <Modal
      open
      onClose={onClose}
      title="Editează elementul"
      footer={
        <>
          <Button variant="ghost" className="mr-auto text-danger-ink" icon={<Trash2 className="h-4 w-4" />} onClick={onDelete}>
            Șterge
          </Button>
          <Button onClick={onClose}>Renunță</Button>
          <Button variant="primary" type="submit" form="element-form">Salvează</Button>
        </>
      }
    >
      <form
        id="element-form"
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          onSave({ ...t, locuri: hasSeats(t) ? Math.max(1, t.locuri) : 0 });
        }}
      >
        <Field label="Nume">
          <Input required value={t.nume} onChange={(e) => set("nume", e.target.value)} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Tip">
            <Select value={t.tip} onChange={(e) => set("tip", e.target.value as TipElement)}>
              {TIP_ELEMENT.map((x) => <option key={x}>{x}</option>)}
            </Select>
          </Field>
          <Field label="Formă">
            <Select value={t.forma} onChange={(e) => set("forma", e.target.value as Forma)}>
              {FORMA.map((x) => <option key={x}>{x}</option>)}
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {seated && (
            <Field label="Locuri">
              <Input type="number" min={1} max={40} value={t.locuri || ""} onChange={(e) => set("locuri", Math.max(0, Math.min(40, Number(e.target.value) || 0)))} />
            </Field>
          )}
          <Field label="Lățime">
            <Input type="number" min={MIN_SIZE} max={1200} value={t.latime} onChange={(e) => set("latime", Math.max(MIN_SIZE, Number(e.target.value) || MIN_SIZE))} />
          </Field>
          <Field label="Înălțime">
            <Input type="number" min={MIN_SIZE} max={1200} value={t.inaltime} onChange={(e) => set("inaltime", Math.max(MIN_SIZE, Number(e.target.value) || MIN_SIZE))} />
          </Field>
          <Field label="Rotire (°)">
            <Input type="number" min={0} max={359} step={15} value={rotation(t)} onChange={(e) => set("rotatie", Number(e.target.value) || 0)} />
          </Field>
        </div>
        {t.forma === "Dreptunghiulară" && t.latime !== t.inaltime && (
          <button type="button" className="text-xs text-primary-ink underline" onClick={() => set("inaltime", t.latime)}>
            Fă-o pătrată
          </button>
        )}
        <Field label="Note">
          <Textarea value={t.note} onChange={(e) => set("note", e.target.value)} placeholder="ex: lângă ringul de dans, fără scaun pentru bebeluș" />
        </Field>
      </form>
    </Modal>
  );
}

export function ChoiceRow({ active, label, sub, right, onClick }: { active?: boolean; label: ReactNode; sub?: ReactNode; right?: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx("flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left text-sm", active ? "border-primary bg-primary-soft" : "border-border hover:bg-surface-2")}
    >
      <span className="min-w-0">
        <span className="block truncate">{label}</span>
        {sub && <span className="block truncate text-xs text-muted">{sub}</span>}
      </span>
      {right}
    </button>
  );
}

/** Folosit de „Mută la altă masă”: locurile ocupate / totale, roșu dacă grupul nu mai încape. */
export function tableFill(t: Table, guests: Guest[], add: Guest | null) {
  const { used } = seatMap(t, guests);
  const extra = add && add.masaId !== t.id ? persons(add) : 0;
  return { used, over: used + extra > t.locuri };
}

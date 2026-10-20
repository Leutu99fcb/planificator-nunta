import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  DndContext, DragOverlay, MouseSensor, TouchSensor, pointerWithin, rectIntersection, useDraggable, useDroppable,
  useSensor, useSensors, type CollisionDetection, type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import {
  Copy, Magnet, Maximize2, Minimize2, Minus, Music, Pencil, Plus, Scan, Search, Sparkles, Trash2, Users,
} from "lucide-react";
import { firstFreeSeat, hasSeats, persons, seatMap, seatTables, seatingStats, type SeatOccupant } from "../lib/calc";
import { plural } from "../lib/format";
import { newId } from "../lib/ids";
import { MIN_SIZE, PRESETS, SEAT, boardSize, contentBounds, initials, makeElement, seatPositions, snap } from "../lib/layout";
import { FORMA, TIP_ELEMENT, type Forma, type Guest, type Table, type TipElement } from "../lib/types";
import { usePlanner } from "../state/planner";
import { useFeedback } from "../components/feedback";
import { Badge, Button, Card, Field, Input, Modal, Select, Textarea, cx } from "../components/ui";

// Planul sălii: în stânga planul (mese, masa mirilor, scene, ring de dans), în dreapta
// invitații neașezați. Elementele se mută și se redimensionează cu mouse-ul/degetul;
// invitații se trag pe un loc anume sau pe masă (primul loc liber).

const ZOOMS = [0.4, 0.5, 0.6, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2];
const UNSEATED = "unseated";

type Live = Pick<Table, "id" | "x" | "y" | "latime" | "inaltime">;
interface DragData {
  guestId: string;
}

// Întâi locul aflat exact sub deget/cursor; dacă nu e niciunul, cea mai apropiată suprafață
const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length ? hits : rectIntersection(args);
};

function readZoom(): number {
  try {
    const z = Number(localStorage.getItem("pn_zoom"));
    return ZOOMS.includes(z) ? z : 1;
  } catch {
    return 1;
  }
}

export function Seating() {
  const { data, add, update, remove } = usePlanner();
  const { confirm } = useFeedback();
  const [zoom, setZoomState] = useState(readZoom);
  const [snapOn, setSnapOn] = useState(true);
  const [full, setFull] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [live, setLive] = useState<Live | null>(null);
  const [dragGuest, setDragGuest] = useState<Guest | null>(null);
  const [moving, setMoving] = useState<Guest | null>(null);
  const [editing, setEditing] = useState<{ el: Table; isNew: boolean } | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [query, setQuery] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const pendingCenter = useRef<{ x: number; y: number } | null>(null);
  const liveRef = useRef<Live | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
  );

  const elements = useMemo(
    () => data.tables.map((t) => (live && live.id === t.id ? { ...t, ...live } : t)),
    [data.tables, live],
  );
  const board = boardSize(elements);
  const stats = seatingStats(data);
  const tables = seatTables(data.tables);
  const tableIds = new Set(tables.map((t) => t.id));
  const unseated = data.guests
    .filter((g) => g.rsvp !== "Nu" && !tableIds.has(g.masaId))
    .filter((g) => !query.trim() || `${g.nume} ${g.grup}`.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => a.grup.localeCompare(b.grup, "ro") || a.nume.localeCompare(b.nume, "ro"));
  const selectedEl = elements.find((e) => e.id === selected) ?? null;

  // ---------- zoom ----------

  const viewCenter = () => {
    const s = scrollRef.current;
    if (!s) return { x: 400, y: 300 };
    return { x: (s.scrollLeft + s.clientWidth / 2) / zoom, y: (s.scrollTop + s.clientHeight / 2) / zoom };
  };

  const setZoom = (z: number) => {
    pendingCenter.current = viewCenter();
    setZoomState(z);
    try {
      localStorage.setItem("pn_zoom", String(z));
    } catch {
      /* fără localStorage */
    }
  };

  useLayoutEffect(() => {
    const s = scrollRef.current;
    const c = pendingCenter.current;
    if (!s || !c) return;
    s.scrollLeft = c.x * zoom - s.clientWidth / 2;
    s.scrollTop = c.y * zoom - s.clientHeight / 2;
    pendingCenter.current = null;
  }, [zoom]);

  const stepZoom = (dir: 1 | -1) => {
    const i = ZOOMS.findIndex((z) => z >= zoom - 0.001);
    setZoom(ZOOMS[Math.min(ZOOMS.length - 1, Math.max(0, (i < 0 ? 5 : i) + dir))]);
  };

  const fit = () => {
    const s = scrollRef.current;
    const b = contentBounds(elements);
    if (!s || !b) return;
    const pad = 40;
    const z = Math.min(2, Math.max(0.4, Math.min((s.clientWidth - pad) / (b.maxX - b.minX), (s.clientHeight - pad) / (b.maxY - b.minY))));
    const nearest = [...ZOOMS].reverse().find((x) => x <= z) ?? 0.4;
    pendingCenter.current = { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 };
    setZoomState(nearest);
    if (nearest === zoom) {
      s.scrollLeft = pendingCenter.current.x * zoom - s.clientWidth / 2;
      s.scrollTop = pendingCenter.current.y * zoom - s.clientHeight / 2;
      pendingCenter.current = null;
    }
  };

  // la prima deschidere încadrăm tot planul
  const fitted = useRef(false);
  useEffect(() => {
    if (fitted.current || !data.tables.length) return;
    fitted.current = true;
    if (!localStorage.getItem("pn_zoom")) fit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.tables.length]);

  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setFull(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [full]);

  // ---------- mutare / redimensionare elemente ----------

  const startInteraction = (e: React.PointerEvent, el: Table, mode: "move" | "resize") => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    const start = { px: e.clientX, py: e.clientY, x: el.x, y: el.y, w: el.latime, h: el.inaltime };
    let moved = false;
    const keepCircle = el.forma === "Rotundă" && hasSeats(el);

    const onMove = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - start.px, ev.clientY - start.py) < 4) return;
      moved = true;
      const dx = (ev.clientX - start.px) / zoom;
      const dy = (ev.clientY - start.py) / zoom;
      let next: Live;
      if (mode === "move") {
        next = { id: el.id, x: Math.max(0, snap(start.x + dx, snapOn)), y: Math.max(0, snap(start.y + dy, snapOn)), latime: start.w, inaltime: start.h };
      } else {
        let w = Math.max(MIN_SIZE, snap(start.w + dx, snapOn));
        let h = Math.max(MIN_SIZE, snap(start.h + dy, snapOn));
        if (keepCircle) w = h = Math.max(w, h);
        next = { id: el.id, x: start.x, y: start.y, latime: w, inaltime: h };
      }
      liveRef.current = next;
      setLive(next);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      const l = liveRef.current;
      liveRef.current = null;
      if (moved && l) {
        update("tables", [{ ...el, ...l }]).finally(() => setLive((cur) => (cur?.id === el.id ? null : cur)));
      } else {
        setLive(null);
        setSelected(el.id);
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  // ---------- așezare invitați ----------

  const placeAt = (g: Guest, t: Table, k: number) => {
    const others = data.guests.filter((x) => x.id !== g.id);
    const occupant = seatMap(t, others).seats[k];
    const moved: Guest = { ...g, masaId: t.id, loc: k };
    const updates: Guest[] = [moved];
    if (occupant && occupant.guest.id !== g.id) {
      // cine stătea acolo face loc: ia locul vechi al invitatului mutat (schimb) sau primul loc liber
      const other = occupant.guest;
      const swapLoc = g.masaId === t.id && g.loc !== null && g.loc !== k ? g.loc : null;
      const rest = [...others.filter((x) => x.id !== other.id), moved];
      updates.push({ ...other, loc: swapLoc ?? firstFreeSeat(t, rest, persons(other)) });
    }
    update("guests", updates);
  };

  const seatAnywhere = (g: Guest, t: Table) => {
    if (g.masaId === t.id) return;
    update("guests", [{ ...g, masaId: t.id, loc: firstFreeSeat(t, data.guests, persons(g), g.id) }]);
  };

  const unseat = (g: Guest) => {
    if (!g.masaId && g.loc === null) return;
    update("guests", [{ ...g, masaId: "", loc: null }]);
  };

  const onDragStart = (e: DragStartEvent) => {
    const id = (e.active.data.current as DragData | undefined)?.guestId;
    setDragGuest(data.guests.find((g) => g.id === id) ?? null);
  };

  const onDragEnd = (e: DragEndEvent) => {
    setDragGuest(null);
    const id = (e.active.data.current as DragData | undefined)?.guestId;
    const g = data.guests.find((x) => x.id === id);
    const over = e.over ? String(e.over.id) : null;
    if (!g || !over) return;
    if (over === UNSEATED) return unseat(g);
    const [kind, tableId, seat] = over.split(":");
    const t = data.tables.find((x) => x.id === tableId);
    if (!t) return;
    if (kind === "seat") placeAt(g, t, Number(seat));
    else if (kind === "table") seatAnywhere(g, t);
  };

  // ---------- elemente ----------

  const addElement = async (presetIndex: number) => {
    setAddOpen(false);
    const p = PRESETS[presetIndex];
    const c = viewCenter();
    const el = makeElement(p, snap(c.x, snapOn), snap(c.y, snapOn), tables.length);
    if (await add("tables", [el], `${p.label} adăugată`)) setSelected(el.id);
  };

  const duplicate = async (el: Table) => {
    const copy: Table = {
      ...el,
      id: newId(),
      nume: hasSeats(el) && el.tip === "Masă" ? `Masa ${tables.length + 1}` : `${el.nume} (copie)`,
      x: el.x + 40,
      y: el.y + 40,
    };
    if (await add("tables", [copy], "Element duplicat")) setSelected(copy.id);
  };

  const deleteElement = async (el: Table) => {
    const seated = data.guests.filter((g) => g.masaId === el.id);
    const ok = await confirm({
      title: `Ștergi „${el.nume}”?`,
      text: seated.length ? `${plural(seated.length, "invitat ajunge", "invitați ajung")} la „Neașezați”.` : "Elementul dispare din plan.",
      confirmLabel: "Șterge",
      danger: true,
    });
    if (!ok) return;
    if (seated.length && !(await update("guests", seated.map((g) => ({ ...g, masaId: "", loc: null }))))) return;
    if (await remove("tables", [el.id], "Șters")) {
      setSelected(null);
      setEditing(null);
    }
  };

  const changeSeats = (el: Table, delta: number) => {
    const locuri = Math.max(1, Math.min(40, el.locuri + delta));
    if (locuri !== el.locuri) update("tables", [{ ...el, locuri }]);
  };

  const clearSeats = async () => {
    const seated = data.guests.filter((g) => g.masaId);
    if (!seated.length) return;
    const ok = await confirm({
      title: "Golești toate locurile?",
      text: `${plural(seated.length, "invitat ajunge", "invitați ajung")} înapoi la „Neașezați”. Mesele rămân pe loc.`,
      confirmLabel: "Golește",
      danger: true,
    });
    if (ok) update("guests", seated.map((g) => ({ ...g, masaId: "", loc: null })), "Locurile au fost golite");
  };

  // ---------- randare ----------

  return (
    <div className={cx(full ? "fixed inset-0 z-40 flex flex-col gap-3 overflow-hidden bg-bg p-3" : "space-y-3")}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-semibold">Plan de mese</h1>
          <p className="text-sm text-muted">
            {stats.seatedPersons} din {stats.seatedPersons + stats.unseatedPersons} persoane așezate · {stats.seats} locuri la {plural(stats.tables, "masă", "mese")}
            {stats.overfull.length > 0 && <span className="text-danger"> · {plural(stats.overfull.length, "masă prea plină", "mese prea pline")}</span>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={clearSeats}>Golește locurile</Button>
          <div className="relative">
            <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setAddOpen((o) => !o)} aria-expanded={addOpen}>
              Adaugă
            </Button>
            {addOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setAddOpen(false)} />
                <div className="absolute right-0 z-50 mt-1 w-60 overflow-hidden rounded-xl border border-border bg-surface py-1 shadow-xl">
                  {PRESETS.map((p, i) => (
                    <button key={p.label} type="button" onClick={() => addElement(i)} className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-surface-2">
                      <PresetIcon tip={p.tip} forma={p.forma} square={p.latime === p.inaltime} />
                      {p.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {selectedEl && (
        <Card className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
          <span className="font-medium">{selectedEl.nume}</span>
          <Badge>{selectedEl.tip}</Badge>
          {hasSeats(selectedEl) && (
            <span className="ml-1 inline-flex items-center gap-1">
              <button type="button" className="rounded-md border border-border p-1 hover:bg-surface-2" onClick={() => changeSeats(selectedEl, -1)} aria-label="Un loc mai puțin">
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="w-16 text-center tabular-nums">{plural(selectedEl.locuri, "loc", "locuri")}</span>
              <button type="button" className="rounded-md border border-border p-1 hover:bg-surface-2" onClick={() => changeSeats(selectedEl, 1)} aria-label="Un loc în plus">
                <Plus className="h-3.5 w-3.5" />
              </button>
            </span>
          )}
          <span className="flex-1" />
          <Button size="sm" variant="ghost" icon={<Pencil className="h-4 w-4" />} onClick={() => setEditing({ el: selectedEl, isNew: false })}>
            Editează
          </Button>
          <Button size="sm" variant="ghost" icon={<Copy className="h-4 w-4" />} onClick={() => duplicate(selectedEl)}>
            Duplică
          </Button>
          <Button size="sm" variant="ghost" className="text-danger" icon={<Trash2 className="h-4 w-4" />} onClick={() => deleteElement(selectedEl)}>
            Șterge
          </Button>
        </Card>
      )}

      <DndContext sensors={sensors} collisionDetection={collision} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragGuest(null)}>
        <div className={cx("grid gap-3 lg:grid-cols-[1fr_290px]", full && "min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] lg:grid-rows-1")}>
          {/* neașezați: pe telefon deasupra planului, pe desktop în dreapta */}
          <UnseatedPanel
            className="lg:order-2"
            full={full}
            guests={unseated}
            total={stats.unseatedPersons}
            query={query}
            onQuery={setQuery}
            onGuestClick={setMoving}
          />

          <div className={cx("relative overflow-hidden rounded-2xl border border-border bg-surface-2/60 lg:order-1", full ? "min-h-0" : "h-[62vh] min-h-[420px] lg:h-[calc(100vh-240px)]")}>
            <div ref={scrollRef} className="h-full w-full overflow-auto" onPointerDown={(e) => e.target === e.currentTarget && setSelected(null)}>
              <div style={{ width: board.w * zoom, height: board.h * zoom }} onPointerDown={(e) => e.target === e.currentTarget && setSelected(null)}>
                <div
                  className="relative origin-top-left"
                  style={{
                    width: board.w,
                    height: board.h,
                    transform: `scale(${zoom})`,
                    backgroundImage: "radial-gradient(var(--border) 1.2px, transparent 1.2px)",
                    backgroundSize: "20px 20px",
                  }}
                  onPointerDown={(e) => e.target === e.currentTarget && setSelected(null)}
                >
                  {elements.map((el) => (
                    <Element
                      key={el.id}
                      el={el}
                      guests={data.guests}
                      selected={el.id === selected}
                      onPointerDown={(e, mode) => startInteraction(e, el, mode)}
                      onDoubleClick={() => setEditing({ el, isNew: false })}
                      onGuestClick={setMoving}
                    />
                  ))}
                  {elements.length === 0 && (
                    <div className="absolute left-10 top-10 max-w-sm rounded-xl border border-dashed border-border bg-surface p-5 text-sm text-muted">
                      Planul e gol. Apasă <b>Adaugă</b> și pune mesele, masa mirilor, scena formației și ringul de dans, apoi trage invitații pe locuri.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="absolute bottom-3 right-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSnapOn((s) => !s)}
                className={cx("rounded-lg p-2 shadow-sm", snapOn ? "bg-primary text-primary-fg" : "border border-border bg-surface text-muted")}
                title={snapOn ? "Aliniere la grilă: pornită" : "Aliniere la grilă: oprită"}
                aria-pressed={snapOn}
              >
                <Magnet className="h-4 w-4" />
              </button>
              <div className="flex items-center rounded-lg border border-border bg-surface shadow-sm">
                <button type="button" className="p-2 text-muted hover:text-text" onClick={() => stepZoom(-1)} aria-label="Micșorează">
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-12 text-center text-xs tabular-nums">{Math.round(zoom * 100)}%</span>
                <button type="button" className="p-2 text-muted hover:text-text" onClick={() => stepZoom(1)} aria-label="Mărește">
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <button type="button" className="rounded-lg border border-border bg-surface p-2 text-muted shadow-sm hover:text-text" onClick={fit} title="Încadrează tot planul">
                <Scan className="h-4 w-4" />
              </button>
              <button type="button" className="rounded-lg border border-border bg-surface p-2 text-muted shadow-sm hover:text-text" onClick={() => setFull((f) => !f)} title={full ? "Ieși din ecran complet" : "Ecran complet"}>
                {full ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>

        <DragOverlay dropAnimation={null}>{dragGuest && <GuestPill guest={dragGuest} lifted />}</DragOverlay>
      </DndContext>

      {!full && (
        <p className="text-xs text-muted">
          Trage mesele ca să le muți; colțul din dreapta-jos al elementului selectat îl mărește sau micșorează. Trage invitații pe un loc anume sau pe masă (primul loc liber). Pe telefon ține
          apăsat puțin pe invitat, apoi trage. Dublu-clic pe un element ca să-l editezi.
        </p>
      )}

      {moving && (
        <Modal open onClose={() => setMoving(null)} title={`Unde stă ${moving.nume}?`}>
          <div className="space-y-1.5">
            <ChoiceRow
              active={!tableIds.has(moving.masaId)}
              label="Neașezat"
              onClick={() => {
                unseat(moving);
                setMoving(null);
              }}
            />
            {tables.map((t) => {
              const { used } = seatMap(t, data.guests);
              const active = moving.masaId === t.id;
              return (
                <ChoiceRow
                  key={t.id}
                  active={active}
                  label={t.nume}
                  right={<span className={cx("text-xs tabular-nums", !active && used + persons(moving) > t.locuri ? "text-danger" : "text-muted")}>{used}/{t.locuri}</span>}
                  onClick={() => {
                    seatAnywhere(moving, t);
                    setMoving(null);
                  }}
                />
              );
            })}
          </div>
        </Modal>
      )}

      {editing && (
        <ElementForm
          initial={editing.el}
          onClose={() => setEditing(null)}
          onSave={async (el) => (await update("tables", [el], "Salvat")) && setEditing(null)}
          onDelete={() => deleteElement(editing.el)}
        />
      )}
    </div>
  );
}

function ChoiceRow({ active, label, right, onClick }: { active: boolean; label: string; right?: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx("flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm", active ? "border-primary bg-primary-soft" : "border-border hover:bg-surface-2")}
    >
      <span>{label}</span>
      {right}
    </button>
  );
}

// ---------- panoul cu neașezați ----------

function UnseatedPanel({
  className, full, guests, total, query, onQuery, onGuestClick,
}: { className?: string; full: boolean; guests: Guest[]; total: number; query: string; onQuery: (q: string) => void; onGuestClick: (g: Guest) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: UNSEATED });
  return (
    <div ref={setNodeRef} className={cx(className, "min-h-0")}>
      <Card className={cx("flex flex-col p-3 transition-colors lg:h-full", isOver && "border-primary bg-primary-soft", !full && "lg:max-h-[calc(100vh-240px)]")}>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-serif text-base font-semibold">Neașezați</h2>
          <Badge tone={total ? "warning" : "success"}>{plural(total, "persoană", "persoane")}</Badge>
        </div>
        <div className="relative mb-2">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          <Input className="h-8 pl-8 text-xs" placeholder="Caută invitat…" value={query} onChange={(e) => onQuery(e.target.value)} />
        </div>
        {guests.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">{query ? "Niciun rezultat." : "Toți invitații au un loc 🎉"}</p>
        ) : (
          <div className="-mx-1 flex max-h-36 flex-wrap gap-1.5 overflow-y-auto px-1 lg:max-h-none lg:flex-col lg:flex-nowrap">
            {guests.map((g) => (
              <DraggableGuest key={g.id} id={`list:${g.id}`} guestId={g.id} onClick={() => onGuestClick(g)}>
                <GuestPill guest={g} />
              </DraggableGuest>
            ))}
          </div>
        )}
        <p className="mt-2 hidden text-xs text-muted lg:block">Trage invitatul pe plan sau apasă pe el ca să alegi masa. Cei care au refuzat nu apar aici.</p>
      </Card>
    </div>
  );
}

function DraggableGuest({ id, guestId, onClick, children, className, style }: { id: string; guestId: string; onClick: () => void; children: ReactNode; className?: string; style?: CSSProperties }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id, data: { guestId } satisfies DragData });
  return (
    <button
      ref={setNodeRef}
      type="button"
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

function GuestPill({ guest, lifted }: { guest: Guest; lifted?: boolean }) {
  const n = persons(guest);
  return (
    <span
      className={cx(
        "flex max-w-64 cursor-grab items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm",
        guest.rsvp === "Da" ? "border-success/30 bg-success-soft" : "border-warning/30 bg-warning-soft",
        lifted && "cursor-grabbing shadow-xl",
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
      {guest.rsvp === "Necunoscut" && <span className="shrink-0 text-xs text-warning">?</span>}
    </span>
  );
}

// ---------- elementele planului ----------

const ELEMENT_STYLE: Record<TipElement, string> = {
  Masă: "bg-surface border-border",
  "Masa mirilor": "bg-primary-soft border-primary/60",
  Scenă: "border-muted/40 bg-[repeating-linear-gradient(45deg,var(--surface-2),var(--surface-2)_8px,var(--surface)_8px,var(--surface)_16px)]",
  "Scena formației": "bg-info-soft border-info/50",
  "Ring de dans": "bg-warning-soft border-warning/40 border-dashed",
};

function Element({
  el, guests, selected, onPointerDown, onDoubleClick, onGuestClick,
}: {
  el: Table;
  guests: Guest[];
  selected: boolean;
  onPointerDown: (e: React.PointerEvent, mode: "move" | "resize") => void;
  onDoubleClick: () => void;
  onGuestClick: (g: Guest) => void;
}) {
  const seated = hasSeats(el);
  const { setNodeRef, isOver } = useDroppable({ id: `table:${el.id}`, disabled: !seated });
  const map = seated ? seatMap(el, guests) : null;
  const over = map ? map.used > el.locuri : false;
  const positions = seated ? seatPositions(el) : [];
  const small = Math.min(el.latime, el.inaltime) < 70;

  return (
    <div className="absolute" style={{ left: el.x, top: el.y, width: el.latime, height: el.inaltime }}>
      <div
        ref={setNodeRef}
        onPointerDown={(e) => onPointerDown(e, "move")}
        onDoubleClick={onDoubleClick}
        className={cx(
          "absolute inset-0 flex cursor-move touch-none select-none flex-col items-center justify-center border-2 text-center shadow-sm transition-[box-shadow,border-color]",
          el.forma === "Rotundă" ? "rounded-full" : "rounded-xl",
          ELEMENT_STYLE[el.tip],
          over && "border-danger",
          isOver && "border-primary ring-4 ring-primary/20",
          selected && "ring-2 ring-primary ring-offset-2 ring-offset-transparent",
        )}
      >
        {el.tip === "Scena formației" && <Music className="mb-0.5 h-5 w-5 text-info" />}
        {el.tip === "Ring de dans" && <Sparkles className="mb-0.5 h-5 w-5 text-warning" />}
        <span className={cx("max-w-full truncate px-2 font-medium leading-tight", small ? "text-[11px]" : "text-sm")}>{el.nume}</span>
        {map && (
          <span className={cx("text-[11px] tabular-nums", over ? "font-semibold text-danger" : "text-muted")}>
            {map.used}/{el.locuri}
          </span>
        )}
      </div>

      {map &&
        positions.map((p, k) => (
          <Seat key={k} tableId={el.id} index={k} x={p.x} y={p.y} occupant={map.seats[k] ?? null} onGuestClick={onGuestClick} />
        ))}

      {map && map.overflow > 0 && (
        <span className="absolute -right-2 -top-2 rounded-full bg-danger px-1.5 py-0.5 text-[10px] font-semibold text-white" title="Persoane fără loc la această masă">
          +{map.overflow}
        </span>
      )}

      {selected && (
        <div
          onPointerDown={(e) => onPointerDown(e, "resize")}
          className="absolute -bottom-2 -right-2 h-4 w-4 cursor-nwse-resize touch-none rounded-sm border-2 border-primary bg-surface"
          title="Trage ca să mărești sau micșorezi"
        />
      )}
    </div>
  );
}

function Seat({ tableId, index, x, y, occupant, onGuestClick }: { tableId: string; index: number; x: number; y: number; occupant: SeatOccupant | null; onGuestClick: (g: Guest) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: `seat:${tableId}:${index}` });
  const base: CSSProperties = { left: x - SEAT / 2, top: y - SEAT / 2, width: SEAT, height: SEAT };

  if (!occupant) {
    return <div ref={setNodeRef} style={base} className={cx("absolute rounded-full border-2 border-dashed", isOver ? "border-primary bg-primary-soft" : "border-border bg-surface/60")} />;
  }

  const g = occupant.guest;
  const label = occupant.kind === "principal" ? initials(g.nume) : occupant.kind === "copil" ? "c" : "+";
  const who = occupant.kind === "principal" ? g.nume : `${occupant.kind === "copil" ? "Copil" : "Însoțitor"} · ${g.nume}`;
  return (
    <div ref={setNodeRef} style={base} className="absolute">
      <DraggableGuest id={`seat:${tableId}:${index}:${g.id}`} guestId={g.id} onClick={() => onGuestClick(g)} className="block h-full w-full">
        <span
          title={`${who}${g.restrictii ? ` · ${g.restrictii}` : ""}`}
          className={cx(
            "flex h-full w-full cursor-grab items-center justify-center rounded-full border-2 text-[11px] font-semibold shadow-sm",
            g.rsvp === "Da" ? "border-success/60 bg-success-soft text-success" : "border-warning/60 bg-warning-soft text-warning",
            occupant.kind !== "principal" && "opacity-75",
            isOver && "ring-2 ring-primary",
          )}
        >
          {label}
        </span>
      </DraggableGuest>
    </div>
  );
}

function PresetIcon({ tip, forma, square }: { tip: TipElement; forma: Forma; square: boolean }) {
  const cls = cx(
    "inline-block shrink-0 border-2",
    forma === "Rotundă" ? "h-5 w-5 rounded-full" : square ? "h-4 w-4 rounded-sm" : "h-3.5 w-6 rounded-sm",
    ELEMENT_STYLE[tip],
  );
  if (tip === "Scena formației") return <Music className="h-5 w-5 text-info" />;
  if (tip === "Ring de dans") return <Sparkles className="h-5 w-5 text-warning" />;
  return <span className={cls} />;
}

// ---------- editare element ----------

function ElementForm({ initial, onClose, onSave, onDelete }: { initial: Table; onClose: () => void; onSave: (t: Table) => void; onDelete: () => void }) {
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
          <Button variant="ghost" className="mr-auto text-danger" icon={<Trash2 className="h-4 w-4" />} onClick={onDelete}>
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
        <div className="grid grid-cols-3 gap-3">
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
        </div>
        {t.forma === "Dreptunghiulară" && t.latime !== t.inaltime && (
          <button type="button" className="text-xs text-primary underline" onClick={() => set("inaltime", t.latime)}>
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

import { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext, DragOverlay, MouseSensor, TouchSensor, pointerWithin, rectIntersection, useSensor, useSensors,
  type CollisionDetection, type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { Copy, Hand, Layers, Magnet, Maximize2, Minimize2, Minus, Pencil, Plus, RotateCcw, RotateCw, Scan, Trash2, X } from "lucide-react";
import { firstFreeSeat, hasSeats, persons, seatMap, seatTables, seatingStats, type SeatOccupant } from "../../lib/calc";
import { plural } from "../../lib/format";
import { newId } from "../../lib/ids";
import {
  GRID, LABEL_MODES, MIN_SIZE, PRESETS, SEAT_SIZE, boardSize, contentBounds, makeElement, normalizeAngle, rotation, snap,
  type LabelMode,
} from "../../lib/layout";
import type { Guest, Table } from "../../lib/types";
import { usePlanner } from "../../state/planner";
import { useFeedback } from "../../components/feedback";
import { Button, Card, Segmented, cx } from "../../components/ui";
import { Element, ElementForm, GuestPill, PresetIcon, UNSEATED, UnseatedPanel, type DragData, type Interaction, type Mode } from "./parts";
import { GuestPicker, GuestSheet, TableChooser, TableSheet } from "./sheets";
import { useCanvasZoom } from "./useCanvasZoom";

// Planul sălii, în două moduri:
// - „Așază invitații”: atingi un invitat, apoi locul lui (sau tragi); atingi o masă ca să vezi cine stă acolo.
//   Planul se mișcă liber cu degetul, iar cu două degete faci zoom.
// - „Aranjează sala”: muți, rotești și redimensionezi mesele, scenele și ringul de dans.

type Live = Pick<Table, "id" | "x" | "y" | "latime" | "inaltime" | "rotatie">;
/** pozițiile „în mișcare”, pe id, înainte de salvare (unul sau mai multe elemente) */
type LiveMap = Record<string, Live>;

type Dialog =
  | { kind: "pick"; tableId: string; seat: number | null }
  | { kind: "guest"; guestId: string; seat?: number }
  | { kind: "table"; tableId: string }
  | { kind: "choose"; guestId: string }
  | { kind: "edit"; el: Table };

const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length ? hits : rectIntersection(args);
};

function stored<T extends string>(key: string, allowed: readonly T[]): T | null {
  try {
    const v = localStorage.getItem(key) as T | null;
    return v && allowed.includes(v) ? v : null;
  } catch {
    return null;
  }
}
function store(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* fără localStorage */
  }
}

export function Seating() {
  const { data, add, update, remove } = usePlanner();
  const { confirm } = useFeedback();
  const scrollRef = useRef<HTMLDivElement>(null);
  const { zoom, hasStoredZoom, centerOn, step } = useCanvasZoom(scrollRef);

  const [mode, setModeState] = useState<Mode>(() => stored("pn_seat_mode", ["seat", "arrange"] as const) ?? (data.tables.length ? "seat" : "arrange"));
  const [labelMode, setLabelModeState] = useState<LabelMode>(() => stored("pn_seat_labels", ["initiale", "scurt", "complet"] as const) ?? "scurt");
  const [snapOn, setSnapOn] = useState(true);
  const [full, setFull] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  /** pe telefon: fiecare atingere adaugă/scoate un element din selecție */
  const [multi, setMulti] = useState(false);
  const [live, setLive] = useState<LiveMap | null>(null);
  /** dreptunghiul de selecție (mouse), în unități de plan */
  const [marquee, setMarquee] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const suppressClick = useRef(false);
  const [dragGuest, setDragGuest] = useState<Guest | null>(null);
  const [armedId, setArmedId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [query, setQuery] = useState("");
  const liveRef = useRef<LiveMap | null>(null);
  const nudgeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const setMode = (m: Mode) => {
    setModeState(m);
    store("pn_seat_mode", m);
    if (m === "seat") {
      setSelected([]);
      setMulti(false);
    } else setArmedId(null);
  };
  const setLabelMode = (m: LabelMode) => {
    setLabelModeState(m);
    store("pn_seat_labels", m);
  };

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
  );

  const seatSize = SEAT_SIZE[labelMode];
  const elements = useMemo(() => data.tables.map((t) => (live?.[t.id] ? { ...t, ...live[t.id] } : t)), [data.tables, live]);
  const board = boardSize(elements, seatSize);
  const stats = seatingStats(data);
  const tables = seatTables(data.tables);
  const tableIds = new Set(tables.map((t) => t.id));
  const unseated = data.guests
    .filter((g) => g.rsvp !== "Nu" && !tableIds.has(g.masaId))
    .filter((g) => !query.trim() || `${g.nume} ${g.grup}`.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => a.grup.localeCompare(b.grup, "ro") || a.nume.localeCompare(b.nume, "ro"));
  const selectedEls = mode === "arrange" ? elements.filter((e) => selected.includes(e.id)) : [];
  const selectedEl = selectedEls.length === 1 ? selectedEls[0] : null;
  const armed = data.guests.find((g) => g.id === armedId) ?? null;
  const findGuest = (id: string) => data.guests.find((g) => g.id === id);
  const findTable = (id: string) => data.tables.find((t) => t.id === id);

  // ---------- încadrare ----------

  const fit = () => {
    const s = scrollRef.current;
    const b = contentBounds(elements, seatSize);
    if (!s || !b) return;
    const z = Math.min((s.clientWidth - 40) / (b.maxX - b.minX), (s.clientHeight - 40) / (b.maxY - b.minY));
    centerOn(z, (b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2);
  };

  const fitted = useRef(false);
  useEffect(() => {
    if (fitted.current || !data.tables.length) return;
    fitted.current = true;
    if (!hasStoredZoom) fit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.tables.length]);

  // ---------- mutare / redimensionare / rotire ----------

  /** Salvează tot ce s-a mutat (unul sau mai multe elemente) într-o singură scriere. */
  const commitLive = () => {
    const l = liveRef.current;
    liveRef.current = null;
    if (!l) return setLive(null);
    const rows = data.tables.filter((t) => l[t.id]).map((t) => ({ ...t, ...l[t.id] }));
    update("tables", rows).finally(() => setLive((cur) => (cur === l ? null : cur)));
  };

  const pick = (t: Table): Live => ({ id: t.id, x: t.x, y: t.y, latime: t.latime, inaltime: t.inaltime, rotatie: rotation(t) });

  const startInteraction = (e: React.PointerEvent, el: Table, kind: Interaction) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    const rot = rotation(el);
    const a = (rot * Math.PI) / 180;
    const start = { px: e.clientX, py: e.clientY, x: el.x, y: el.y, w: el.latime, h: el.inaltime };
    const center = { x: el.x + el.latime / 2, y: el.y + el.inaltime / 2 };
    const wrapper = (e.currentTarget as HTMLElement).parentElement!.getBoundingClientRect();
    const screenCenter = { x: wrapper.left + wrapper.width / 2, y: wrapper.top + wrapper.height / 2 };
    const keepCircle = el.forma === "Rotundă" && hasSeats(el);
    let moved = false;

    // selecția: Shift / Ctrl / ⌘ (sau modul „mai multe” de pe telefon) adaugă la selecție
    const additive = e.shiftKey || e.ctrlKey || e.metaKey || multi;
    const wasSelected = selected.includes(el.id);
    let group = selected;
    if (kind === "move" && !wasSelected) {
      group = additive ? [...selected, el.id] : [el.id];
      setSelected(group);
    }
    const members = kind === "move" ? elements.filter((t) => group.includes(t.id)) : [el];

    const onMove = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - start.px, ev.clientY - start.py) < 4) return;
      moved = true;
      const dx = (ev.clientX - start.px) / zoom;
      const dy = (ev.clientY - start.py) / zoom;
      let next: LiveMap;
      if (kind === "move") {
        // elementul tras se aliniază la grilă; restul grupului se mută cu aceeași distanță
        const ddx = Math.max(0, snap(start.x + dx, snapOn)) - start.x;
        const ddy = Math.max(0, snap(start.y + dy, snapOn)) - start.y;
        next = Object.fromEntries(members.map((t) => [t.id, { ...pick(t), x: Math.max(0, t.x + ddx), y: Math.max(0, t.y + ddy) }]));
      } else if (kind === "resize") {
        // în sistemul mesei (rotite), centrul rămâne pe loc și colțul urmează cursorul
        const lx = dx * Math.cos(a) + dy * Math.sin(a);
        const ly = -dx * Math.sin(a) + dy * Math.cos(a);
        let w = Math.max(MIN_SIZE, snap(start.w + 2 * lx, snapOn));
        let h = Math.max(MIN_SIZE, snap(start.h + 2 * ly, snapOn));
        if (keepCircle) w = h = Math.max(w, h);
        next = { [el.id]: { ...pick(el), latime: w, inaltime: h, x: Math.round(center.x - w / 2), y: Math.round(center.y - h / 2) } };
      } else {
        const ang = (Math.atan2(ev.clientY - screenCenter.y, ev.clientX - screenCenter.x) * 180) / Math.PI + 90;
        next = { [el.id]: { ...pick(el), rotatie: normalizeAngle(snapOn ? Math.round(ang / 15) * 15 : ang) } };
      }
      liveRef.current = next;
      setLive(next);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      if (moved) return commitLive();
      liveRef.current = null;
      if (kind !== "move") return;
      // simplu clic: cu Shift/Ctrl scoate din selecție un element deja selectat, altfel îl selectează doar pe el
      if (additive && wasSelected) setSelected(selected.filter((id) => id !== el.id));
      else if (!additive) setSelected([el.id]);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  /** Dreptunghi de selecție cu mouse-ul, pe zona goală a planului (pe telefon, zona goală derulează). */
  const startMarquee = (e: React.PointerEvent) => {
    if (mode !== "arrange" || e.button !== 0 || e.pointerType !== "mouse") return;
    const s = scrollRef.current;
    if (!s) return;
    const r = s.getBoundingClientRect();
    const toBoard = (cx: number, cy: number) => ({ x: (cx - r.left + s.scrollLeft) / zoom, y: (cy - r.top + s.scrollTop) / zoom });
    const p0 = toBoard(e.clientX, e.clientY);
    const additive = e.shiftKey || e.ctrlKey || e.metaKey;
    const base = additive ? selected : [];
    let rect = { x0: p0.x, y0: p0.y, x1: p0.x, y1: p0.y };
    let moved = false;
    const onMove = (ev: PointerEvent) => {
      const p = toBoard(ev.clientX, ev.clientY);
      if (!moved && Math.hypot(p.x - p0.x, p.y - p0.y) * zoom < 5) return;
      moved = true;
      rect = { ...rect, x1: p.x, y1: p.y };
      setMarquee(rect);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setMarquee(null);
      if (!moved) return; // clicul simplu pe gol deselectează (în onClick)
      suppressClick.current = true;
      const minX = Math.min(rect.x0, rect.x1);
      const maxX = Math.max(rect.x0, rect.x1);
      const minY = Math.min(rect.y0, rect.y1);
      const maxY = Math.max(rect.y0, rect.y1);
      const hit = elements.filter((t) => t.x < maxX && t.x + t.latime > minX && t.y < maxY && t.y + t.inaltime > minY).map((t) => t.id);
      setSelected([...new Set([...base, ...hit])]);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const rotateBy = (els: Table[], delta: number) => update("tables", els.map((el) => ({ ...el, rotatie: normalizeAngle(rotation(el) + delta) })));

  // săgețile mută elementele selectate; salvăm o singură dată, după ce te oprești
  const nudge = (els: Table[], dx: number, dy: number) => {
    const cur = liveRef.current ?? {};
    const next: LiveMap = Object.fromEntries(
      els.map((el) => {
        const base = cur[el.id] ?? pick(el);
        return [el.id, { ...base, x: Math.max(0, base.x + dx), y: Math.max(0, base.y + dy) }];
      }),
    );
    liveRef.current = next;
    setLive(next);
    clearTimeout(nudgeTimer.current);
    nudgeTimer.current = setTimeout(commitLive, 600);
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

  const arm = (g: Guest | null) => {
    setDialog(null);
    setArmedId((cur) => (g && cur !== g.id ? g.id : null));
  };

  const onSeatClick = (t: Table, k: number, occ: SeatOccupant | null) => {
    if (armed) {
      if (occ?.guest.id !== armed.id) placeAt(armed, t, k);
      setArmedId(null);
      return;
    }
    if (occ) setDialog({ kind: "guest", guestId: occ.guest.id, seat: k });
    else setDialog({ kind: "pick", tableId: t.id, seat: k });
  };

  const onBodyClick = (t: Table) => {
    if (!hasSeats(t)) return;
    if (armed) {
      seatAnywhere(armed, t);
      setArmedId(null);
    } else setDialog({ kind: "table", tableId: t.id });
  };

  const onDragStart = (e: DragStartEvent) => {
    const id = (e.active.data.current as DragData | undefined)?.guestId;
    setDragGuest(data.guests.find((g) => g.id === id) ?? null);
    setArmedId(null);
  };

  const onDragEnd = (e: DragEndEvent) => {
    setDragGuest(null);
    const g = findGuest((e.active.data.current as DragData | undefined)?.guestId ?? "");
    const over = e.over ? String(e.over.id) : null;
    if (!g || !over) return;
    if (over === UNSEATED) return unseat(g);
    const [kind, tableId, seat] = over.split(":");
    const t = findTable(tableId);
    if (!t) return;
    if (kind === "seat") placeAt(g, t, Number(seat));
    else if (kind === "table") seatAnywhere(g, t);
  };

  // ---------- elemente ----------

  const addElement = async (presetIndex: number) => {
    setAddOpen(false);
    const p = PRESETS[presetIndex];
    const s = scrollRef.current;
    const c = s ? { x: (s.scrollLeft + s.clientWidth / 2) / zoom, y: (s.scrollTop + s.clientHeight / 2) / zoom } : { x: 400, y: 300 };
    const el = makeElement(p, snap(c.x, snapOn), snap(c.y, snapOn), tables.length);
    if (await add("tables", [el], `${p.label} adăugată`)) {
      setMode("arrange");
      setSelected([el.id]);
    }
  };

  const duplicate = async (els: Table[]) => {
    let n = tables.length;
    const copies: Table[] = els.map((el) => ({
      ...el,
      id: newId(),
      nume: el.tip === "Masă" ? `Masa ${++n}` : `${el.nume} (copie)`,
      x: el.x + 40,
      y: el.y + 40,
    }));
    if (await add("tables", copies, els.length > 1 ? `${plural(copies.length, "element duplicat", "elemente duplicate")}` : "Element duplicat")) {
      setSelected(copies.map((c) => c.id));
    }
  };

  const deleteElements = async (els: Table[]) => {
    const ids = els.map((e) => e.id);
    const seated = data.guests.filter((g) => ids.includes(g.masaId));
    const ok = await confirm({
      title: els.length === 1 ? `Ștergi „${els[0].nume}”?` : `Ștergi ${plural(els.length, "element", "elemente")}?`,
      text: seated.length ? `${plural(seated.length, "invitat ajunge", "invitați ajung")} la „Neașezați”.` : "Dispar din plan.",
      confirmLabel: "Șterge",
      danger: true,
    });
    if (!ok) return;
    if (seated.length && !(await update("guests", seated.map((g) => ({ ...g, masaId: "", loc: null }))))) return;
    if (await remove("tables", ids, "Șters")) {
      setSelected([]);
      setDialog(null);
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

  // ---------- tastatură ----------

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // HTMLElement, nu Element: „Element” e componenta planului importată mai sus
      const t = e.target instanceof HTMLElement ? e.target : null;
      if (t?.closest("input, textarea, select, dialog")) return;
      if (e.key === "Escape") {
        if (armedId) setArmedId(null);
        else if (selected.length) setSelected([]);
        else if (full) setFull(false);
        return;
      }
      if (mode === "arrange" && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
        e.preventDefault();
        setSelected(data.tables.map((t) => t.id));
        return;
      }
      if (!selectedEls.length) return;
      const stepPx = e.shiftKey ? GRID : 5;
      const moves: Record<string, [number, number]> = { ArrowLeft: [-stepPx, 0], ArrowRight: [stepPx, 0], ArrowUp: [0, -stepPx], ArrowDown: [0, stepPx] };
      if (moves[e.key]) {
        e.preventDefault();
        nudge(selectedEls, ...moves[e.key]);
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        deleteElements(selectedEls);
      } else if (e.key.toLowerCase() === "r" && !e.ctrlKey && !e.metaKey) {
        rotateBy(selectedEls, e.shiftKey ? -15 : 15);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ---------- randare ----------

  const guestDialog = dialog?.kind === "guest" ? findGuest(dialog.guestId) : undefined;
  const chooseGuest = dialog?.kind === "choose" ? findGuest(dialog.guestId) : undefined;
  const pickTable = dialog?.kind === "pick" ? findTable(dialog.tableId) : undefined;
  const sheetTable = dialog?.kind === "table" ? findTable(dialog.tableId) : undefined;

  return (
    <div className={cx(full ? "fixed inset-0 z-40 flex flex-col gap-2 overflow-hidden bg-bg p-2 sm:p-3" : "space-y-3")}>
      <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-2">
        <div className={cx(full && "hidden sm:block")}>
          <h1 className="font-serif text-2xl font-semibold">Plan de mese</h1>
          <p className="text-sm text-muted">
            {stats.seatedPersons} din {stats.seatedPersons + stats.unseatedPersons} persoane așezate · {stats.seats} locuri la {plural(stats.tables, "masă", "mese")}
            {stats.overfull.length > 0 && <span className="text-danger-ink"> · {plural(stats.overfull.length, "masă prea plină", "mese prea pline")}</span>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            value={mode}
            options={[
              { value: "seat", label: "Așază invitații" },
              { value: "arrange", label: "Aranjează sala" },
            ]}
            onChange={setMode}
          />
          <div className="relative">
            <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setAddOpen((o) => !o)} aria-expanded={addOpen}>
              Adaugă
            </Button>
            {addOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setAddOpen(false)} />
                <div className="absolute right-0 z-50 mt-1 w-60 overflow-hidden rounded-xl border border-border bg-surface py-1 shadow-xl">
                  {PRESETS.map((p, i) => (
                    <button key={p.label} type="button" onClick={() => addElement(i)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-surface-2">
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

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted">Pe locuri:</span>
        <Segmented size="sm" value={labelMode} options={LABEL_MODES} onChange={setLabelMode} />
        {mode === "arrange" && (
          <>
            <span className="flex-1" />
            <button
              type="button"
              onClick={() => setMulti((m) => !m)}
              aria-pressed={multi}
              className={cx(
                "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors",
                multi ? "border-primary bg-primary-soft text-primary-ink" : "border-border bg-surface text-muted hover:text-text",
              )}
              title="Cât e pornit, fiecare atingere adaugă sau scoate un element din selecție. Pe calculator: Shift/Ctrl + clic sau trage un dreptunghi."
            >
              <Layers className="h-3.5 w-3.5" />
              Selectează mai multe
            </button>
          </>
        )}
      </div>

      {selectedEls.length > 1 && (
        <Card className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2 text-sm">
          <span className="font-medium">{plural(selectedEls.length, "element selectat", "elemente selectate")}</span>
          <span className="hidden text-xs text-muted sm:inline">trage oricare ca să le muți pe toate</span>
          <span className="inline-flex items-center gap-1">
            <IconBtn label="Rotește-le la stânga 15°" onClick={() => rotateBy(selectedEls, -15)}>
              <RotateCcw className="h-4 w-4" />
            </IconBtn>
            <IconBtn label="Rotește-le la dreapta 15°" onClick={() => rotateBy(selectedEls, 15)}>
              <RotateCw className="h-4 w-4" />
            </IconBtn>
          </span>
          <span className="flex-1" />
          <Button size="sm" variant="ghost" icon={<Copy className="h-4 w-4" />} onClick={() => duplicate(selectedEls)}>
            <span className="hidden sm:inline">Duplică</span>
          </Button>
          <Button size="sm" variant="ghost" className="text-danger-ink" icon={<Trash2 className="h-4 w-4" />} onClick={() => deleteElements(selectedEls)}>
            <span className="hidden sm:inline">Șterge</span>
          </Button>
          <Button size="sm" variant="ghost" icon={<X className="h-4 w-4" />} onClick={() => setSelected([])}>
            <span className="hidden sm:inline">Deselectează</span>
          </Button>
        </Card>
      )}

      {selectedEl && (
        <Card className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2 text-sm">
          <span className="max-w-[40vw] truncate font-medium">{selectedEl.nume}</span>
          {hasSeats(selectedEl) && (
            <span className="inline-flex items-center gap-1">
              <IconBtn label="Un loc mai puțin" onClick={() => changeSeats(selectedEl, -1)}>
                <Minus className="h-4 w-4" />
              </IconBtn>
              <span className="w-16 text-center tabular-nums">{plural(selectedEl.locuri, "loc", "locuri")}</span>
              <IconBtn label="Un loc în plus" onClick={() => changeSeats(selectedEl, 1)}>
                <Plus className="h-4 w-4" />
              </IconBtn>
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <IconBtn label="Rotește la stânga 15°" onClick={() => rotateBy([selectedEl], -15)}>
              <RotateCcw className="h-4 w-4" />
            </IconBtn>
            <span className="w-10 text-center tabular-nums text-muted">{rotation(selectedEl)}°</span>
            <IconBtn label="Rotește la dreapta 15°" onClick={() => rotateBy([selectedEl], 15)}>
              <RotateCw className="h-4 w-4" />
            </IconBtn>
          </span>
          <span className="flex-1" />
          <Button size="sm" variant="ghost" icon={<Pencil className="h-4 w-4" />} onClick={() => setDialog({ kind: "edit", el: selectedEl })}>
            <span className="hidden sm:inline">Editează</span>
          </Button>
          <Button size="sm" variant="ghost" icon={<Copy className="h-4 w-4" />} onClick={() => duplicate([selectedEl])}>
            <span className="hidden sm:inline">Duplică</span>
          </Button>
          <Button size="sm" variant="ghost" className="text-danger-ink" icon={<Trash2 className="h-4 w-4" />} onClick={() => deleteElements([selectedEl])}>
            <span className="hidden sm:inline">Șterge</span>
          </Button>
        </Card>
      )}

      <DndContext sensors={sensors} collisionDetection={collision} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragGuest(null)}>
        {/* minmax(0,…): rândul de invitați (derulabil lateral pe telefon) nu are voie să lățească pagina */}
        <div className={cx("grid grid-cols-[minmax(0,1fr)] gap-3 lg:grid-cols-[minmax(0,1fr)_290px]", full && "min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] lg:grid-rows-1")}>
          <UnseatedPanel
            className="lg:order-2"
            full={full}
            guests={unseated}
            total={stats.unseatedPersons}
            query={query}
            armedId={armedId}
            onQuery={setQuery}
            onGuestClick={(g) => arm(g)}
            onClear={clearSeats}
          />

          <div
            className={cx(
              "relative overflow-hidden rounded-2xl border border-border bg-surface-2/60 lg:order-1",
              full ? "min-h-0" : "h-[68vh] min-h-[380px] lg:h-[calc(100vh-250px)]",
            )}
          >
            <div ref={scrollRef} className="h-full w-full overflow-auto overscroll-contain" style={{ touchAction: "pan-x pan-y" }}>
              <div
                style={{ width: board.w * zoom, height: board.h * zoom }}
                onPointerDown={(e) => {
                  if (e.target === e.currentTarget || (e.target as HTMLElement).dataset.board) startMarquee(e);
                }}
                onClick={(e) => {
                  if (e.target !== e.currentTarget && !(e.target as HTMLElement).dataset.board) return;
                  // după un dreptunghi de selecție vine și un „click” pe gol; nu vrem să deselecteze
                  if (suppressClick.current) {
                    suppressClick.current = false;
                    return;
                  }
                  setSelected([]);
                  setArmedId(null);
                }}
              >
                <div
                  data-board="1"
                  className="relative origin-top-left"
                  style={{
                    width: board.w,
                    height: board.h,
                    transform: `scale(${zoom})`,
                    backgroundImage: "radial-gradient(var(--border) 1.2px, transparent 1.2px)",
                    backgroundSize: `${GRID}px ${GRID}px`,
                  }}
                >
                  {elements.map((el) => (
                    <Element
                      key={el.id}
                      el={el}
                      guests={data.guests}
                      seatSize={seatSize}
                      labelMode={labelMode}
                      mode={mode}
                      selected={mode === "arrange" && selected.includes(el.id)}
                      handles={selectedEls.length === 1}
                      armed={!!armed}
                      onInteraction={(e, kind) => startInteraction(e, el, kind)}
                      onBodyClick={() => onBodyClick(el)}
                      onDoubleClick={() => setDialog({ kind: "edit", el })}
                      onSeatClick={(k, occ) => onSeatClick(el, k, occ)}
                    />
                  ))}
                  {marquee && (
                    <div
                      className="pointer-events-none absolute rounded-sm border-2 border-primary bg-primary/10"
                      style={{
                        left: Math.min(marquee.x0, marquee.x1),
                        top: Math.min(marquee.y0, marquee.y1),
                        width: Math.abs(marquee.x1 - marquee.x0),
                        height: Math.abs(marquee.y1 - marquee.y0),
                      }}
                    />
                  )}
                  {elements.length === 0 && (
                    <div className="absolute left-6 top-6 max-w-sm rounded-xl border border-dashed border-border bg-surface p-5 text-sm text-muted">
                      Planul e gol. Apasă <b>Adaugă</b> și pune mesele, masa mirilor, scena formației și ringul de dans.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {armed && (
              <div className="absolute inset-x-2 top-2 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-primary/40 bg-surface/95 px-3 py-2 text-sm shadow-lg backdrop-blur">
                <Hand className="h-4 w-4 shrink-0 text-primary-ink" />
                <span className="min-w-0 flex-1">
                  Atinge un loc pentru <b>{armed.nume}</b>
                  {persons(armed) > 1 && ` (${persons(armed)} persoane, însoțitorii stau alături)`}
                </span>
                <Button size="sm" onClick={() => setDialog({ kind: "choose", guestId: armed.id })}>
                  Din listă
                </Button>
                <button type="button" className="rounded-md p-1.5 text-muted hover:bg-surface-2" onClick={() => setArmedId(null)} aria-label="Anulează">
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            <div className="absolute bottom-2 right-2 flex items-center gap-1.5 sm:bottom-3 sm:right-3 sm:gap-2">
              {mode === "arrange" && (
                <button
                  type="button"
                  onClick={() => setSnapOn((s) => !s)}
                  className={cx("rounded-lg p-2.5 shadow-sm sm:p-2", snapOn ? "bg-primary text-primary-fg" : "border border-border bg-surface text-muted")}
                  title={snapOn ? "Aliniere la grilă: pornită" : "Aliniere la grilă: oprită"}
                  aria-pressed={snapOn}
                >
                  <Magnet className="h-4 w-4" />
                </button>
              )}
              <div className="flex items-center rounded-lg border border-border bg-surface shadow-sm">
                <button type="button" className="p-2.5 text-muted hover:text-text sm:p-2" onClick={() => step(-1)} aria-label="Micșorează">
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-11 text-center text-xs tabular-nums">{Math.round(zoom * 100)}%</span>
                <button type="button" className="p-2.5 text-muted hover:text-text sm:p-2" onClick={() => step(1)} aria-label="Mărește">
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <button type="button" className="rounded-lg border border-border bg-surface p-2.5 text-muted shadow-sm hover:text-text sm:p-2" onClick={fit} title="Încadrează tot planul">
                <Scan className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="rounded-lg border border-border bg-surface p-2.5 text-muted shadow-sm hover:text-text sm:p-2"
                onClick={() => setFull((f) => !f)}
                title={full ? "Ieși din ecran complet" : "Ecran complet"}
              >
                {full ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>

        <DragOverlay dropAnimation={null}>{dragGuest && <GuestPill guest={dragGuest} lifted />}</DragOverlay>
      </DndContext>

      {!full && (
        <p className="text-xs text-muted">
          {mode === "seat" ? (
            <>
              Atinge un invitat din „Neașezați”, apoi locul lui. Pe un loc liber vezi pe cine poți pune, iar pe o masă vezi cine stă acolo. Poți și trage invitații: pe telefon ții apăsat puțin, apoi tragi. Planul îl muți cu un deget și faci zoom cu două degete
              (pe calculator: Ctrl + rotița).
            </>
          ) : (
            <>
              Trage elementele ca să le muți. Elementul selectat are un buton rotund deasupra pentru rotire și un pătrat în colț pentru mărime. Pe calculator: săgețile îl mută, R îl rotește, Delete îl șterge. Dublu-clic deschide editarea.
            </>
          )}
        </p>
      )}

      {pickTable && dialog?.kind === "pick" && (
        <GuestPicker
          title={dialog.seat === null ? `Cine stă la ${pickTable.nume}?` : `Cine stă pe locul ${dialog.seat + 1} · ${pickTable.nume}?`}
          guests={data.guests}
          tables={tables}
          onClose={() => setDialog(null)}
          onPick={(g) => {
            if (dialog.seat === null) seatAnywhere(g, pickTable);
            else placeAt(g, pickTable, dialog.seat);
            setDialog(null);
          }}
        />
      )}

      {guestDialog && dialog?.kind === "guest" && (
        <GuestSheet
          guest={guestDialog}
          table={findTable(guestDialog.masaId)}
          seat={dialog.seat}
          onClose={() => setDialog(null)}
          onArm={() => arm(guestDialog)}
          onChooseTable={() => setDialog({ kind: "choose", guestId: guestDialog.id })}
          onUnseat={() => {
            unseat(guestDialog);
            setDialog(null);
          }}
        />
      )}

      {sheetTable && (
        <TableSheet
          table={sheetTable}
          guests={data.guests}
          onClose={() => setDialog(null)}
          onGuest={(g) => setDialog({ kind: "guest", guestId: g.id })}
          onUnseat={(g) => unseat(g)}
          onAdd={() => setDialog({ kind: "pick", tableId: sheetTable.id, seat: null })}
          onArrange={() => {
            setDialog(null);
            setMode("arrange");
            setSelected([sheetTable.id]);
          }}
        />
      )}

      {chooseGuest && (
        <TableChooser
          guest={chooseGuest}
          tables={tables}
          guests={data.guests}
          onClose={() => setDialog(null)}
          onUnseat={() => {
            unseat(chooseGuest);
            setDialog(null);
            setArmedId(null);
          }}
          onPick={(t) => {
            seatAnywhere(chooseGuest, t);
            setDialog(null);
            setArmedId(null);
          }}
        />
      )}

      {dialog?.kind === "edit" && (
        <ElementForm
          initial={dialog.el}
          onClose={() => setDialog(null)}
          onSave={async (el) => (await update("tables", [{ ...el, rotatie: normalizeAngle(el.rotatie) }], "Salvat")) && setDialog(null)}
          onDelete={() => deleteElements([dialog.el])}
        />
      )}
    </div>
  );
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" className="rounded-md border border-border p-1.5 hover:bg-surface-2" onClick={onClick} aria-label={label} title={label}>
      {children}
    </button>
  );
}

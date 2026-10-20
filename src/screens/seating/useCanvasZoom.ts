import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { ZOOM_MAX, ZOOM_MIN } from "../../lib/layout";

// Zoom pe plan: butoane, Ctrl/⌘ + rotiță (și „pinch” pe touchpad), două degete pe telefon.
// Punctul de sub cursor/degete rămâne pe loc când zoomul se schimbă.

const clamp = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));

interface Anchor {
  bx: number; // punct pe plan (unități de plan)
  by: number;
  cx: number; // unde trebuie să ajungă în container (px)
  cy: number;
}

function readZoom(): number {
  try {
    const z = Number(localStorage.getItem("pn_zoom"));
    return z ? clamp(z) : 0;
  } catch {
    return 0;
  }
}

export function useCanvasZoom(scrollRef: RefObject<HTMLDivElement | null>) {
  const stored = useRef(readZoom());
  const [zoom, setZoomState] = useState(stored.current || 1);
  const rendered = useRef(zoom);
  const target = useRef(zoom);
  const anchor = useRef<Anchor | null>(null);

  const apply = (z: number, a: Anchor) => {
    anchor.current = a;
    target.current = clamp(z);
    setZoomState(target.current);
    try {
      localStorage.setItem("pn_zoom", String(target.current));
    } catch {
      /* fără localStorage */
    }
  };

  /** Zoom în jurul unui punct din fereastră (implicit centrul planului vizibil). */
  const zoomAt = (z: number, clientX?: number, clientY?: number) => {
    const s = scrollRef.current;
    if (!s) return;
    const r = s.getBoundingClientRect();
    const cx = clientX === undefined ? s.clientWidth / 2 : clientX - r.left;
    const cy = clientY === undefined ? s.clientHeight / 2 : clientY - r.top;
    // dacă un zoom anterior încă nu s-a desenat, păstrăm același punct de pe plan
    const a = anchor.current
      ? { ...anchor.current, cx, cy }
      : { bx: (s.scrollLeft + cx) / rendered.current, by: (s.scrollTop + cy) / rendered.current, cx, cy };
    apply(z, a);
  };

  /** Arată punctul (bx, by) de pe plan în centrul containerului, la zoomul dat. */
  const centerOn = (z: number, bx: number, by: number) => {
    const s = scrollRef.current;
    if (!s) return;
    apply(z, { bx, by, cx: s.clientWidth / 2, cy: s.clientHeight / 2 });
  };

  useLayoutEffect(() => {
    rendered.current = zoom;
    const s = scrollRef.current;
    const a = anchor.current;
    if (!s || !a) return;
    s.scrollLeft = a.bx * zoom - a.cx;
    s.scrollTop = a.by * zoom - a.cy;
    anchor.current = null;
  }, [zoom, scrollRef]);

  useEffect(() => {
    const s = scrollRef.current;
    if (!s) return;
    let pinch: { d0: number; z0: number; bx: number; by: number } | null = null;
    const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const mid = (t: TouchList) => ({ x: (t[0].clientX + t[1].clientX) / 2, y: (t[0].clientY + t[1].clientY) / 2 });

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      const r = s.getBoundingClientRect();
      const m = mid(e.touches);
      pinch = {
        d0: dist(e.touches),
        z0: target.current,
        bx: (s.scrollLeft + m.x - r.left) / rendered.current,
        by: (s.scrollTop + m.y - r.top) / rendered.current,
      };
    };
    const onMove = (e: TouchEvent) => {
      if (!pinch || e.touches.length !== 2) return;
      e.preventDefault();
      const r = s.getBoundingClientRect();
      const m = mid(e.touches);
      // punctul de sub degete urmează degetele (zoom + deplasare în același gest)
      apply(pinch.z0 * (dist(e.touches) / pinch.d0), { bx: pinch.bx, by: pinch.by, cx: m.x - r.left, cy: m.y - r.top });
    };
    const onEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) pinch = null;
    };
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      zoomAt(target.current * Math.exp(-e.deltaY * 0.0025), e.clientX, e.clientY);
    };

    s.addEventListener("touchstart", onStart, { passive: true });
    s.addEventListener("touchmove", onMove, { passive: false });
    s.addEventListener("touchend", onEnd);
    s.addEventListener("touchcancel", onEnd);
    s.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      s.removeEventListener("touchstart", onStart);
      s.removeEventListener("touchmove", onMove);
      s.removeEventListener("touchend", onEnd);
      s.removeEventListener("touchcancel", onEnd);
      s.removeEventListener("wheel", onWheel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollRef]);

  return {
    zoom,
    /** true dacă utilizatorul nu și-a ales încă un zoom (atunci încadrăm planul automat) */
    hasStoredZoom: stored.current > 0,
    zoomAt,
    centerOn,
    step: (dir: 1 | -1) => zoomAt(target.current * (dir > 0 ? 1.2 : 1 / 1.2)),
  };
}

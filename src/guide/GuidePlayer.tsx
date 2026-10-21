import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from "lucide-react";
import { Modal, Spinner, cx } from "../components/ui";
import type { Route } from "../state/route";
import type { GuideCommand, GuideMessage } from "./driver";
import { SCRIPTS } from "./scripts";

// Player-ul ghidurilor: aplicația reală, într-un iframe de mărimea unui telefon (micșorat
// ca să încapă), rulează scenariul paginii pe date demo. Aici afișăm textul pasului,
// progresul și capitolele; clicul pe ecran pune pauză (nu ajunge în aplicație).

const FRAME_W = 390;
const FRAME_H = 760;

type State = "loading" | "playing" | "done" | "error";

export function GuidePlayer({ title, scenes, onClose }: { title: string; scenes: Route[]; onClose: () => void }) {
  const [idx, setIdx] = useState(0);
  const [nonce, setNonce] = useState(0);
  const [caption, setCaption] = useState<{ text: string; index: number; total: number } | null>(null);
  const [paused, setPaused] = useState(false);
  const [state, setState] = useState<State>("loading");
  const [scale, setScale] = useState(0.7);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const nextTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const scene = scenes[idx];

  const start = (i: number) => {
    clearTimeout(nextTimer.current);
    setIdx(i);
    setNonce((n) => n + 1);
    setCaption(null);
    setState("loading");
    setPaused(false);
  };

  // telefonul se micșorează ca să încapă în fereastră (lățime și înălțime). Măsurăm cu
  // ResizeObserver: la montare fereastra (dialogul) încă nu e deschisă și lățimea e 0,
  // iar observer-ul ne anunță când devine vizibilă.
  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const fit = () => {
      const w = box.clientWidth;
      if (!w) return;
      const h = Math.min(window.innerHeight * 0.56, 640);
      setScale(Math.max(0.3, Math.min(1, (w - 8) / FRAME_W, h / FRAME_H)));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    window.addEventListener("resize", fit);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, []);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const d = e.data as GuideMessage;
      if (e.origin !== window.location.origin || e.source !== iframeRef.current?.contentWindow || d?.source !== "pn-guide") return;
      if (d.type === "caption") {
        setCaption({ text: d.text ?? "", index: d.index ?? 0, total: d.total ?? 1 });
        setState("playing");
      } else if (d.type === "done") {
        if (idx < scenes.length - 1) nextTimer.current = setTimeout(() => start(idx + 1), 1500);
        else setState("done");
      } else if (d.type === "error") {
        console.warn("Ghid:", d.text);
        setState("error");
      }
    };
    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
      clearTimeout(nextTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, scenes.length]);

  const togglePause = () => {
    if (state === "done" || state === "error") return start(state === "done" ? 0 : idx);
    const next = !paused;
    setPaused(next);
    iframeRef.current?.contentWindow?.postMessage({ source: "pn-guide-parent", cmd: next ? "pause" : "play" } satisfies GuideCommand, window.location.origin);
  };

  const progress = state === "done" ? 1 : caption ? caption.index / caption.total : 0;

  return (
    <Modal open onClose={onClose} title={title} wide>
      <div className="space-y-3">
        {scenes.length > 1 && (
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Capitole">
            {scenes.map((s, i) => (
              <button
                key={s}
                type="button"
                role="tab"
                aria-selected={i === idx}
                onClick={() => start(i)}
                className={cx(
                  "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                  i === idx ? "bg-primary text-primary-fg" : i < idx ? "bg-primary-soft text-primary-ink" : "bg-surface-2 text-muted hover:text-text",
                )}
              >
                {i + 1}. {SCRIPTS[s].title}
              </button>
            ))}
          </div>
        )}

        <div className="h-1.5 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-primary transition-[width] duration-700" style={{ width: `${progress * 100}%` }} />
        </div>

        <div ref={boxRef} className="flex justify-center">
          {/* rama telefonului */}
          <div className="rounded-[24px] bg-text/80 p-1 shadow-xl">
          {/* ecranul: iframe-ul micșorat cu transform e desenat separat de browser și nu e tăiat
              mereu de colțurile părintelui, așa că rotunjim și iframe-ul și punem o mască */}
          <div
            className="relative overflow-hidden rounded-[20px] bg-bg"
            style={{ width: FRAME_W * scale, height: FRAME_H * scale, transform: "translateZ(0)", WebkitMaskImage: "-webkit-radial-gradient(white, black)" }}
          >
            <iframe
              key={`${scene}-${nonce}`}
              ref={iframeRef}
              src={`/?guide=${scene}&v=${nonce}`}
              title={`Ghid: ${SCRIPTS[scene].title}`}
              tabIndex={-1}
              className="block origin-top-left border-0"
              style={{ width: FRAME_W, height: FRAME_H, transform: `scale(${scale})`, borderRadius: 20 / scale }}
            />
            {/* stratul de deasupra: clicul pune pauză și nu ajunge în aplicație */}
            <button type="button" className="absolute inset-0 cursor-pointer" onClick={togglePause} aria-label={paused ? "Pornește ghidul" : "Pune pauză"} />
            {state === "loading" && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-bg/80">
                <Spinner className="text-primary-ink" />
              </div>
            )}
            {paused && state === "playing" && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/25">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-fg shadow-lg">
                  <Play className="h-6 w-6" />
                </span>
              </div>
            )}
          </div>
          </div>
        </div>

        <p className="min-h-14 text-center text-base font-medium leading-snug" aria-live="polite">
          {state === "error"
            ? "Ghidul s-a oprit. Apasă „De la început” ca să-l reiei."
            : state === "done"
              ? scenes.length > 1
                ? "Asta e tot! Încearcă acum aplicația în modul demo sau conectează-te cu Google."
                : "Asta e tot. Închide ghidul și încearcă pe pagina ta."
              : (caption?.text ?? "Se pregătește ghidul…")}
        </p>

        <div className="flex items-center justify-center gap-2">
          <CtrlBtn label="Capitolul anterior" onClick={() => start(Math.max(0, idx - 1))} disabled={scenes.length < 2 || idx === 0}>
            <ChevronLeft className="h-5 w-5" />
          </CtrlBtn>
          <CtrlBtn label={paused || state === "done" ? "Pornește" : "Pauză"} onClick={togglePause} primary>
            {paused || state === "done" ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
          </CtrlBtn>
          <CtrlBtn label="Capitolul următor" onClick={() => start(idx + 1)} disabled={idx >= scenes.length - 1}>
            <ChevronRight className="h-5 w-5" />
          </CtrlBtn>
          <CtrlBtn label="De la început" onClick={() => start(scenes.length > 1 ? idx : 0)}>
            <RotateCcw className="h-4 w-4" />
          </CtrlBtn>
        </div>
        <p className="text-center text-xs text-muted">
          {scenes.length > 1 ? `Capitolul ${idx + 1} din ${scenes.length} · ` : ""}aplicația reală, pe date demo · apasă pe ecran ca să oprești
        </p>
      </div>
    </Modal>
  );
}

function CtrlBtn({ label, onClick, children, primary, disabled }: { label: string; onClick: () => void; children: React.ReactNode; primary?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cx(
        "flex h-10 w-10 items-center justify-center rounded-full transition-colors disabled:opacity-40",
        primary ? "bg-primary text-primary-fg hover:bg-primary-hover" : "border border-border bg-surface text-muted hover:text-text",
      )}
    >
      {children}
    </button>
  );
}

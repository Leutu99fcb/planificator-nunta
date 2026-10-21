import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from "lucide-react";
import { Modal, cx } from "../components/ui";
import type { GuideScene } from "./types";

// Player-ul ghidurilor: un „telefon” cu ecranul animat, un deget care apasă și textul
// pasului dedesubt. Bara de progres e chiar ceasul: când animația ei se termină, trecem
// la pasul următor, așa că pauza (animation-play-state) oprește totul fără timere.

const TAP_DELAY = 750;

export function GuidePlayer({ title, scenes, onClose }: { title: string; scenes: GuideScene[]; onClose: () => void }) {
  const [sceneIdx, setSceneIdx] = useState(0);
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);
  const [acted, setActed] = useState(false);
  const [cursor, setCursor] = useState<{ x: number; y: number; visible: boolean }>({ x: 50, y: 85, visible: false });
  const frameRef = useRef<HTMLDivElement>(null);

  const scene = scenes[sceneIdx];
  const current = scene.steps[step];
  const Screen = scene.Screen;

  // după atingere, ecranul reacționează
  useEffect(() => {
    if (!current.tap) {
      setActed(true);
      return;
    }
    setActed(false);
    if (paused) return;
    const t = setTimeout(() => setActed(true), TAP_DELAY);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneIdx, step, paused]);

  // degetul merge spre elementul țintă din ecran; după atingere îl urmărim încă o dată,
  // după ce se termină tranzițiile (ex: butonul de rotire se mută odată cu masa)
  useLayoutEffect(() => {
    const measure = () => {
      const frame = frameRef.current;
      if (!frame || !current.target) {
        setCursor((c) => ({ ...c, visible: false }));
        return;
      }
      const el = frame.querySelector<HTMLElement>(`[data-target="${current.target}"]`);
      if (!el) return;
      const f = frame.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      setCursor({ x: ((r.left + r.width / 2 - f.left) / f.width) * 100, y: ((r.top + r.height / 2 - f.top) / f.height) * 100, visible: true });
    };
    measure();
    if (!acted) return;
    const t = setTimeout(measure, 1050);
    return () => clearTimeout(t);
  }, [sceneIdx, step, acted, current.target]);

  const go = (s: number, st: number) => {
    setSceneIdx(s);
    setStep(st);
  };
  const next = () => {
    if (step < scene.steps.length - 1) go(sceneIdx, step + 1);
    else if (sceneIdx < scenes.length - 1) go(sceneIdx + 1, 0);
    else go(0, 0);
  };
  const prev = () => {
    if (step > 0) go(sceneIdx, step - 1);
    else if (sceneIdx > 0) go(sceneIdx - 1, scenes[sceneIdx - 1].steps.length - 1);
  };

  const total = scenes.reduce((s, sc) => s + sc.steps.reduce((a, b) => a + b.ms, 0), 0);

  return (
    <Modal open onClose={onClose} title={title}>
      <div className="space-y-3">
        {scenes.length > 1 && (
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Capitole">
            {scenes.map((s, i) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={i === sceneIdx}
                onClick={() => go(i, 0)}
                className={cx(
                  "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                  i === sceneIdx ? "bg-primary text-primary-fg" : "bg-surface-2 text-muted hover:text-text",
                )}
              >
                {i + 1}. {s.title}
              </button>
            ))}
          </div>
        )}

        {/* progres: un segment pe pas, ca la „stories” */}
        <div className="flex gap-1" aria-hidden>
          {scene.steps.map((s, i) => (
            <button key={i} type="button" className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2" onClick={() => go(sceneIdx, i)} tabIndex={-1}>
              {i < step ? (
                <span className="block h-full w-full bg-primary" />
              ) : i === step ? (
                <span
                  key={`${sceneIdx}-${step}`}
                  className="guide-progress block h-full bg-primary"
                  style={{ animationDuration: `${s.ms}ms`, animationPlayState: paused ? "paused" : "running" }}
                  onAnimationEnd={next}
                />
              ) : null}
            </button>
          ))}
        </div>

        <div className="flex justify-center">
          <div
            ref={frameRef}
            className="relative h-[min(440px,56vh)] w-[290px] max-w-full select-none overflow-hidden rounded-[28px] border-4 border-text/80 bg-bg shadow-xl"
            onClick={() => setPaused((p) => !p)}
            aria-hidden
          >
            <Screen step={step} acted={acted} />
            <span
              className={cx(
                "pointer-events-none absolute z-20 -ml-4 -mt-4 h-8 w-8 rounded-full border-2 border-white bg-text/35 shadow-lg transition-all duration-500 ease-out motion-reduce:transition-none",
                !cursor.visible && "opacity-0",
                current.tap && !acted && "scale-100",
                current.tap && acted && "scale-75",
              )}
              style={{ left: `${cursor.x}%`, top: `${cursor.y}%` }}
            />
            {current.tap && acted && cursor.visible && (
              <span
                key={`tap-${sceneIdx}-${step}`}
                className="guide-tap pointer-events-none absolute z-10 -ml-6 -mt-6 h-12 w-12 rounded-full bg-primary/40"
                style={{ left: `${cursor.x}%`, top: `${cursor.y}%` }}
              />
            )}
          </div>
        </div>

        <p className="min-h-12 text-center text-base font-medium" aria-live="polite">
          {current.caption}
        </p>

        <div className="flex items-center justify-center gap-2">
          <CtrlBtn label="Pasul anterior" onClick={prev}>
            <ChevronLeft className="h-5 w-5" />
          </CtrlBtn>
          <CtrlBtn label={paused ? "Pornește" : "Pauză"} onClick={() => setPaused((p) => !p)} primary>
            {paused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
          </CtrlBtn>
          <CtrlBtn label="Pasul următor" onClick={next}>
            <ChevronRight className="h-5 w-5" />
          </CtrlBtn>
          <CtrlBtn label="De la început" onClick={() => go(0, 0)}>
            <RotateCcw className="h-4 w-4" />
          </CtrlBtn>
        </div>
        <p className="text-center text-xs text-muted">
          {scenes.length > 1 ? `${scenes.length} pagini · ` : ""}cam {Math.round(total / 1000)} secunde · apasă pe ecran ca să oprești
        </p>
      </div>
    </Modal>
  );
}

function CtrlBtn({ label, onClick, children, primary }: { label: string; onClick: () => void; children: React.ReactNode; primary?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cx(
        "flex h-10 w-10 items-center justify-center rounded-full transition-colors",
        primary ? "bg-primary text-primary-fg hover:bg-primary-hover" : "border border-border bg-surface text-muted hover:text-text",
      )}
    >
      {children}
    </button>
  );
}

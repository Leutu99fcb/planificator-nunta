import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { Button, Modal, cx } from "./ui";

// Notificări scurte (toast) și dialog de confirmare, fără dialogurile native ale browserului.

interface Toast {
  id: number;
  kind: "ok" | "error";
  text: string;
}

interface FeedbackApi {
  toast: (text: string, kind?: Toast["kind"]) => void;
  confirm: (opts: { title: string; text: ReactNode; confirmLabel?: string; danger?: boolean }) => Promise<boolean>;
}

const Ctx = createContext<FeedbackApi | null>(null);

export function useFeedback(): FeedbackApi {
  const c = useContext(Ctx);
  if (!c) throw new Error("FeedbackProvider lipsă");
  return c;
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const [dialog, setDialog] = useState<(Parameters<FeedbackApi["confirm"]>[0] & { resolve: (v: boolean) => void }) | null>(null);

  const toast = useCallback<FeedbackApi["toast"]>((text, kind = "ok") => {
    const id = nextId.current++;
    setToasts((t) => [...t, { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "error" ? 7000 : 3000);
  }, []);

  const confirm = useCallback<FeedbackApi["confirm"]>(
    (opts) => new Promise<boolean>((resolve) => setDialog({ ...opts, resolve })),
    [],
  );

  const close = (v: boolean) => {
    dialog?.resolve(v);
    setDialog(null);
  };

  return (
    <Ctx.Provider value={{ toast, confirm }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 md:bottom-6" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cx(
              "pointer-events-auto flex max-w-md items-start gap-2 rounded-xl border px-4 py-2.5 text-sm shadow-lg",
              t.kind === "error" ? "border-danger/30 bg-danger-soft text-danger" : "border-border bg-surface text-text",
            )}
          >
            {t.kind === "error" ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />}
            <span>{t.text}</span>
          </div>
        ))}
      </div>
      <Modal
        open={!!dialog}
        onClose={() => close(false)}
        title={dialog?.title ?? ""}
        footer={
          <>
            <Button onClick={() => close(false)}>Renunță</Button>
            <Button variant={dialog?.danger ? "danger" : "primary"} onClick={() => close(true)}>
              {dialog?.confirmLabel ?? "Confirmă"}
            </Button>
          </>
        }
      >
        <div className="text-sm text-muted">{dialog?.text}</div>
      </Modal>
    </Ctx.Provider>
  );
}

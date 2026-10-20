import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { KeyRound } from "lucide-react";
import { isExpired, onAuthChange, signIn } from "../lib/google/auth";
import { useFeedback } from "./feedback";
import { Button } from "./ui";

/** Apare când tokenul Google a expirat; reconectarea are nevoie de un clic (pop-up). */
export function ReauthBanner() {
  const [expired, setExpired] = useState(isExpired);
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  const { toast } = useFeedback();

  useEffect(() => {
    const check = () => setExpired(isExpired());
    const off = onAuthChange(check);
    const timer = setInterval(check, 30_000);
    return () => {
      off();
      clearInterval(timer);
    };
  }, []);

  if (!expired) return null;

  const reconnect = async () => {
    setBusy(true);
    try {
      await signIn();
      await qc.invalidateQueries();
      toast("Reconectat");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Reconectarea a eșuat.", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sticky top-0 z-40 flex flex-wrap items-center justify-center gap-3 border-b border-warning/30 bg-warning-soft px-4 py-2 text-sm text-warning">
      <KeyRound className="h-4 w-4" />
      <span>Sesiunea Google a expirat (durează o oră). Modificările nu se mai salvează până te reconectezi.</span>
      <Button size="sm" variant="primary" onClick={reconnect} disabled={busy}>
        Reconectează
      </Button>
    </div>
  );
}

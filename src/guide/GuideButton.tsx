import { useState } from "react";
import { Clapperboard } from "lucide-react";
import type { Route } from "../state/route";
import { GuidePlayer } from "./GuidePlayer";
import { SCENES } from "./scenes";

// Butonul din header: deschide ghidul animat al paginii curente.
// Un punct mic arată paginile al căror ghid nu l-ai văzut încă (ținut minte în browser).

const SEEN_KEY = "pn_guide_seen";

function readSeen(): string[] {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

export function GuideButton({ route }: { route: Route }) {
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(readSeen);
  const scene = SCENES[route];
  const unseen = !seen.includes(route);

  const show = () => {
    setOpen(true);
    if (unseen) {
      const next = [...seen, route];
      setSeen(next);
      try {
        localStorage.setItem(SEEN_KEY, JSON.stringify(next));
      } catch {
        /* fără localStorage */
      }
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={show}
        className="relative flex items-center gap-1.5 rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-text"
        title={`Cum funcționează: ${scene.title}`}
        aria-label={`Vezi cum funcționează pagina ${scene.title}`}
      >
        <Clapperboard className="h-4 w-4" />
        <span className="hidden text-sm sm:inline">Cum funcționează</span>
        {unseen && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-primary" aria-hidden />}
      </button>
      {open && <GuidePlayer title={`Cum funcționează: ${scene.title}`} scenes={[scene]} onClose={() => setOpen(false)} />}
    </>
  );
}

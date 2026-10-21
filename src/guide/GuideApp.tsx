import { useEffect, useMemo, useRef } from "react";
import { DemoStore } from "../lib/demoStore";
import { PlannerProvider, usePlannerQuery } from "../state/planner";
import type { Route } from "../state/route";
import { Shell } from "../screens/Shell";
import { Spinner } from "../components/ui";
import { Guide } from "./driver";
import { SCRIPTS } from "./scripts";

/** Aplicația reală, în iframe-ul ghidului: date demo în memorie + scenariul paginii. */
export function GuideApp({ scene }: { scene: Route }) {
  const store = useMemo(() => new DemoStore(), []);
  const q = usePlannerQuery(store);
  const started = useRef(false);

  useEffect(() => {
    if (!q.data || started.current) return;
    // lăsăm pagina să se deseneze înainte de primul pas; „started” se pune abia la pornire,
    // ca dublul mount din StrictMode să nu anuleze scenariul
    const t = setTimeout(() => {
      if (started.current) return;
      started.current = true;
      const script = SCRIPTS[scene];
      const g = new Guide(script.steps);
      script.run(g).then(() => g.done(), (err) => g.fail(err));
    }, 500);
    return () => clearTimeout(t);
  }, [q.data, scene]);

  if (!q.data) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted">
        <Spinner />
      </div>
    );
  }
  return (
    <PlannerProvider store={store} data={q.data} fetching={q.isFetching}>
      <Shell onLeave={() => undefined} />
    </PlannerProvider>
  );
}

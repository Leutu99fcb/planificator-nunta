import { createContext, useContext, useMemo, useRef, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useFeedback } from "../components/feedback";
import { ReauthNeeded } from "../lib/google/auth";
import type { PlannerStore } from "../lib/store";
import type { EntityMap, PlannerData, Settings, TableKey } from "../lib/types";

// Starea planificatorului: datele vin din store (Sheet sau demo), modificările se aplică
// imediat pe ecran (optimist) și apoi se scriu; la eroare revenim la starea dinainte.
// După scriere reîncărcăm din Sheet, ca să vedem și ce a schimbat partenerul.

interface PlannerApi {
  store: PlannerStore;
  data: PlannerData;
  fetching: boolean;
  refresh: () => void;
  add: <K extends TableKey>(table: K, rows: EntityMap[K][], msg?: string) => Promise<boolean>;
  update: <K extends TableKey>(table: K, rows: EntityMap[K][], msg?: string) => Promise<boolean>;
  remove: <K extends TableKey>(table: K, ids: string[], msg?: string) => Promise<boolean>;
  saveSettings: (patch: Partial<Settings>, msg?: string) => Promise<boolean>;
}

const Ctx = createContext<PlannerApi | null>(null);

export function usePlanner(): PlannerApi {
  const c = useContext(Ctx);
  if (!c) throw new Error("PlannerProvider lipsă");
  return c;
}

export function usePlannerQuery(store: PlannerStore) {
  return useQuery({
    queryKey: ["planner", store.kind, store.id],
    queryFn: () => store.load(),
    refetchInterval: store.kind === "google" ? 60_000 : false,
    refetchOnWindowFocus: store.kind === "google",
    retry: (count, err) => !(err instanceof ReauthNeeded) && count < 2,
  });
}

export function PlannerProvider({ store, data, fetching, children }: { store: PlannerStore; data: PlannerData; fetching: boolean; children: ReactNode }) {
  const qc = useQueryClient();
  const { toast } = useFeedback();
  const key = useMemo(() => ["planner", store.kind, store.id], [store]);
  const pending = useRef(0);
  const refetchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const run = async (change: (d: PlannerData) => PlannerData, action: () => Promise<void>, msg?: string) => {
    await qc.cancelQueries({ queryKey: key });
    const before = qc.getQueryData<PlannerData>(key);
    if (before) qc.setQueryData(key, change(structuredClone(before)));
    pending.current++;
    try {
      await action();
      if (msg) toast(msg);
      return true;
    } catch (err) {
      if (before) qc.setQueryData(key, before);
      toast(err instanceof Error ? err.message : "Salvarea a eșuat.", "error");
      return false;
    } finally {
      pending.current--;
      clearTimeout(refetchTimer.current);
      refetchTimer.current = setTimeout(() => {
        if (pending.current === 0) qc.invalidateQueries({ queryKey: key });
      }, 1200);
    }
  };

  const api: PlannerApi = {
    store,
    data,
    fetching,
    refresh: () => qc.invalidateQueries({ queryKey: key }),
    add: (table, rows, msg) =>
      run(
        (d) => ({ ...d, [table]: [...(d[table] as EntityMap[typeof table][]), ...rows] }),
        () => store.add(table, rows),
        msg,
      ),
    update: (table, rows, msg) =>
      run(
        (d) => {
          const byId = new Map(rows.map((r) => [r.id, r]));
          return { ...d, [table]: (d[table] as EntityMap[typeof table][]).map((r) => byId.get(r.id) ?? r) };
        },
        () => store.update(table, rows),
        msg,
      ),
    remove: (table, ids, msg) =>
      run(
        (d) => ({ ...d, [table]: (d[table] as { id: string }[]).filter((r) => !ids.includes(r.id)) }),
        () => store.remove(table, ids),
        msg,
      ),
    saveSettings: (patch, msg) =>
      run(
        (d) => ({ ...d, settings: { ...d.settings, ...patch } }),
        () => store.saveSettings(patch),
        msg,
      ),
  };

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

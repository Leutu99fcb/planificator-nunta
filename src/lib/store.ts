import type { EntityMap, PlannerData, Settings, TableKey } from "./types";

/**
 * Sursa de date a planificatorului. Două implementări:
 * - GoogleSheetStore: Sheet-ul din Drive-ul utilizatorului (modul real)
 * - DemoStore: localStorage, pentru a încerca aplicația fără cont
 */
export interface PlannerStore {
  kind: "google" | "demo";
  id: string;
  title: string;
  /** link către Sheet (doar pentru Google) */
  url?: string;
  load(): Promise<PlannerData>;
  add<K extends TableKey>(table: K, rows: EntityMap[K][]): Promise<void>;
  /** rescrie rândurile cu aceleași id-uri (ultima scriere câștigă) */
  update<K extends TableKey>(table: K, rows: EntityMap[K][]): Promise<void>;
  remove<K extends TableKey>(table: K, ids: string[]): Promise<void>;
  saveSettings(patch: Partial<Settings>): Promise<void>;
}

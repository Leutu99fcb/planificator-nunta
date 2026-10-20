import {
  SETTINGS_TAB, SETTING_FIELDS, TABLE_DEFS, TABLE_ORDER, colLetter, decodeRow, decodeSetting,
  encodeRow, encodeSetting, type TableDef,
} from "../schema";
import { newId } from "../ids";
import type { PlannerStore } from "../store";
import { DEFAULT_SETTINGS, type EntityMap, type PlannerData, type Settings, type TableKey } from "../types";
import { SHEETS, enc, gfetch } from "./api";
import { migrateColumns } from "./migrate";

// Citire: un singur batchGet pentru toate tab-urile.
// Scriere: rândul se caută după ID chiar înainte de scriere (coloana A), ca o ștergere
// făcută între timp de partener să nu ne facă să scriem peste alt rând.

interface SheetMeta {
  properties: { title: string };
  sheets: { properties: { sheetId: number; title: string; gridProperties: { rowCount: number } } }[];
}

type Values = unknown[][];

export class GoogleSheetStore implements PlannerStore {
  kind = "google" as const;
  url: string;

  private constructor(
    public id: string,
    public title: string,
    private sheets: Map<string, { sheetId: number; rowCount: number }>,
  ) {
    this.url = `https://docs.google.com/spreadsheets/d/${id}/edit`;
  }

  static async open(id: string): Promise<GoogleSheetStore> {
    const meta = await gfetch<SheetMeta>(
      `${SHEETS}/${id}?fields=${enc("properties.title,sheets.properties(sheetId,title,gridProperties.rowCount)")}`,
    );
    const sheets = new Map(
      meta.sheets.map((s) => [s.properties.title, { sheetId: s.properties.sheetId, rowCount: s.properties.gridProperties.rowCount }]),
    );
    const missing = [...TABLE_ORDER.map((k) => TABLE_DEFS[k].tab), SETTINGS_TAB].filter((t) => !sheets.has(t));
    if (missing.length) {
      throw new Error(`Fișierul ales nu pare un planificator de nuntă (lipsesc tab-urile: ${missing.join(", ")}).`);
    }
    if (await migrateColumns(id, new Map([...sheets].map(([title, s]) => [title, s.sheetId])))) {
      // inserarea de coloane nu schimbă numărul de rânduri, dar recitim ca să fim siguri
      return GoogleSheetStore.open(id);
    }
    return new GoogleSheetStore(id, meta.properties.title, sheets);
  }

  private lastCol(def: TableDef<TableKey>) {
    return colLetter(def.cols.length - 1);
  }

  async load(): Promise<PlannerData> {
    const defs = TABLE_ORDER.map((k) => TABLE_DEFS[k] as TableDef<TableKey>);
    const ranges = [...defs.map((d) => `${d.tab}!A2:${this.lastCol(d)}`), `${SETTINGS_TAB}!A2:B`];
    const qs = ranges.map((r) => `ranges=${enc(r)}`).join("&");
    const res = await gfetch<{ valueRanges: { values?: Values }[] }>(
      `${SHEETS}/${this.id}/values:batchGet?${qs}&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER`,
    );

    const data: Record<string, unknown> = {};
    const repairs: { range: string; values: Values }[] = [];
    defs.forEach((def, i) => {
      const rows = res.valueRanges[i]?.values ?? [];
      const out: unknown[] = [];
      rows.forEach((values, r) => {
        // Un rând contează doar dacă are conținut în afară de ID și de bife: o bifă goală
        // (ex: „Plătit”) are valoarea FALSE pe toate rândurile tab-ului, chiar și pe cele nefolosite.
        const hasContent = def.cols.some((c, k) => k > 0 && c.type !== "bool" && values[k] !== "" && values[k] !== null && values[k] !== undefined);
        if (!hasContent) return;
        // rând adăugat de mână în Sheet, fără ID: îi dăm unul și îl scriem înapoi
        if (!values[0]) {
          values[0] = newId();
          repairs.push({ range: `${def.tab}!A${r + 2}`, values: [[values[0]]] });
        }
        out.push(decodeRow(def, values));
      });
      data[def.key] = out;
    });

    const settings: Settings = { ...DEFAULT_SETTINGS };
    const sRows = res.valueRanges[defs.length]?.values ?? [];
    for (const [key, value] of sRows) {
      const field = SETTING_FIELDS.find((f) => f.key === key);
      if (field) (settings as unknown as Record<string, unknown>)[field.key] = decodeSetting(field, value);
    }

    if (repairs.length) {
      await gfetch(`${SHEETS}/${this.id}/values:batchUpdate`, {
        method: "POST",
        json: { valueInputOption: "RAW", data: repairs },
      });
    }

    return { settings, ...(data as Omit<PlannerData, "settings">) };
  }

  private async readIds(tab: string): Promise<string[]> {
    const res = await gfetch<{ values?: Values }>(`${SHEETS}/${this.id}/values/${enc(`${tab}!A:A`)}`);
    return (res.values ?? []).map((r) => String(r[0] ?? ""));
  }

  async add<K extends TableKey>(table: K, rows: EntityMap[K][]): Promise<void> {
    if (!rows.length) return;
    const def = TABLE_DEFS[table] as unknown as TableDef<K>;
    const ids = await this.readIds(def.tab);
    const start = Math.max(ids.length, 1) + 1; // rândul 1 e antetul
    const end = start + rows.length - 1;
    const sheet = this.sheets.get(def.tab)!;
    if (end > sheet.rowCount) {
      const extra = end - sheet.rowCount + 200;
      await gfetch(`${SHEETS}/${this.id}:batchUpdate`, {
        method: "POST",
        json: { requests: [{ appendDimension: { sheetId: sheet.sheetId, dimension: "ROWS", length: extra } }] },
      });
      sheet.rowCount += extra;
    }
    await gfetch(
      `${SHEETS}/${this.id}/values/${enc(`${def.tab}!A${start}:${colLetter(def.cols.length - 1)}${end}`)}?valueInputOption=RAW`,
      { method: "PUT", json: { values: rows.map((r) => encodeRow(def, r)) } },
    );
  }

  async update<K extends TableKey>(table: K, rows: EntityMap[K][]): Promise<void> {
    if (!rows.length) return;
    const def = TABLE_DEFS[table] as unknown as TableDef<K>;
    const ids = await this.readIds(def.tab);
    const last = colLetter(def.cols.length - 1);
    const data = rows.map((row) => {
      const index = ids.indexOf(row.id);
      if (index < 1) throw new Error("Rândul a fost șters între timp (poate de partener). Reîncarcă pagina.");
      const r = index + 1;
      return { range: `${def.tab}!A${r}:${last}${r}`, values: [encodeRow(def, row)] };
    });
    await gfetch(`${SHEETS}/${this.id}/values:batchUpdate`, {
      method: "POST",
      json: { valueInputOption: "RAW", data },
    });
  }

  async remove<K extends TableKey>(table: K, idsToRemove: string[]): Promise<void> {
    if (!idsToRemove.length) return;
    const def = TABLE_DEFS[table];
    const ids = await this.readIds(def.tab);
    const sheetId = this.sheets.get(def.tab)!.sheetId;
    const indexes = idsToRemove
      .map((id) => ids.indexOf(id))
      .filter((i) => i >= 1)
      .sort((a, b) => b - a); // de jos în sus, ca indicii să rămână valizi
    if (!indexes.length) return;
    await gfetch(`${SHEETS}/${this.id}:batchUpdate`, {
      method: "POST",
      json: {
        requests: indexes.map((i) => ({
          deleteDimension: { range: { sheetId, dimension: "ROWS", startIndex: i, endIndex: i + 1 } },
        })),
      },
    });
  }

  async saveSettings(patch: Partial<Settings>): Promise<void> {
    const keys = await this.readIds(SETTINGS_TAB);
    const data: { range: string; values: Values }[] = [];
    let next = keys.length + 1;
    for (const [key, value] of Object.entries(patch)) {
      const field = SETTING_FIELDS.find((f) => f.key === key);
      if (!field) continue;
      const index = keys.indexOf(key);
      if (index >= 1) {
        data.push({ range: `${SETTINGS_TAB}!B${index + 1}`, values: [[encodeSetting(field, value)]] });
      } else {
        data.push({ range: `${SETTINGS_TAB}!A${next}:C${next}`, values: [[key, encodeSetting(field, value), field.label]] });
        next++;
      }
    }
    if (!data.length) return;
    await gfetch(`${SHEETS}/${this.id}/values:batchUpdate`, {
      method: "POST",
      json: { valueInputOption: "RAW", data },
    });
  }
}

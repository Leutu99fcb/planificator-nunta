import { SUMMARY_ROWS, SUMMARY_TAB, TABLE_DEFS, TABLE_ORDER, colLetter, type TableDef } from "../schema";
import type { TableKey } from "../types";
import { SHEETS, enc, gfetch } from "./api";

// Migrare la deschidere: dacă aplicația a primit o coloană nouă (ex: „Rotire” la Mese),
// Sheet-urile create înainte o primesc automat. Coloana se inserează pe poziția ei, ca
// datele existente să se mute odată cu ea, apoi rescriem antetele și formulele calculate.
// Formulele din alte tab-uri (ex: Rezumat) își ajustează singure referințele la inserare.

export async function migrateColumns(id: string, sheetIds: Map<string, number>): Promise<boolean> {
  const defs = TABLE_ORDER.map((k) => TABLE_DEFS[k] as unknown as TableDef<TableKey>);
  const qs = defs.map((d) => `ranges=${enc(`${d.tab}!1:1`)}`).join("&");
  const res = await gfetch<{ valueRanges: { values?: unknown[][] }[] }>(`${SHEETS}/${id}/values:batchGet?${qs}`);

  const requests: unknown[] = [];
  const headers: { range: string; values: unknown[][] }[] = [];

  defs.forEach((def, i) => {
    const actual = (res.valueRanges[i]?.values?.[0] ?? []).map((v) => String(v ?? "").trim());
    const expected = def.cols.map((c) => c.header);
    if (expected.every((h, k) => actual[k] === h)) return;

    const sheetId = sheetIds.get(def.tab)!;
    const work = [...actual];
    expected.forEach((h, k) => {
      if (work[k] === h) return;
      if (work.includes(h)) {
        throw new Error(`În tab-ul „${def.tab}” coloanele au fost mutate de mână. Pune coloana „${h}” înapoi pe ${colLetter(k)} și reîncarcă.`);
      }
      requests.push({
        insertDimension: { range: { sheetId, dimension: "COLUMNS", startIndex: k, endIndex: k + 1 }, inheritFromBefore: k > 0 },
      });
      work.splice(k, 0, h);
    });
    headers.push({ range: `${def.tab}!A1`, values: [[...expected, ...def.computed.map((c) => c.formula)]] });
  });

  if (!headers.length) return false;
  if (requests.length) {
    await gfetch(`${SHEETS}/${id}:batchUpdate`, { method: "POST", json: { requests } });
  }
  headers.push({ range: `${SUMMARY_TAB}!A1`, values: SUMMARY_ROWS.map(([label, f]) => [label, f]) });
  await gfetch(`${SHEETS}/${id}/values:batchUpdate`, {
    method: "POST",
    json: { valueInputOption: "USER_ENTERED", data: headers },
  });
  return true;
}

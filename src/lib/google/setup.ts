import {
  APP_PROPERTY, SCHEMA_VERSION, SETTINGS_TAB, SETTING_FIELDS, SUMMARY_ROWS, SUMMARY_TAB,
  TABLE_DEFS, TABLE_ORDER, encodeSetting, type ColType,
} from "../schema";
import { DEFAULT_SETTINGS, type Settings } from "../types";
import { DRIVE, SHEETS, enc, gfetch } from "./api";

// Crearea Sheet-ului: un fișier nou în Drive-ul utilizatorului, marcat cu appProperties
// ca să-l putem regăsi la următorul login (scope-ul drive.file vede doar fișierele
// create de aplicație sau alese explicit de utilizator în Picker).

const SPREADSHEET_MIME = "application/vnd.google-apps.spreadsheet";
const ROWS = 1000;

export interface PlannerFile {
  id: string;
  name: string;
  modifiedTime?: string;
  ownedByMe?: boolean;
  owners?: { displayName?: string; emailAddress?: string }[];
}

export async function findPlanners(): Promise<PlannerFile[]> {
  const q = `appProperties has { key='${APP_PROPERTY}' and value='${SCHEMA_VERSION}' } and trashed = false`;
  const fields = "files(id,name,modifiedTime,ownedByMe,owners(displayName,emailAddress))";
  const res = await gfetch<{ files: PlannerFile[] }>(
    `${DRIVE}/files?q=${enc(q)}&fields=${enc(fields)}&orderBy=modifiedTime%20desc&pageSize=20`,
  );
  return res.files ?? [];
}

export function plannerName(s: Partial<Settings>): string {
  const names = [s.partener1, s.partener2].map((n) => n?.trim()).filter(Boolean);
  return names.length ? `Planificator nuntă – ${names.join(" & ")}` : "Planificator nuntă";
}

const rgb = (hex: string) => ({
  red: parseInt(hex.slice(1, 3), 16) / 255,
  green: parseInt(hex.slice(3, 5), 16) / 255,
  blue: parseInt(hex.slice(5, 7), 16) / 255,
});

const HEADER_BG = rgb("#f6eef0");
const COMPUTED_BG = rgb("#eef3f7");
const ID_TEXT = rgb("#9a9a9a");

function numberFormat(type: ColType | "money" | "int") {
  switch (type) {
    case "date":
      return { type: "DATE", pattern: "yyyy-mm-dd" };
    case "number":
    case "optNumber":
    case "money":
      return { type: "NUMBER", pattern: "#,##0.##" };
    case "int":
      return { type: "NUMBER", pattern: "0" };
    default:
      return { type: "TEXT", pattern: "@" };
  }
}

export async function createPlanner(initial: Partial<Settings>): Promise<string> {
  const settings: Settings = { ...DEFAULT_SETTINGS, ...initial };
  const name = plannerName(settings);

  const file = await gfetch<{ id: string }>(`${DRIVE}/files?fields=id`, {
    method: "POST",
    json: { name, mimeType: SPREADSHEET_MIME, appProperties: { [APP_PROPERTY]: SCHEMA_VERSION } },
  });
  const id = file.id;

  const meta = await gfetch<{ sheets: { properties: { sheetId: number } }[] }>(
    `${SHEETS}/${id}?fields=sheets.properties.sheetId`,
  );
  const summaryId = meta.sheets[0].properties.sheetId;

  const requests: unknown[] = [
    {
      updateSpreadsheetProperties: {
        // en_GB: formulele folosesc virgulă ca separator; formatele de număr/dată le setăm explicit
        properties: { locale: "en_GB", timeZone: "Europe/Bucharest" },
        fields: "locale,timeZone",
      },
    },
    {
      updateSheetProperties: {
        properties: { sheetId: summaryId, title: SUMMARY_TAB, tabColor: rgb("#444444") },
        fields: "title,tabColor",
      },
    },
  ];

  const ids: Record<string, number> = {};
  TABLE_ORDER.forEach((key, i) => {
    const def = TABLE_DEFS[key];
    const sheetId = 100 + i;
    ids[def.tab] = sheetId;
    const colCount = def.cols.length + def.computed.length;
    requests.push({
      addSheet: {
        properties: {
          sheetId,
          title: def.tab,
          tabColor: rgb(def.color),
          gridProperties: { rowCount: ROWS, columnCount: colCount, frozenRowCount: 1 },
        },
      },
    });
    requests.push(headerFormat(sheetId, 0, def.cols.length, HEADER_BG));
    if (def.computed.length) requests.push(headerFormat(sheetId, def.cols.length, colCount, COMPUTED_BG));

    def.cols.forEach((c, ci) => {
      requests.push(columnWidth(sheetId, ci, c.width ?? 120));
      requests.push(columnFormat(sheetId, ci, numberFormat(c.type), ci === 0 ? ID_TEXT : undefined));
      if (c.type === "enum") {
        requests.push(validation(sheetId, ci, {
          condition: { type: "ONE_OF_LIST", values: c.options!.map((v) => ({ userEnteredValue: v })) },
          showCustomUi: true,
          strict: false,
        }));
      }
      if (c.type === "bool") {
        requests.push(validation(sheetId, ci, { condition: { type: "BOOLEAN" } }));
      }
    });
    def.computed.forEach((c, k) => {
      const ci = def.cols.length + k;
      requests.push(columnWidth(sheetId, ci, c.width ?? 110));
      if (c.format) requests.push(columnFormat(sheetId, ci, numberFormat(c.format)));
    });
  });

  // Setări (cheie / valoare / descriere)
  const settingsId = 200;
  requests.push({
    addSheet: {
      properties: {
        sheetId: settingsId,
        title: SETTINGS_TAB,
        tabColor: rgb("#777777"),
        gridProperties: { rowCount: 50, columnCount: 3, frozenRowCount: 1 },
      },
    },
  });
  requests.push(headerFormat(settingsId, 0, 3, HEADER_BG));
  requests.push(columnWidth(settingsId, 0, 150), columnWidth(settingsId, 1, 220), columnWidth(settingsId, 2, 240));
  requests.push(columnFormat(settingsId, 0, numberFormat("text"), ID_TEXT));
  SETTING_FIELDS.forEach((f, i) => {
    const fmt = f.type === "date" ? numberFormat("date") : f.type === "number" ? numberFormat("money") : numberFormat("text");
    requests.push(cellFormat(settingsId, i + 1, 1, fmt));
  });

  // Rezumat
  requests.push(columnWidth(summaryId, 0, 260), columnWidth(summaryId, 1, 200));
  requests.push({
    repeatCell: {
      range: { sheetId: summaryId, startColumnIndex: 0, endColumnIndex: 1 },
      cell: { userEnteredFormat: { textFormat: { bold: true } } },
      fields: "userEnteredFormat.textFormat",
    },
  });
  SUMMARY_ROWS.forEach(([, , type], i) => {
    if (type !== "text") requests.push(cellFormat(summaryId, i, 1, numberFormat(type)));
  });

  await gfetch(`${SHEETS}/${id}:batchUpdate`, { method: "POST", json: { requests } });

  // Antete + formule (USER_ENTERED, ca formulele să fie interpretate)
  const formulaData = TABLE_ORDER.map((key) => {
    const def = TABLE_DEFS[key];
    return {
      range: `${def.tab}!A1`,
      values: [[...def.cols.map((c) => c.header), ...def.computed.map((c) => c.formula)]],
    };
  });
  formulaData.push({ range: `${SETTINGS_TAB}!A1`, values: [["Cheie", "Valoare", "Ce înseamnă"]] });
  formulaData.push({ range: `${SUMMARY_TAB}!A1`, values: SUMMARY_ROWS.map(([label, f]) => [label, f]) });
  await gfetch(`${SHEETS}/${id}/values:batchUpdate`, {
    method: "POST",
    json: { valueInputOption: "USER_ENTERED", data: formulaData },
  });

  // Valorile setărilor (RAW, ca textul introdus de utilizator să nu fie interpretat ca formulă)
  await gfetch(`${SHEETS}/${id}/values:batchUpdate`, {
    method: "POST",
    json: {
      valueInputOption: "RAW",
      data: [
        {
          range: `${SETTINGS_TAB}!A2`,
          values: SETTING_FIELDS.map((f) => [f.key, encodeSetting(f, settings[f.key]), f.label]),
        },
      ],
    },
  });

  return id;
}

function headerFormat(sheetId: number, from: number, to: number, bg: ReturnType<typeof rgb>) {
  return {
    repeatCell: {
      range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: from, endColumnIndex: to },
      cell: { userEnteredFormat: { textFormat: { bold: true }, backgroundColor: bg } },
      fields: "userEnteredFormat(textFormat,backgroundColor)",
    },
  };
}

function columnWidth(sheetId: number, col: number, px: number) {
  return {
    updateDimensionProperties: {
      range: { sheetId, dimension: "COLUMNS", startIndex: col, endIndex: col + 1 },
      properties: { pixelSize: px },
      fields: "pixelSize",
    },
  };
}

function columnFormat(sheetId: number, col: number, fmt: object, color?: ReturnType<typeof rgb>) {
  return {
    repeatCell: {
      range: { sheetId, startRowIndex: 1, startColumnIndex: col, endColumnIndex: col + 1 },
      cell: { userEnteredFormat: { numberFormat: fmt, ...(color ? { textFormat: { foregroundColor: color } } : {}) } },
      fields: color ? "userEnteredFormat(numberFormat,textFormat)" : "userEnteredFormat.numberFormat",
    },
  };
}

function cellFormat(sheetId: number, row: number, col: number, fmt: object) {
  return {
    repeatCell: {
      range: { sheetId, startRowIndex: row, endRowIndex: row + 1, startColumnIndex: col, endColumnIndex: col + 1 },
      cell: { userEnteredFormat: { numberFormat: fmt } },
      fields: "userEnteredFormat.numberFormat",
    },
  };
}

function validation(sheetId: number, col: number, rule: object) {
  return {
    setDataValidation: {
      range: { sheetId, startRowIndex: 1, endRowIndex: ROWS, startColumnIndex: col, endColumnIndex: col + 1 },
      rule,
    },
  };
}

// ---------- partajare ----------

export interface Access {
  id: string;
  emailAddress?: string;
  displayName?: string;
  role: string;
  type: string;
}

export async function listAccess(fileId: string): Promise<Access[]> {
  const res = await gfetch<{ permissions: Access[] }>(
    `${DRIVE}/files/${fileId}/permissions?fields=${enc("permissions(id,emailAddress,displayName,role,type)")}`,
  );
  return res.permissions ?? [];
}

export async function sharePlanner(fileId: string, email: string, inviter: string): Promise<void> {
  const message = `${inviter} te-a invitat să planificați nunta împreună. Deschide aplicația Planificator de nuntă, conectează-te cu acest cont Google și alege „Deschide planificator partajat”.`;
  await gfetch(
    `${DRIVE}/files/${fileId}/permissions?sendNotificationEmail=true&emailMessage=${enc(message)}`,
    { method: "POST", json: { type: "user", role: "writer", emailAddress: email.trim() } },
  );
}

export async function removeAccess(fileId: string, permissionId: string): Promise<void> {
  await gfetch(`${DRIVE}/files/${fileId}/permissions/${permissionId}`, { method: "DELETE" });
}

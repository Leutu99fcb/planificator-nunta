import { getAccessToken, markExpired, ReauthNeeded } from "./auth";

export const SHEETS = "https://sheets.googleapis.com/v4/spreadsheets";
export const DRIVE = "https://www.googleapis.com/drive/v3";

export class GoogleApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export async function gfetch<T = unknown>(url: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init;
  const headers = new Headers(rest.headers);
  headers.set("Authorization", `Bearer ${getAccessToken()}`);
  if (json !== undefined) headers.set("Content-Type", "application/json");
  const res = await fetch(url, { ...rest, headers, body: json !== undefined ? JSON.stringify(json) : rest.body });
  if (res.status === 401) {
    markExpired();
    throw new ReauthNeeded();
  }
  if (!res.ok) {
    let message = `Eroare Google (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error?.message) message = translate(res.status, body.error.message);
    } catch {
      /* corp gol */
    }
    throw new GoogleApiError(message, res.status);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

function translate(status: number, message: string): string {
  if (status === 403 && /insufficient|permission/i.test(message)) {
    return "Nu ai acces la acest planificator. Cere-i partenerului să ți-l partajeze ca Editor, apoi alege-l din Drive.";
  }
  if (status === 404) return "Planificatorul nu mai există sau nu mai ai acces la el.";
  if (status === 429) return "Prea multe cereri către Google într-un minut. Așteaptă puțin și încearcă din nou.";
  return message;
}

export const enc = encodeURIComponent;

import { GOOGLE_CLIENT_ID } from "../config";
import { loadScript } from "./scripts";

// Login cu Google Identity Services (token model): fără server, fără refresh token.
// Tokenul de acces ține ~1 oră; îl păstrăm în sessionStorage ca un refresh de pagină să
// nu ceară login din nou. Când expiră, UI-ul arată „Reconectează" (Google cere un clic
// al utilizatorului pentru fereastra de login, altfel browserul o blochează).

export const SCOPE_DRIVE_FILE = "https://www.googleapis.com/auth/drive.file";
const SCOPES = ["openid", "email", "profile", SCOPE_DRIVE_FILE].join(" ");

const TOKEN_KEY = "pn_token";
const USER_KEY = "pn_user";
const EXPIRY_MARGIN_MS = 60_000;

export interface GoogleUser {
  email: string;
  name: string;
  picture?: string;
}

interface StoredToken {
  accessToken: string;
  expiresAt: number;
}

export class ReauthNeeded extends Error {
  constructor() {
    super("Sesiunea Google a expirat. Apasă „Reconectează”.");
  }
}

export class MissingScope extends Error {
  constructor() {
    super("Fără acces la fișierele create de aplicație nu putem salva planificatorul. Încearcă din nou și bifează permisiunea pentru Google Drive.");
  }
}

let token: StoredToken | null = readJson<StoredToken>(sessionStorage, TOKEN_KEY);
let expired = false;
const listeners = new Set<() => void>();

export function onAuthChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
const emit = () => listeners.forEach((fn) => fn());

export function getStoredUser(): GoogleUser | null {
  return readJson<GoogleUser>(localStorage, USER_KEY);
}

export function hasValidToken(): boolean {
  return !!token && token.expiresAt - EXPIRY_MARGIN_MS > Date.now();
}

export function isExpired(): boolean {
  return expired || (!!token && !hasValidToken());
}

export function getAccessToken(): string {
  if (!token || !hasValidToken()) {
    markExpired();
    throw new ReauthNeeded();
  }
  return token.accessToken;
}

export function markExpired() {
  if (expired) return;
  expired = true;
  emit();
}

// ---------- GIS ----------

interface TokenResponse {
  access_token?: string;
  expires_in?: number | string;
  error?: string;
  error_description?: string;
}

interface TokenClient {
  requestAccessToken(overrides?: { prompt?: string; login_hint?: string }): void;
}

interface GisOAuth2 {
  initTokenClient(cfg: {
    client_id: string;
    scope: string;
    include_granted_scopes?: boolean;
    callback: (resp: TokenResponse) => void;
    error_callback?: (err: { type: string; message?: string }) => void;
  }): TokenClient;
  hasGrantedAllScopes(resp: TokenResponse, ...scopes: string[]): boolean;
  revoke(accessToken: string, done?: () => void): void;
}

declare global {
  interface Window {
    google?: { accounts: { oauth2: GisOAuth2 } };
  }
}

let client: TokenClient | null = null;
let pending: { resolve: (r: TokenResponse) => void; reject: (e: Error) => void } | null = null;

async function getClient(): Promise<TokenClient> {
  if (client) return client;
  if (!GOOGLE_CLIENT_ID) throw new Error("Aplicația nu are configurat VITE_GOOGLE_CLIENT_ID.");
  await loadScript("https://accounts.google.com/gsi/client");
  const oauth2 = window.google!.accounts.oauth2;
  client = oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: SCOPES,
    include_granted_scopes: true,
    callback: (resp) => {
      pending?.resolve(resp);
      pending = null;
    },
    error_callback: (err) => {
      const msg =
        err.type === "popup_closed"
          ? "Fereastra Google a fost închisă înainte de final."
          : err.type === "popup_failed_to_open"
            ? "Browserul a blocat fereastra Google. Permite pop-up-urile pentru acest site."
            : (err.message ?? "Login Google eșuat.");
      pending?.reject(new Error(msg));
      pending = null;
    },
  });
  return client;
}

/** Trebuie apelat dintr-un clic al utilizatorului (altfel pop-up-ul e blocat). */
export async function signIn(): Promise<GoogleUser> {
  const c = await getClient();
  const hint = getStoredUser()?.email;
  const resp = await new Promise<TokenResponse>((resolve, reject) => {
    pending = { resolve, reject };
    c.requestAccessToken({ prompt: "", login_hint: hint });
  });
  if (resp.error || !resp.access_token) {
    throw new Error(resp.error_description ?? resp.error ?? "Login Google eșuat.");
  }
  if (!window.google!.accounts.oauth2.hasGrantedAllScopes(resp, SCOPE_DRIVE_FILE)) {
    throw new MissingScope();
  }
  token = {
    accessToken: resp.access_token,
    expiresAt: Date.now() + Number(resp.expires_in ?? 3600) * 1000,
  };
  sessionStorage.setItem(TOKEN_KEY, JSON.stringify(token));

  const info = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${token.accessToken}` },
  }).then((r) => (r.ok ? r.json() : null));
  const user: GoogleUser = {
    email: info?.email ?? hint ?? "",
    name: info?.name ?? info?.email ?? "",
    picture: info?.picture,
  };
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  expired = false;
  emit();
  return user;
}

export function signOut() {
  const t = token?.accessToken;
  token = null;
  expired = false;
  sessionStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  if (t) window.google?.accounts.oauth2.revoke(t);
  emit();
}

function readJson<T>(storage: Storage, key: string): T | null {
  try {
    const raw = storage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

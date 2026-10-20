export const GOOGLE_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ?? "";
export const GOOGLE_API_KEY = (import.meta.env.VITE_GOOGLE_API_KEY as string | undefined) ?? "";
export const GOOGLE_APP_ID = (import.meta.env.VITE_GOOGLE_APP_ID as string | undefined) ?? "";

export const googleConfigured = Boolean(GOOGLE_CLIENT_ID);
export const pickerConfigured = Boolean(GOOGLE_CLIENT_ID && GOOGLE_API_KEY && GOOGLE_APP_ID);

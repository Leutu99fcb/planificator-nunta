import { GOOGLE_API_KEY, GOOGLE_APP_ID } from "../config";
import { getAccessToken } from "./auth";
import { loadScript } from "./scripts";

// Google Picker: partenerul alege o singură dată Sheet-ul primit. Cu scope-ul drive.file,
// alegerea din Picker (cu setAppId = numărul proiectului) este cea care dă aplicației
// acces la acel fișier.

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    gapi?: any;
  }
}

async function loadPicker(): Promise<any> {
  await loadScript("https://apis.google.com/js/api.js");
  await new Promise<void>((resolve, reject) =>
    window.gapi.load("picker", { callback: resolve, onerror: () => reject(new Error("Picker indisponibil")) }),
  );
  return (window as any).google.picker;
}

export async function pickSpreadsheet(): Promise<string | null> {
  if (!GOOGLE_API_KEY || !GOOGLE_APP_ID) {
    throw new Error("Alegerea din Drive nu e configurată (lipsește cheia API sau numărul proiectului).");
  }
  const token = getAccessToken();
  const picker = await loadPicker();
  return new Promise((resolve) => {
    const view = new picker.DocsView(picker.ViewId.SPREADSHEETS)
      .setMode(picker.DocsViewMode.LIST)
      .setOwnedByMe(false)
      .setQuery("Planificator nuntă");
    const built = new picker.PickerBuilder()
      .setTitle("Alege planificatorul primit de la partener")
      .setLocale("ro")
      .setAppId(GOOGLE_APP_ID)
      .setOAuthToken(token)
      .setDeveloperKey(GOOGLE_API_KEY)
      .addView(view)
      .addView(new picker.DocsView(picker.ViewId.SPREADSHEETS).setMode(picker.DocsViewMode.LIST))
      .setCallback((data: any) => {
        const action = data[picker.Response.ACTION];
        if (action === picker.Action.PICKED) resolve(data[picker.Response.DOCUMENTS][0][picker.Document.ID]);
        else if (action === picker.Action.CANCEL) resolve(null);
      })
      .build();
    built.setVisible(true);
  });
}

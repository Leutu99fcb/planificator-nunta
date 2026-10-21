// „Degetul” din ghiduri: rulează în iframe-ul cu aplicația reală, mută un cerc pe ecran,
// apasă butoanele adevărate și scrie în câmpuri. Comunică cu fereastra-părinte prin
// postMessage: trimite textul fiecărui pas și primește pauză / pornire.

export type Target = string | (() => Element | null | undefined);

export interface GuideMessage {
  source: "pn-guide";
  type: "caption" | "done" | "error";
  text?: string;
  index?: number;
  total?: number;
}

export interface GuideCommand {
  source: "pn-guide-parent";
  cmd: "pause" | "play";
}

const raw = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const norm = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

const CURSOR_CSS =
  "position:fixed;z-index:2147483647;width:30px;height:30px;margin:-15px 0 0 -15px;border-radius:9999px;" +
  "border:2px solid #fff;background:rgba(18,23,24,.38);box-shadow:0 4px 14px rgba(0,0,0,.35);pointer-events:none;" +
  "transition:left .5s cubic-bezier(.3,.7,.3,1),top .5s cubic-bezier(.3,.7,.3,1),transform .15s,opacity .3s;opacity:0;left:50%;top:70%";

export class Guide {
  private paused = false;
  private captionIndex = 0;
  private cursor = document.createElement("div");

  constructor(private total: number) {
    this.cursor.style.cssText = CURSOR_CSS;
    document.body.appendChild(this.cursor);
    window.addEventListener("message", (e) => {
      const d = e.data as GuideCommand;
      if (e.origin !== window.location.origin || d?.source !== "pn-guide-parent") return;
      this.paused = d.cmd === "pause";
    });
  }

  private post(msg: Omit<GuideMessage, "source">) {
    window.parent?.postMessage({ source: "pn-guide", ...msg } satisfies GuideMessage, window.location.origin);
  }

  /** Așteptare care se oprește cât timp e pauză. */
  async wait(ms: number) {
    let left = ms;
    while (left > 0) {
      while (this.paused) await raw(100);
      const t = Math.min(100, left);
      await raw(t);
      left -= t;
    }
  }

  /** Textul pasului, afișat sub ecran. */
  async say(text: string, readMs = 0) {
    this.captionIndex++;
    this.post({ type: "caption", text, index: this.captionIndex, total: this.total });
    await this.wait(250 + readMs);
  }

  done() {
    this.cursor.style.opacity = "0";
    this.post({ type: "done" });
  }

  fail(err: unknown) {
    this.post({ type: "error", text: err instanceof Error ? err.message : String(err) });
  }

  async find(target: Target, timeout = 4000): Promise<HTMLElement> {
    const start = Date.now();
    for (;;) {
      const el = typeof target === "string" ? document.querySelector(target) : target();
      if (el instanceof HTMLElement || el instanceof SVGElement) return el as HTMLElement;
      if (Date.now() - start > timeout) throw new Error(`Ghidul nu a găsit: ${typeof target === "string" ? target : "elementul"}`);
      await raw(100);
    }
  }

  /** Cercul trebuie să fie în „top layer” când e deschisă o fereastră (dialog), altfel e acoperit. */
  private host() {
    const dialogs = document.querySelectorAll("dialog[open]");
    return (dialogs[dialogs.length - 1] as HTMLElement | undefined) ?? document.body;
  }

  /** Derulează până la element și duce degetul pe el. */
  async point(target: Target, scroll = true) {
    const el = await this.find(target);
    // derulăm doar dacă elementul nu se vede (pe tot) în fereastră
    const v = el.getBoundingClientRect();
    const hidden = v.top < 56 || v.bottom > window.innerHeight - 64 || v.left < 0 || v.right > window.innerWidth;
    if (scroll && hidden) {
      el.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
      await this.wait(420);
    }
    const host = this.host();
    if (this.cursor.parentElement !== host) host.appendChild(this.cursor);
    const r = el.getBoundingClientRect();
    this.cursor.style.opacity = "1";
    this.cursor.style.left = `${r.left + r.width / 2}px`;
    this.cursor.style.top = `${r.top + r.height / 2}px`;
    await this.wait(560);
    return el;
  }

  private ripple(el: HTMLElement) {
    const r = el.getBoundingClientRect();
    const dot = document.createElement("div");
    dot.style.cssText =
      `position:fixed;z-index:2147483646;left:${r.left + r.width / 2}px;top:${r.top + r.height / 2}px;width:46px;height:46px;` +
      "margin:-23px 0 0 -23px;border-radius:9999px;background:rgba(255,104,0,.45);pointer-events:none;" +
      "transition:transform .5s ease-out,opacity .5s ease-out;transform:scale(.3)";
    this.host().appendChild(dot);
    requestAnimationFrame(() => {
      dot.style.transform = "scale(1.6)";
      dot.style.opacity = "0";
    });
    setTimeout(() => dot.remove(), 600);
  }

  /** Apasă elementul. `pointer` trimite pointerdown/pointerup (pentru elementele care se pot trage). */
  async tap(target: Target, opts: { pointer?: boolean; scroll?: boolean } = {}) {
    const el = await this.point(target, opts.scroll ?? true);
    this.cursor.style.transform = "scale(.8)";
    this.ripple(el);
    if (opts.pointer) {
      const r = el.getBoundingClientRect();
      const init = { bubbles: true, cancelable: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, button: 0, buttons: 1, pointerId: 1, isPrimary: true };
      el.dispatchEvent(new PointerEvent("pointerdown", init));
      window.dispatchEvent(new PointerEvent("pointerup", { ...init, buttons: 0 }));
    } else {
      el.click();
    }
    await this.wait(130);
    this.cursor.style.transform = "";
    await this.wait(300);
  }

  /** Scrie literă cu literă într-un câmp controlat de React. */
  async type(target: Target, text: string, perChar = 42) {
    const el = (await this.point(target)) as HTMLInputElement | HTMLTextAreaElement;
    el.focus({ preventScroll: true });
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")!.set!;
    let value = "";
    for (const ch of text) {
      value += ch;
      setter.call(el, value);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      await this.wait(perChar);
    }
    await this.wait(180);
  }

  /** Setează direct valoarea (date, select, numere). */
  async set(target: Target, value: string) {
    const el = (await this.point(target)) as HTMLInputElement | HTMLSelectElement;
    const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, value);
    el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
    await this.wait(300);
  }

  hide() {
    this.cursor.style.opacity = "0";
  }
}

// ---------- găsirea elementelor din aplicație ----------

const scope = (root?: ParentNode | null) => root ?? document;

/** Butonul al cărui text începe cu `text` (în fereastra deschisă, dacă `inDialog`). */
export const button = (text: string, inDialog = false): Target => () =>
  [...scope(inDialog ? openDialog() : null).querySelectorAll("button")].find((b) => norm(b.textContent).startsWith(text) && b.offsetParent !== null);

export const aria = (label: string): Target => `[aria-label="${label}"]`;

export const openDialog = () => {
  const all = document.querySelectorAll("dialog[open]");
  return (all[all.length - 1] as HTMLElement | undefined) ?? null;
};

/** Câmpul (input/select/textarea) de sub eticheta `label` dintr-un formular. */
export const field = (label: string): Target => () => {
  const root = openDialog() ?? document;
  const span = [...root.querySelectorAll("label > span")].find((s) => norm(s.textContent).startsWith(label));
  return span?.parentElement?.querySelector("input, select, textarea");
};

/** Cel mai „strâmt” element `selector` vizibil care conține textul (nu containerul lui). */
export const withText = (selector: string, text: string): Target => () =>
  [...document.querySelectorAll(selector)]
    .filter((e) => norm(e.textContent).includes(text) && (e as HTMLElement).offsetParent !== null)
    .sort((a, b) => norm(a.textContent).length - norm(b.textContent).length)[0];

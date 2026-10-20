const loaded = new Map<string, Promise<void>>();

export function loadScript(src: string): Promise<void> {
  let p = loaded.get(src);
  if (!p) {
    p = new Promise<void>((resolve, reject) => {
      const el = document.createElement("script");
      el.src = src;
      el.async = true;
      el.onload = () => resolve();
      el.onerror = () => {
        loaded.delete(src);
        reject(new Error("Nu am putut încărca scriptul Google. Verifică conexiunea la internet."));
      };
      document.head.appendChild(el);
    });
    loaded.set(src, p);
  }
  return p;
}

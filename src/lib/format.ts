const cache = new Map<string, Intl.NumberFormat>();

/** Sume întregi, ex: „12.500 lei”, „3.200 €”. */
export function money(value: number, currency: string = "RON"): string {
  const cur = currency.trim().toUpperCase() === "EUR" ? "EUR" : "RON";
  let f = cache.get(cur);
  if (!f) {
    f = new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 0 });
    cache.set(cur, f);
  }
  const n = f.format(Math.round(value || 0));
  return cur === "EUR" ? `${n} €` : `${n} lei`;
}

export function plural(n: number, one: string, many: string): string {
  // în română: 1 persoană, 2 persoane, 20 de persoane
  if (n === 1) return `1 ${one}`;
  const de = n % 100 >= 20 || (n % 100 === 0 && n > 0) ? "de " : "";
  return `${n} ${de}${many}`;
}

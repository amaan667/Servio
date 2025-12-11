export function toMoney(n: unknown): string {
  const v = typeof n === "number" ? n : Number(n);
  const safe = Number.isFinite(v) ? v : 0;
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(safe);
}

export function toInt(n: unknown): number | null {
  const v = Number(n);
  return Number.isFinite(v) ? v : null;
}

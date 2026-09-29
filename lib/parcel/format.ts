export function money(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export function pct(n: number, digits = 1): string {
  if (!Number.isFinite(n)) return n > 0 ? "∞" : "—";
  return `${n.toFixed(digits)}%`;
}

export function ratio(n: number): string {
  if (!Number.isFinite(n)) return "∞";
  return n.toFixed(2);
}

export function num(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

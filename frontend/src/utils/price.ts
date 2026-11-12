/** Catalog price units. Catering is typically per plate; everything else is per event. */
export type PriceUnit = "per_plate" | "per_event" | string | null | undefined;

export function priceUnitSuffix(unit?: PriceUnit): string {
  return unit === "per_plate" ? " / plate" : " / event";
}

export function formatInr(n: unknown): string {
  const v = Number(n);
  return Number.isFinite(v) ? v.toLocaleString("en-IN") : "0";
}

export function formatFromPrice(n: unknown, unit?: PriceUnit): string {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return "Price on request";
  return `from ₹${formatInr(v)}${priceUnitSuffix(unit)}`;
}

export function formatPrice(n: unknown, unit?: PriceUnit, opts?: { plus?: boolean }): string {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return "Price on request";
  return `₹${formatInr(v)}${opts?.plus ? "+" : ""}${priceUnitSuffix(unit)}`;
}

export function reviewCountLabel(n: unknown): string {
  const c = Number(n) || 0;
  return c === 1 ? "1 review" : `${c} reviews`;
}

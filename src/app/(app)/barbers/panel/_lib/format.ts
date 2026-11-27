import { BUSINESS_TIME_ZONE } from "@/lib/barbers/dates";
import { fmtColones } from "@/lib/barbers/currency";
import { monthRange } from "@/lib/barbers/panel";

/** "2026-11" → "noviembre de 2026" / "November 2026". */
export function monthLabel(month: string, locale: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 15)));
}

export function fmtPercent(n: number, locale: string, signed = false): string {
  const s = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(n);
  return `${signed && n > 0 ? "+" : ""}${s}%`;
}

export function fmtSignedColones(n: number): string {
  return n > 0 ? `+${fmtColones(n)}` : n < 0 ? `−${fmtColones(-n)}` : fmtColones(0);
}

/** Date and time in Costa Rica, e.g. "27/11/2026, 14:05". */
export function fmtDateTime(d: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: BUSINESS_TIME_ZONE,
  }).format(d);
}

/** Link to the list of sales behind a figure (CA 10). */
export function detailHref(range: { from: string; to: string }, locationId: string | null): string {
  return `/barbers/panel/detail?from=${range.from}&to=${range.to}&locationId=${locationId ?? "all"}`;
}

export function monthDetailHref(month: string, locationId: string | null, upTo?: string): string {
  const r = monthRange(month);
  return detailHref({ from: r.from, to: upTo && upTo < r.to ? upTo : r.to }, locationId);
}

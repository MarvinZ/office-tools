/**
 * Business-day helpers for the Barbers module.
 *
 * The shop runs on Costa Rica time (spec: America/Costa_Rica). Timestamps are
 * stored as real instants (UTC in Postgres), so "which day / which fortnight
 * did this happen in" must be answered in Costa Rica time — bucketing by UTC
 * day would move every service done after 6 pm into the next day, and on the
 * 15th into the next fortnight.
 *
 * Costa Rica has had no daylight-saving time since 1992, so a fixed −06:00
 * offset is exact for range boundaries; formatting uses the IANA zone.
 *
 * Calendar days travel through the app as plain `YYYY-MM-DD` strings and are
 * only turned into Date boundaries at the DB-query edge.
 */

export const BUSINESS_TIME_ZONE = "America/Costa_Rica";
const BUSINESS_UTC_OFFSET = "-06:00";

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isDateString(value: string | undefined | null): value is string {
  return !!value && DATE_ONLY_RE.test(value);
}

function assertDateString(dateStr: string): void {
  if (!DATE_ONLY_RE.test(dateStr)) throw new Error(`Expected a YYYY-MM-DD date, got: ${dateStr}`);
}

/** First instant of the given Costa Rica calendar day. */
export function startOfBusinessDay(dateStr: string): Date {
  assertDateString(dateStr);
  return new Date(`${dateStr}T00:00:00.000${BUSINESS_UTC_OFFSET}`);
}

/** Last instant (ms precision) of the given Costa Rica calendar day. */
export function endOfBusinessDay(dateStr: string): Date {
  assertDateString(dateStr);
  return new Date(`${dateStr}T23:59:59.999${BUSINESS_UTC_OFFSET}`);
}

const businessDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BUSINESS_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** The Costa Rica calendar day (YYYY-MM-DD) an instant falls on. */
export function businessDateOf(instant: Date | string): string {
  // en-CA formats as YYYY-MM-DD.
  return businessDateFormatter.format(typeof instant === "string" ? new Date(instant) : instant);
}

/** Today's Costa Rica calendar day, YYYY-MM-DD. */
export function todayBusinessDate(): string {
  return businessDateOf(new Date());
}

/** "2026-10-29" → "29/10/2026" (dd/mm/aaaa, per the spec's localization rules). */
export function fmtDay(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

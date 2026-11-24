/**
 * Commission rates with start dates (Brayan, Nov 2026: "option B").
 *
 * A barber's rate can change from a given date, for all their services (their
 * fixed rate) or for one service (a per-service override). Every change is
 * kept; the rate for a service is resolved as of the service's own date, so a
 * change that starts on the 10th leaves the 1st–9th at the old rate in the
 * same fortnight.
 *
 * Pure: callers load the changes and the "baseline" (the value stored before
 * any dated change existed) and ask for the rate on a date.
 */

export type RateChange = {
  /** null = the barber's fixed rate (all services); else one service. */
  serviceId: string | null;
  /** New rate from that date; null = no fixed rate / no override (fall back). */
  rate: number | null;
  effectiveFrom: string; // YYYY-MM-DD
  /** Rate in force just before this change — the history before the first change. */
  previousRate: number | null;
  createdAt: Date | string; // tie-breaker for two changes on the same date
};

/**
 * The value of one scope (fixed rate, or one service's override) on `date`.
 * `baseline` is the stored value when the scope has no dated changes at all.
 */
export function scopeRateOn(
  changes: RateChange[],
  serviceId: string | null,
  date: string,
  baseline: number | null
): number | null {
  const scoped = changes
    .filter((c) => c.serviceId === serviceId)
    .sort((a, b) =>
      a.effectiveFrom === b.effectiveFrom
        ? String(a.createdAt).localeCompare(String(b.createdAt))
        : a.effectiveFrom.localeCompare(b.effectiveFrom)
    );
  if (scoped.length === 0) return baseline;
  let value = scoped[0].previousRate;
  for (const c of scoped) {
    if (c.effectiveFrom > date) break;
    value = c.rate;
  }
  return value;
}

export type RateBaselines = {
  fixed: number | null; // barbers.fixed_commission_rate
  overrides: Map<string, number>; // barber_service_rates
};

/**
 * The commission rate of a barber's service on `date`: the service override
 * in force, else the barber's fixed rate in force, else `fallback` (the
 * service's default rate, or the % written in an imported closing).
 */
export function commissionRateOn(
  changes: RateChange[],
  baselines: RateBaselines,
  serviceId: string | null,
  date: string,
  fallback: number | null
): { rate: number | null; source: "override" | "barber" | "default" } {
  if (serviceId) {
    const override = scopeRateOn(changes, serviceId, date, baselines.overrides.get(serviceId) ?? null);
    if (override != null) return { rate: override, source: "override" };
  }
  const fixed = scopeRateOn(changes, null, date, baselines.fixed);
  if (fixed != null) return { rate: fixed, source: "barber" };
  return { rate: fallback, source: "default" };
}

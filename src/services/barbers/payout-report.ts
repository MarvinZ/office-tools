import { listActivities } from "./activities";
import type { ActivityListItem } from "./activities";

// ── UI-ready types ────────────────────────────────────────────────────────────

export type PayoutBarberSummary = {
  barberId: string;
  barberName: string;
  count: number;
  sumPrice: number;
  sumCommission: number;
};

export type PayoutReport = {
  lineItems: ActivityListItem[];
  barberSummaries: PayoutBarberSummary[];
  grandTotal: {
    count: number;
    sumPrice: number;
    sumCommission: number;
  };
};

/**
 * Dates are plain `YYYY-MM-DD` strings everywhere in the report flow (URL params,
 * props, display). They are only turned into `Date` objects here, at the DB-query
 * boundary, and always as explicit UTC boundaries — so no local/UTC round-trip
 * can shift the range.
 */
export type PayoutReportFilter = {
  barberId?: string | "all";
  dateFrom: string; // YYYY-MM-DD, inclusive
  dateTo: string;   // YYYY-MM-DD, inclusive
};

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Start of the given calendar day, in UTC. */
export function startOfDayUtc(dateStr: string): Date {
  if (!DATE_ONLY_RE.test(dateStr)) throw new Error(`Expected a YYYY-MM-DD date, got: ${dateStr}`);
  return new Date(`${dateStr}T00:00:00.000Z`);
}

/** End of the given calendar day, in UTC. */
export function endOfDayUtc(dateStr: string): Date {
  if (!DATE_ONLY_RE.test(dateStr)) throw new Error(`Expected a YYYY-MM-DD date, got: ${dateStr}`);
  return new Date(`${dateStr}T23:59:59.999Z`);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function getPayoutReport(
  tenantId: string,
  filter: PayoutReportFilter
): Promise<PayoutReport> {
  const lineItems = await listActivities(tenantId, {
    barberId: filter.barberId && filter.barberId !== "all" ? filter.barberId : undefined,
    dateFrom: startOfDayUtc(filter.dateFrom),
    dateTo: endOfDayUtc(filter.dateTo),
  });

  const summaryByBarber = new Map<string, PayoutBarberSummary>();
  for (const item of lineItems) {
    const existing = summaryByBarber.get(item.barberId);
    if (existing) {
      existing.count += 1;
      existing.sumPrice = round2(existing.sumPrice + item.priceCharged);
      existing.sumCommission = round2(existing.sumCommission + item.commissionAmount);
    } else {
      summaryByBarber.set(item.barberId, {
        barberId: item.barberId,
        barberName: item.barberName,
        count: 1,
        sumPrice: item.priceCharged,
        sumCommission: item.commissionAmount,
      });
    }
  }

  const barberSummaries = Array.from(summaryByBarber.values()).sort((a, b) => a.barberName.localeCompare(b.barberName));

  const grandTotal = barberSummaries.reduce(
    (acc, s) => ({
      count: acc.count + s.count,
      sumPrice: round2(acc.sumPrice + s.sumPrice),
      sumCommission: round2(acc.sumCommission + s.sumCommission),
    }),
    { count: 0, sumPrice: 0, sumCommission: 0 }
  );

  return { lineItems, barberSummaries, grandTotal };
}

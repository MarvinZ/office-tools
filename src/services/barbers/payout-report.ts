import { listActivities } from "./activities";
import type { ActivityListItem } from "./activities";
import { startOfBusinessDay, endOfBusinessDay } from "@/lib/barbers/dates";

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
 * boundary, as Costa Rica business-day boundaries (see lib/barbers/dates.ts).
 */
export type PayoutReportFilter = {
  barberId?: string | "all";
  dateFrom: string; // YYYY-MM-DD, inclusive
  dateTo: string;   // YYYY-MM-DD, inclusive
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function getPayoutReport(
  tenantId: string,
  filter: PayoutReportFilter
): Promise<PayoutReport> {
  const lineItems = await listActivities(tenantId, {
    barberId: filter.barberId && filter.barberId !== "all" ? filter.barberId : undefined,
    dateFrom: startOfBusinessDay(filter.dateFrom),
    dateTo: endOfBusinessDay(filter.dateTo),
  });

  const summaryByBarber = new Map<string, PayoutBarberSummary>();
  for (const item of lineItems) {
    // Voided services stay listed (for the record) but count for nothing.
    if (item.status === "voided") continue;
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

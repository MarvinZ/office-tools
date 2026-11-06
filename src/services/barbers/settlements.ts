import { and, eq, gte, lte } from "drizzle-orm";
import Decimal from "decimal.js";
import { db } from "@/db";
import { barberActivities, barbers, barberTips, barberVouchers, productSales } from "@/db/schema";
import { businessDateOf, endOfBusinessDay, startOfBusinessDay } from "@/lib/barbers/dates";
import {
  computeBarberSettlement,
  type BarberSettlement,
  type BarberSettlementInput,
  type Fortnight,
} from "@/lib/barbers/settlement";
import { getBarberSettings, type BarberSettings } from "./settings";

export type BarberSettlementRow = BarberSettlement & {
  barberId: string;
  barberName: string;
};

/** Numeric fields of a settlement that are meaningful to total across barbers. */
const SUMMABLE = [
  "grossCharged", "serviceIncome", "addition", "cardFee", "maintenance", "productCredit", "vales",
  "totalExpenses", "net", "iva", "ivaPaid", "invoice", "tips", "transfer", "shortfall",
] as const;
export type SettlementTotals = Record<(typeof SUMMABLE)[number], number> & { serviceCount: number };

export type FortnightSettlements = {
  fortnight: Fortnight;
  settings: BarberSettings;
  rows: BarberSettlementRow[];
  totals: SettlementTotals;
};

/**
 * Live (not stored) settlements for every barber over one fortnight.
 *
 * Loads the period's raw data in five tenant-scoped queries and hands it to the
 * pure engine in lib/barbers/settlement.ts — no payout math lives here.
 * Activities are bucketed by Costa Rica business day; vales, product sales and
 * tips are already plain calendar dates.
 *
 * A barber is listed if they're active or had anything in the period, so a
 * barber deactivated mid-fortnight still gets paid for the days they worked.
 */
export async function getFortnightSettlements(
  tenantId: string,
  fortnight: Fortnight
): Promise<FortnightSettlements> {
  const { from, to } = fortnight;

  const [settings, barberRows, activityRows, valeRows, saleRows, tipRows] = await Promise.all([
    getBarberSettings(tenantId),
    db.select().from(barbers).where(eq(barbers.tenantId, tenantId)).orderBy(barbers.firstName, barbers.lastName),
    db
      .select({
        barberId: barberActivities.barberId,
        priceCharged: barberActivities.priceCharged,
        commissionRate: barberActivities.commissionRate,
        paymentMethodFeeRate: barberActivities.paymentMethodFeeRate,
        performedAt: barberActivities.performedAt,
      })
      .from(barberActivities)
      .where(
        and(
          eq(barberActivities.tenantId, tenantId),
          gte(barberActivities.performedAt, startOfBusinessDay(from)),
          lte(barberActivities.performedAt, endOfBusinessDay(to))
        )
      ),
    db
      .select({ barberId: barberVouchers.barberId, amount: barberVouchers.amount })
      .from(barberVouchers)
      .where(and(eq(barberVouchers.tenantId, tenantId), gte(barberVouchers.issuedDate, from), lte(barberVouchers.issuedDate, to))),
    db
      .select({ barberId: productSales.barberId, amount: productSales.totalAmount })
      .from(productSales)
      .where(and(eq(productSales.tenantId, tenantId), gte(productSales.saleDate, from), lte(productSales.saleDate, to))),
    db
      .select({ barberId: barberTips.barberId, amount: barberTips.amount })
      .from(barberTips)
      .where(and(eq(barberTips.tenantId, tenantId), gte(barberTips.tipDate, from), lte(barberTips.tipDate, to))),
  ]);

  const inputs = new Map<string, Omit<BarberSettlementInput, "profile">>();
  const inputFor = (barberId: string) => {
    let input = inputs.get(barberId);
    if (!input) {
      input = { lines: [], vales: [], productCredit: [], tips: [] };
      inputs.set(barberId, input);
    }
    return input;
  };

  for (const a of activityRows) {
    inputFor(a.barberId).lines.push({
      date: businessDateOf(a.performedAt),
      priceCharged: a.priceCharged,
      commissionRate: a.commissionRate,
      paymentMethodFeeRate: a.paymentMethodFeeRate,
    });
  }
  for (const v of valeRows) inputFor(v.barberId).vales.push(v.amount);
  for (const s of saleRows) inputFor(s.barberId).productCredit.push(s.amount);
  for (const t of tipRows) inputFor(t.barberId).tips.push(t.amount);

  const rows: BarberSettlementRow[] = barberRows
    .filter((b) => b.status === "active" || inputs.has(b.id))
    .map((b) => ({
      barberId: b.id,
      barberName: `${b.firstName} ${b.lastName}`,
      ...computeBarberSettlement(
        {
          ...(inputs.get(b.id) ?? { lines: [], vales: [], productCredit: [], tips: [] }),
          profile: {
            appliesMaintenance: b.appliesMaintenance,
            ivaBaseRate: b.ivaBaseRate,
            ivaInformative: b.ivaInformative,
            fortnightlyAddition: b.fortnightlyAddition,
          },
        },
        settings
      ),
    }));

  return { fortnight, settings, rows, totals: sumRows(rows) };
}

function sumRows(rows: BarberSettlementRow[]): SettlementTotals {
  const totals = { serviceCount: rows.reduce((n, r) => n + r.serviceCount, 0) } as SettlementTotals;
  for (const key of SUMMABLE) {
    totals[key] = rows.reduce((acc, r) => acc.plus(r[key]), new Decimal(0)).toNumber();
  }
  return totals;
}

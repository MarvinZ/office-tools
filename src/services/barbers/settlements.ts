import { and, eq, gte, lte } from "drizzle-orm";
import Decimal from "decimal.js";
import { db } from "@/db";
import {
  barberActivities, barberFortnightClosings, barbers, barberTips, barberVouchers, productSales,
} from "@/db/schema";
import { businessDateOf, endOfBusinessDay, startOfBusinessDay, todayBusinessDate } from "@/lib/barbers/dates";
import {
  computeBarberSettlement,
  fortnightKey,
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

// ── Closing ("paying") a fortnight ───────────────────────────────────────────

export type FortnightClosingInfo = { closedAt: Date; closedBy: string };

export type SettlementView = {
  /** What to show and export: the frozen snapshot if closed, else live. */
  effective: FortnightSettlements;
  closing: FortnightClosingInfo | null;
  /**
   * Closed, but recomputing from today's data gives different amounts —
   * something in the period (or a rate/setting) was edited after closing.
   * The snapshot still wins; reopen + close again to take the changes.
   */
  changedSinceClose: boolean;
};

/** The figures that matter for payment, per barber, in a stable order. */
function paymentFingerprint(s: FortnightSettlements): string {
  return JSON.stringify(
    s.rows
      .map((r) => [r.barberId, r.net, r.iva, r.invoice, r.tips, r.transfer])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
  );
}

export async function getSettlementView(tenantId: string, fortnight: Fortnight): Promise<SettlementView> {
  const [live, [closing]] = await Promise.all([
    getFortnightSettlements(tenantId, fortnight),
    db
      .select()
      .from(barberFortnightClosings)
      .where(and(eq(barberFortnightClosings.tenantId, tenantId), eq(barberFortnightClosings.period, fortnightKey(fortnight))))
      .limit(1),
  ]);
  if (!closing) return { effective: live, closing: null, changedSinceClose: false };

  const snapshot = closing.snapshot as FortnightSettlements;
  return {
    effective: snapshot,
    closing: { closedAt: closing.closedAt, closedBy: closing.closedBy },
    changedSinceClose: paymentFingerprint(snapshot) !== paymentFingerprint(live),
  };
}

/**
 * Freeze the fortnight's current live settlements. A fortnight that hasn't
 * started can't be closed; closing one that's still running is allowed (the
 * shop pays on the 15th / last day itself).
 */
export async function closeFortnight(tenantId: string, closedBy: string, fortnight: Fortnight): Promise<void> {
  if (fortnight.from > todayBusinessDate()) throw new Error("This fortnight hasn't started yet.");
  const snapshot = await getFortnightSettlements(tenantId, fortnight);
  const inserted = await db
    .insert(barberFortnightClosings)
    .values({ tenantId, period: fortnightKey(fortnight), snapshot, closedBy })
    .onConflictDoNothing()
    .returning({ period: barberFortnightClosings.period });
  if (inserted.length === 0) throw new Error("This fortnight is already closed.");
}

/** Discard the snapshot; the fortnight goes back to live figures. */
export async function reopenFortnight(tenantId: string, fortnight: Fortnight): Promise<void> {
  await db
    .delete(barberFortnightClosings)
    .where(and(eq(barberFortnightClosings.tenantId, tenantId), eq(barberFortnightClosings.period, fortnightKey(fortnight))));
}

// ── Documents (print / Excel) ────────────────────────────────────────────────

export type SettlementDocumentRow = BarberSettlementRow & { idNumber: string | null; iban: string | null };

/**
 * The settlement view plus each barber's current payment details. Payment
 * details are deliberately read live, not from the snapshot: the transfer
 * goes to wherever the barber's account is now.
 */
export async function getSettlementDocuments(
  tenantId: string,
  fortnight: Fortnight
): Promise<SettlementView & { documents: SettlementDocumentRow[] }> {
  const [view, details] = await Promise.all([
    getSettlementView(tenantId, fortnight),
    db.select({ id: barbers.id, idNumber: barbers.idNumber, iban: barbers.iban }).from(barbers).where(eq(barbers.tenantId, tenantId)),
  ]);
  const byId = new Map(details.map((d) => [d.id, d]));
  return {
    ...view,
    documents: view.effective.rows.map((r) => ({
      ...r,
      idNumber: byId.get(r.barberId)?.idNumber ?? null,
      iban: byId.get(r.barberId)?.iban ?? null,
    })),
  };
}

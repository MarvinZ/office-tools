import { and, desc, eq, gte, isNull, lte, max } from "drizzle-orm";
import Decimal from "decimal.js";
import { db } from "@/db";
import {
  barberActivities, barberFortnightClosings, barbers, barberTips, barberVouchers, productSales,
} from "@/db/schema";
import { businessDateOf, endOfBusinessDay, startOfBusinessDay, todayBusinessDate } from "@/lib/barbers/dates";
import {
  computeBarberSettlement,
  fortnightKey,
  shiftFortnight,
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
  "grossCharged", "serviceIncome", "addition", "cardFee", "maintenance", "productCredit", "vales", "carryOver",
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
 *
 * Carry-over: if the previous fortnight is closed, each barber's shortfall in
 * that closing is deducted here. An open previous fortnight carries nothing
 * yet, because its figures aren't final.
 */
export async function getFortnightSettlements(
  tenantId: string,
  fortnight: Fortnight
): Promise<FortnightSettlements> {
  const { from, to } = fortnight;

  const [settings, previousClosing, barberRows, activityRows, valeRows, saleRows, tipRows] = await Promise.all([
    getBarberSettings(tenantId),
    getCurrentClosing(tenantId, shiftFortnight(fortnight, -1)),
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
  if (previousClosing) {
    for (const r of readSnapshot(previousClosing.snapshot).rows) {
      if (r.shortfall > 0) inputFor(r.barberId).carryOver = r.shortfall;
    }
  }

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

export type FortnightClosingInfo = {
  version: number;
  closedAt: Date;
  closedBy: string;
  reopenedAt: Date | null;
};

export type ClosingVersion = FortnightClosingInfo & { totalTransfer: number };

export type SettlementView = {
  /** What to show and export: the chosen/current snapshot if closed, else live. */
  effective: FortnightSettlements;
  /** The closing being shown (current, or an older version when asked for). */
  closing: FortnightClosingInfo | null;
  /** Whether the fortnight currently has a closing (independent of what's shown). */
  isClosed: boolean;
  /**
   * Closed, but recomputing from today's data gives different amounts —
   * something in the period (or a rate/setting) was edited after closing.
   * The snapshot still wins; reopen + close again to take the changes.
   */
  changedSinceClose: boolean;
  /** Every closing ever made for this fortnight, newest first. */
  versions: ClosingVersion[];
};

/**
 * Snapshots are stored JSON; fields added to the engine later are missing
 * from older ones. Default them so every snapshot has today's shape.
 */
function readSnapshot(raw: unknown): FortnightSettlements {
  const s = raw as FortnightSettlements;
  return {
    ...s,
    rows: s.rows.map((r) => ({ ...r, carryOver: r.carryOver ?? 0 })),
    totals: { ...s.totals, carryOver: s.totals.carryOver ?? 0 },
  };
}

/** The fortnight's current (not reopened) closing row, if any. */
async function getCurrentClosing(tenantId: string, fortnight: Fortnight) {
  const [row] = await db
    .select()
    .from(barberFortnightClosings)
    .where(
      and(
        eq(barberFortnightClosings.tenantId, tenantId),
        eq(barberFortnightClosings.period, fortnightKey(fortnight)),
        isNull(barberFortnightClosings.reopenedAt)
      )
    )
    .limit(1);
  return row ?? null;
}

/** The figures that matter for payment, per barber, in a stable order. */
function paymentFingerprint(s: FortnightSettlements): string {
  return JSON.stringify(
    s.rows
      .map((r) => [r.barberId, r.net, r.iva, r.invoice, r.tips, r.transfer])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
  );
}

function closingInfo(row: typeof barberFortnightClosings.$inferSelect): FortnightClosingInfo {
  return { version: row.version, closedAt: row.closedAt, closedBy: row.closedBy, reopenedAt: row.reopenedAt };
}

/**
 * The settlements to show for a fortnight. With `version`, shows that
 * (possibly superseded) closing instead of the current state.
 */
export async function getSettlementView(
  tenantId: string,
  fortnight: Fortnight,
  version?: number
): Promise<SettlementView> {
  const [live, closingRows] = await Promise.all([
    getFortnightSettlements(tenantId, fortnight),
    db
      .select()
      .from(barberFortnightClosings)
      .where(and(eq(barberFortnightClosings.tenantId, tenantId), eq(barberFortnightClosings.period, fortnightKey(fortnight))))
      .orderBy(desc(barberFortnightClosings.version)),
  ]);

  const versions = closingRows.map((r) => ({
    ...closingInfo(r),
    totalTransfer: readSnapshot(r.snapshot).totals.transfer,
  }));
  const current = closingRows.find((r) => r.reopenedAt === null) ?? null;
  const shown = version !== undefined ? (closingRows.find((r) => r.version === version) ?? current) : current;

  if (!shown) return { effective: live, closing: null, isClosed: false, changedSinceClose: false, versions };

  const snapshot = readSnapshot(shown.snapshot);
  return {
    effective: snapshot,
    closing: closingInfo(shown),
    isClosed: current !== null,
    changedSinceClose: shown === current && paymentFingerprint(snapshot) !== paymentFingerprint(live),
    versions,
  };
}

/**
 * Freeze the fortnight's current live settlements as a new version. A
 * fortnight that hasn't started can't be closed; closing one that's still
 * running is allowed (the shop pays on the 15th / last day itself).
 */
export async function closeFortnight(tenantId: string, closedBy: string, fortnight: Fortnight): Promise<void> {
  if (fortnight.from > todayBusinessDate()) throw new Error("This fortnight hasn't started yet.");
  const period = fortnightKey(fortnight);
  const [snapshot, [{ maxVersion }]] = await Promise.all([
    getFortnightSettlements(tenantId, fortnight),
    db
      .select({ maxVersion: max(barberFortnightClosings.version) })
      .from(barberFortnightClosings)
      .where(and(eq(barberFortnightClosings.tenantId, tenantId), eq(barberFortnightClosings.period, period))),
  ]);
  // Both unique indexes make this safe against a double click or two admins
  // at once: the loser inserts nothing.
  const inserted = await db
    .insert(barberFortnightClosings)
    .values({ id: crypto.randomUUID(), tenantId, period, version: (maxVersion ?? 0) + 1, snapshot, closedBy })
    .onConflictDoNothing()
    .returning({ id: barberFortnightClosings.id });
  if (inserted.length === 0) throw new Error("This fortnight is already closed.");
}

/** Supersede the current closing; the fortnight goes back to live figures. */
export async function reopenFortnight(tenantId: string, reopenedBy: string, fortnight: Fortnight): Promise<void> {
  await db
    .update(barberFortnightClosings)
    .set({ reopenedAt: new Date(), reopenedBy })
    .where(
      and(
        eq(barberFortnightClosings.tenantId, tenantId),
        eq(barberFortnightClosings.period, fortnightKey(fortnight)),
        isNull(barberFortnightClosings.reopenedAt)
      )
    );
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
  fortnight: Fortnight,
  version?: number
): Promise<SettlementView & { documents: SettlementDocumentRow[] }> {
  const [view, details] = await Promise.all([
    getSettlementView(tenantId, fortnight, version),
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

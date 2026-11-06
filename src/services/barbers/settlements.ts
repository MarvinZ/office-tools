import { and, desc, eq, gte, isNull, lte, max, ne } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import Decimal from "decimal.js";
import { db } from "@/db";
import {
  barberActivities, barberCarryOvers, barberFortnightClosings, barbers, barberTips, barberVouchers, productSales,
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

/** The service a warranty redo points at (self-join of barber_activities). */
const originalActivity = alias(barberActivities, "original_activity");

export type BarberSettlementRow = BarberSettlement & {
  barberId: string;
  barberName: string;
};

/** Numeric fields of a settlement that are meaningful to total across barbers. */
const SUMMABLE = [
  "grossCharged", "serviceIncome", "addition", "cardFee", "maintenance", "productCredit", "vales", "carryOver", "warrantyClawback",
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
 * Voided services are skipped entirely (§8.10). Courtesy and warranty lines
 * are passed with their kind so the engine applies their rules (§8.7, §8.8);
 * when a colleague redid a service under warranty in this fortnight, the
 * original barber's commission on it is taken back here.
 *
 * Carry-over: only what an admin explicitly moved into this fortnight from a
 * closed previous one (barber_carry_overs, spec §8.1/§8.5).
 */
export async function getFortnightSettlements(
  tenantId: string,
  fortnight: Fortnight
): Promise<FortnightSettlements> {
  const { from, to } = fortnight;

  const inPeriod = and(
    eq(barberActivities.tenantId, tenantId),
    gte(barberActivities.performedAt, startOfBusinessDay(from)),
    lte(barberActivities.performedAt, endOfBusinessDay(to)),
    ne(barberActivities.status, "voided")
  );

  const [settings, carryOverRows, clawbackRows, barberRows, activityRows, valeRows, saleRows, tipRows] = await Promise.all([
    getBarberSettings(tenantId),
    db
      .select({ barberId: barberCarryOvers.barberId, amount: barberCarryOvers.amount })
      .from(barberCarryOvers)
      .where(and(eq(barberCarryOvers.tenantId, tenantId), eq(barberCarryOvers.toPeriod, fortnightKey(fortnight)))),
    // Warranty redos in this period done by someone other than the original
    // barber → the original barber's line, to take its commission back.
    db
      .select({
        barberId: originalActivity.barberId,
        priceCharged: originalActivity.priceCharged,
        commissionRate: originalActivity.commissionRate,
      })
      .from(barberActivities)
      .innerJoin(
        originalActivity,
        and(
          eq(originalActivity.id, barberActivities.warrantyOfActivityId),
          eq(originalActivity.tenantId, tenantId)
        )
      )
      .where(and(inPeriod, eq(barberActivities.status, "warranty"), ne(originalActivity.barberId, barberActivities.barberId))),
    db.select().from(barbers).where(eq(barbers.tenantId, tenantId)).orderBy(barbers.firstName, barbers.lastName),
    db
      .select({
        barberId: barberActivities.barberId,
        priceCharged: barberActivities.priceCharged,
        commissionRate: barberActivities.commissionRate,
        paymentMethodFeeRate: barberActivities.paymentMethodFeeRate,
        performedAt: barberActivities.performedAt,
        status: barberActivities.status,
      })
      .from(barberActivities)
      .where(inPeriod),
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
      kind: a.status === "courtesy" ? "courtesy" : a.status === "warranty" ? "warranty" : "service",
    });
  }
  for (const c of clawbackRows) {
    const input = inputFor(c.barberId);
    (input.warrantyClawbacks ??= []).push({ priceCharged: c.priceCharged, commissionRate: c.commissionRate });
  }
  for (const v of valeRows) inputFor(v.barberId).vales.push(v.amount);
  for (const s of saleRows) inputFor(s.barberId).productCredit.push(s.amount);
  for (const t of tipRows) inputFor(t.barberId).tips.push(t.amount);
  for (const c of carryOverRows) inputFor(c.barberId).carryOver = c.amount;

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
            shortfallToSalary: b.shortfallToSalary,
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
  reopenReason: string | null;
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
  /** barberId → amount an admin moved from this fortnight to the next one. */
  carriedOut: Record<string, number>;
  /** The next fortnight is closed, so carry-overs into it can't change. */
  nextClosed: boolean;
};

/**
 * Snapshots are stored JSON; fields added to the engine later are missing
 * from older ones. Default them so every snapshot has today's shape.
 */
function readSnapshot(raw: unknown): FortnightSettlements {
  const s = raw as FortnightSettlements;
  return {
    ...s,
    rows: s.rows.map((r) => ({
      ...r,
      carryOver: r.carryOver ?? 0,
      warrantyClawback: r.warrantyClawback ?? 0,
      shortfallToSalary: r.shortfallToSalary ?? false,
      byRate: r.byRate ?? [],
    })),
    totals: { ...s.totals, carryOver: s.totals.carryOver ?? 0, warrantyClawback: s.totals.warrantyClawback ?? 0 },
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
  return {
    version: row.version,
    closedAt: row.closedAt,
    closedBy: row.closedBy,
    reopenedAt: row.reopenedAt,
    reopenReason: row.reopenReason,
  };
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
  const [live, closingRows, carriedRows, nextClosing] = await Promise.all([
    getFortnightSettlements(tenantId, fortnight),
    db
      .select()
      .from(barberFortnightClosings)
      .where(and(eq(barberFortnightClosings.tenantId, tenantId), eq(barberFortnightClosings.period, fortnightKey(fortnight))))
      .orderBy(desc(barberFortnightClosings.version)),
    db
      .select({ barberId: barberCarryOvers.barberId, amount: barberCarryOvers.amount })
      .from(barberCarryOvers)
      .where(and(eq(barberCarryOvers.tenantId, tenantId), eq(barberCarryOvers.fromPeriod, fortnightKey(fortnight)))),
    getCurrentClosing(tenantId, shiftFortnight(fortnight, 1)),
  ]);

  const carriedOut = Object.fromEntries(carriedRows.map((c) => [c.barberId, Number(c.amount)]));
  const nextClosed = nextClosing !== null;
  const versions = closingRows.map((r) => ({
    ...closingInfo(r),
    totalTransfer: readSnapshot(r.snapshot).totals.transfer,
  }));
  const current = closingRows.find((r) => r.reopenedAt === null) ?? null;
  const shown = version !== undefined ? (closingRows.find((r) => r.version === version) ?? current) : current;

  if (!shown) {
    return { effective: live, closing: null, isClosed: false, changedSinceClose: false, versions, carriedOut, nextClosed };
  }

  const snapshot = readSnapshot(shown.snapshot);
  return {
    effective: snapshot,
    closing: closingInfo(shown),
    isClosed: current !== null,
    changedSinceClose: shown === current && paymentFingerprint(snapshot) !== paymentFingerprint(live),
    versions,
    carriedOut,
    nextClosed,
  };
}

/**
 * Freeze the fortnight's current live settlements as a new version. A
 * fortnight that hasn't started can't be closed; closing one that's still
 * running is allowed (the shop pays on the 15th / last day itself).
 */
export async function closeFortnight(
  tenantId: string,
  closedBy: string,
  fortnight: Fortnight
): Promise<{ version: number; totalTransfer: number }> {
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
  return { version: (maxVersion ?? 0) + 1, totalTransfer: snapshot.totals.transfer };
}

/** Supersede the current closing; the fortnight goes back to live figures. */
export async function reopenFortnight(
  tenantId: string,
  reopenedBy: string,
  fortnight: Fortnight,
  reason: string
): Promise<number | null> {
  const trimmed = reason.trim();
  if (!trimmed) throw new Error("A reason is required to reopen a fortnight.");
  const [row] = await db
    .update(barberFortnightClosings)
    .set({ reopenedAt: new Date(), reopenedBy, reopenReason: trimmed })
    .where(
      and(
        eq(barberFortnightClosings.tenantId, tenantId),
        eq(barberFortnightClosings.period, fortnightKey(fortnight)),
        isNull(barberFortnightClosings.reopenedAt)
      )
    )
    .returning({ version: barberFortnightClosings.version });
  return row?.version ?? null;
}

// ── Carry-over (spec §8.1, §8.5) ─────────────────────────────────────────────

/**
 * An admin moves (part of) a barber's shortfall in a closed fortnight to the
 * next one, where it's deducted as "previous balance". Not allowed for a
 * barber whose shortfall goes to salary deduction, or once the next fortnight
 * is closed. One carry-over per barber per fortnight; replace = delete + add.
 */
export async function createCarryOver(
  tenantId: string,
  createdBy: string,
  fortnight: Fortnight,
  barberId: string,
  amount: number
): Promise<void> {
  const current = await getCurrentClosing(tenantId, fortnight);
  if (!current) throw new Error("Close the fortnight before carrying a balance forward.");
  const row = readSnapshot(current.snapshot).rows.find((r) => r.barberId === barberId);
  if (!row || row.shortfall <= 0) throw new Error("This barber has no shortfall in this fortnight.");
  if (row.shortfallToSalary) throw new Error("This barber's shortfall goes to salary deduction.");
  if (!Number.isFinite(amount) || amount <= 0 || amount > row.shortfall) {
    throw new Error("Amount must be more than zero and no more than the shortfall.");
  }
  const next = shiftFortnight(fortnight, 1);
  if (await getCurrentClosing(tenantId, next)) throw new Error("The next fortnight is already closed.");

  const inserted = await db
    .insert(barberCarryOvers)
    .values({
      id: crypto.randomUUID(),
      tenantId,
      barberId,
      fromPeriod: fortnightKey(fortnight),
      toPeriod: fortnightKey(next),
      amount: String(amount),
      createdBy,
    })
    .onConflictDoNothing()
    .returning({ id: barberCarryOvers.id });
  if (inserted.length === 0) throw new Error("A balance was already carried forward for this barber.");
}

export async function deleteCarryOver(tenantId: string, fortnight: Fortnight, barberId: string): Promise<number | null> {
  if (await getCurrentClosing(tenantId, shiftFortnight(fortnight, 1))) {
    throw new Error("The next fortnight is already closed.");
  }
  const [row] = await db
    .delete(barberCarryOvers)
    .where(
      and(
        eq(barberCarryOvers.tenantId, tenantId),
        eq(barberCarryOvers.barberId, barberId),
        eq(barberCarryOvers.fromPeriod, fortnightKey(fortnight))
      )
    )
    .returning({ amount: barberCarryOvers.amount });
  return row ? Number(row.amount) : null;
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

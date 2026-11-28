import { and, desc, eq, gte, inArray, isNull, lte, max, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  barberActivities, barberCashOutflows, barberCashShifts, barberExpenses, barbers, barberVouchers, locations, paymentMethods, productCustomerSales,
} from "@/db/schema";
import { expenseFromOutflow } from "./expenses";
import { endOfBusinessDay, startOfBusinessDay, todayBusinessDate } from "@/lib/barbers/dates";
import { computeShiftClosing, registerState, type RegisterState, type ShiftClosing } from "@/lib/barbers/cash-register";
import { BarbersError } from "@/lib/barbers/errors";

/**
 * The in-app cash register (NOURA Módulo 1 §3/§13): open a shift, take cash
 * out, close it counting each payment method. Rules are in
 * lib/barbers/cash-register.ts. Sales are tied to a shift by stamping
 * cash_shift_id when they're recorded (see getActiveShiftId).
 */

export type ShiftRow = typeof barberCashShifts.$inferSelect;

async function getShiftRow(tenantId: string, shiftId: string): Promise<ShiftRow | null> {
  const [row] = await db
    .select()
    .from(barberCashShifts)
    .where(and(eq(barberCashShifts.tenantId, tenantId), eq(barberCashShifts.id, shiftId)))
    .limit(1);
  return row ?? null;
}

async function getOpenShift(tenantId: string, locationId: string): Promise<ShiftRow | null> {
  const [row] = await db
    .select()
    .from(barberCashShifts)
    .where(and(eq(barberCashShifts.tenantId, tenantId), eq(barberCashShifts.locationId, locationId), eq(barberCashShifts.status, "open")))
    .limit(1);
  return row ?? null;
}

/**
 * The shift a sale recorded now belongs to: the location's open shift, if it
 * was opened on the sale's business day. A shift left open from an earlier
 * day (closing pending) doesn't take today's sales.
 */
export async function getActiveShiftId(tenantId: string, locationId: string | null | undefined, saleDate: string): Promise<string | null> {
  if (!locationId) return null;
  const open = await getOpenShift(tenantId, locationId);
  return open && open.businessDate === saleDate ? open.id : null;
}

// ── State ────────────────────────────────────────────────────────────────────

export type OpenShiftInfo = {
  id: string;
  locationId: string;
  locationName: string;
  businessDate: string;
  shiftNumber: number;
  cashierName: string;
  openedAt: Date;
  state: Exclude<RegisterState, "closed">;
};

export type RegisterStatus = { state: RegisterState; shifts: OpenShiftInfo[] };

/**
 * One location's register, or all of them (locationId null): a pending
 * closing anywhere wins over open, open over closed.
 */
export async function getRegisterStatus(tenantId: string, locationId: string | null, today = todayBusinessDate()): Promise<RegisterStatus> {
  const conds = [eq(barberCashShifts.tenantId, tenantId), eq(barberCashShifts.status, "open")];
  if (locationId) conds.push(eq(barberCashShifts.locationId, locationId));
  const rows = await db
    .select({
      id: barberCashShifts.id,
      locationId: barberCashShifts.locationId,
      locationName: locations.name,
      businessDate: barberCashShifts.businessDate,
      shiftNumber: barberCashShifts.shiftNumber,
      cashierName: barberCashShifts.cashierName,
      openedAt: barberCashShifts.openedAt,
    })
    .from(barberCashShifts)
    .innerJoin(locations, eq(locations.id, barberCashShifts.locationId))
    .where(and(...conds))
    .orderBy(barberCashShifts.businessDate);
  const shifts = rows.map((r) => ({ ...r, state: registerState(r, today) as OpenShiftInfo["state"] }));
  const state: RegisterState = shifts.some((s) => s.state === "closingPending") ? "closingPending" : shifts.length ? "open" : "closed";
  return { state, shifts };
}

// ── Opening ──────────────────────────────────────────────────────────────────

export async function openShift(
  tenantId: string,
  user: { id: string; name: string },
  locationId: string,
  openingCash: number
): Promise<ShiftRow> {
  if (!Number.isFinite(openingCash) || openingCash < 0) throw new BarbersError("amountPositive");
  const [[location], open] = await Promise.all([
    db.select({ id: locations.id }).from(locations).where(and(eq(locations.tenantId, tenantId), eq(locations.id, locationId))).limit(1),
    getOpenShift(tenantId, locationId),
  ]);
  if (!location) throw new BarbersError("notFound");
  const today = todayBusinessDate();
  if (open) throw new BarbersError(open.businessDate < today ? "registerClosingPending" : "registerAlreadyOpen");

  const [{ last }] = await db
    .select({ last: max(barberCashShifts.shiftNumber) })
    .from(barberCashShifts)
    .where(and(eq(barberCashShifts.tenantId, tenantId), eq(barberCashShifts.locationId, locationId), eq(barberCashShifts.businessDate, today)));

  // The unique indexes make a double click (or two people at once) insert nothing.
  const [row] = await db
    .insert(barberCashShifts)
    .values({
      id: crypto.randomUUID(),
      tenantId,
      locationId,
      businessDate: today,
      shiftNumber: (last ?? 0) + 1,
      cashierUserId: user.id,
      cashierName: user.name,
      openingCash: String(openingCash),
    })
    .onConflictDoNothing()
    .returning();
  if (!row) throw new BarbersError("registerAlreadyOpen");
  return row;
}

// ── Outflows ─────────────────────────────────────────────────────────────────

async function requireOpenShift(tenantId: string, shiftId: string): Promise<ShiftRow> {
  const shift = await getShiftRow(tenantId, shiftId);
  if (!shift) throw new BarbersError("notFound");
  if (shift.status !== "open") throw new BarbersError("registerShiftClosed");
  return shift;
}

/**
 * Cash taken out of the drawer. Made out to a professional, it's also a vale;
 * otherwise it's a salon expense, recorded as a pending expense for an admin
 * to approve. Either way both rows are written together.
 */
export async function addOutflow(
  tenantId: string,
  userId: string,
  shiftId: string,
  input: { amount: number; concept: string; barberId?: string | null }
) {
  const shift = await requireOpenShift(tenantId, shiftId);
  if (!Number.isFinite(input.amount) || input.amount <= 0) throw new BarbersError("amountPositive");
  const concept = input.concept.trim();
  if (!concept) throw new BarbersError("invalidInput");
  if (input.barberId) {
    const [b] = await db.select({ id: barbers.id }).from(barbers).where(and(eq(barbers.tenantId, tenantId), eq(barbers.id, input.barberId))).limit(1);
    if (!b) throw new BarbersError("notFound");
  }
  const voucherId = input.barberId ? crypto.randomUUID() : null;
  const outflow = {
    id: crypto.randomUUID(),
    tenantId,
    shiftId,
    amount: String(input.amount),
    concept,
    barberId: input.barberId ?? null,
    voucherId,
    createdBy: userId,
  };
  if (voucherId && input.barberId) {
    await db.batch([
      db.insert(barberVouchers).values({
        id: voucherId,
        tenantId,
        barberId: input.barberId,
        amount: String(input.amount),
        issuedDate: shift.businessDate,
        note: concept,
        category: "vale",
        createdBy: userId,
      }),
      db.insert(barberCashOutflows).values(outflow),
    ]);
  } else {
    await db.batch([
      db.insert(barberCashOutflows).values(outflow),
      db.insert(barberExpenses).values(
        expenseFromOutflow({
          tenantId,
          outflowId: outflow.id,
          locationId: shift.locationId,
          date: shift.businessDate,
          concept,
          amount: input.amount,
          createdBy: userId,
        })
      ),
    ]);
  }
  return { ...outflow, shift };
}

/**
 * Only while the shift is open; removes its vale or expense too. `shiftId` must be the
 * outflow's own shift: callers check access against that shift's location.
 */
export async function deleteOutflow(tenantId: string, shiftId: string, outflowId: string) {
  const [row] = await db
    .select()
    .from(barberCashOutflows)
    .where(and(eq(barberCashOutflows.tenantId, tenantId), eq(barberCashOutflows.id, outflowId), eq(barberCashOutflows.shiftId, shiftId)))
    .limit(1);
  if (!row) throw new BarbersError("notFound");
  const shift = await requireOpenShift(tenantId, row.shiftId);
  // Children first (the expense points at the outflow), all in one batch.
  await db.batch([
    db.delete(barberExpenses).where(and(eq(barberExpenses.tenantId, tenantId), eq(barberExpenses.cashOutflowId, outflowId))),
    ...(row.voucherId
      ? [db.delete(barberVouchers).where(and(eq(barberVouchers.tenantId, tenantId), eq(barberVouchers.id, row.voucherId)))]
      : []),
    db.delete(barberCashOutflows).where(and(eq(barberCashOutflows.tenantId, tenantId), eq(barberCashOutflows.id, outflowId))),
  ]);
  return { ...row, shift };
}

// ── A shift, live or closed ──────────────────────────────────────────────────

export type ShiftOutflow = { id: string; amount: number; concept: string; barberName: string | null; createdAt: Date };

export type ShiftView = {
  shift: ShiftRow & { locationName: string };
  state: RegisterState | "done";
  outflows: ShiftOutflow[];
  /** Live expected figures (no counts) while open; the stored snapshot once closed. */
  closing: ShiftClosing;
  serviceCount: number;
  productCount: number;
};

/** Sales charged in a shift, per payment method, plus every method the shop uses. */
async function salesByMethod(tenantId: string, shiftId: string) {
  const [svc, prod, methods] = await Promise.all([
    db
      .select({ paymentMethodId: barberActivities.paymentMethodId, total: sql<string>`sum(${barberActivities.priceCharged})`, n: sql<string>`count(*)` })
      .from(barberActivities)
      .where(and(eq(barberActivities.tenantId, tenantId), eq(barberActivities.cashShiftId, shiftId), eq(barberActivities.status, "active")))
      .groupBy(barberActivities.paymentMethodId),
    db
      .select({ paymentMethodId: productCustomerSales.paymentMethodId, total: sql<string>`sum(${productCustomerSales.total})`, n: sql<string>`count(*)` })
      .from(productCustomerSales)
      .where(and(eq(productCustomerSales.tenantId, tenantId), eq(productCustomerSales.cashShiftId, shiftId)))
      .groupBy(productCustomerSales.paymentMethodId),
    db.select({ id: paymentMethods.id, name: paymentMethods.name, status: paymentMethods.status }).from(paymentMethods).where(eq(paymentMethods.tenantId, tenantId)).orderBy(paymentMethods.name),
  ]);
  const totals = new Map<string | null, number>();
  for (const r of [...svc, ...prod]) totals.set(r.paymentMethodId, (totals.get(r.paymentMethodId) ?? 0) + Number(r.total));
  const list = methods
    .filter((m) => m.status === "active" || totals.has(m.id))
    .map((m) => ({ paymentMethodId: m.id as string | null, name: m.name, sales: totals.get(m.id) ?? 0 }));
  if (totals.has(null)) list.push({ paymentMethodId: null, name: "—", sales: totals.get(null)! });
  return {
    methods: list,
    serviceCount: svc.reduce((n, r) => n + Number(r.n), 0),
    productCount: prod.reduce((n, r) => n + Number(r.n), 0),
  };
}

export async function getShiftView(tenantId: string, shiftId: string, today = todayBusinessDate()): Promise<ShiftView | null> {
  const [shift] = await db
    .select({ s: barberCashShifts, locationName: locations.name })
    .from(barberCashShifts)
    .innerJoin(locations, eq(locations.id, barberCashShifts.locationId))
    .where(and(eq(barberCashShifts.tenantId, tenantId), eq(barberCashShifts.id, shiftId)))
    .limit(1);
  if (!shift) return null;
  const [sales, outflowRows] = await Promise.all([
    salesByMethod(tenantId, shiftId),
    db
      .select({
        id: barberCashOutflows.id,
        amount: barberCashOutflows.amount,
        concept: barberCashOutflows.concept,
        firstName: barbers.firstName,
        lastName: barbers.lastName,
        createdAt: barberCashOutflows.createdAt,
      })
      .from(barberCashOutflows)
      .leftJoin(barbers, eq(barbers.id, barberCashOutflows.barberId))
      .where(and(eq(barberCashOutflows.tenantId, tenantId), eq(barberCashOutflows.shiftId, shiftId)))
      .orderBy(barberCashOutflows.createdAt),
  ]);
  const outflows = outflowRows.map((o) => ({
    id: o.id,
    amount: Number(o.amount),
    concept: o.concept,
    barberName: o.firstName ? `${o.firstName} ${o.lastName}` : null,
    createdAt: o.createdAt,
  }));
  const isOpen = shift.s.status === "open";
  return {
    shift: { ...shift.s, locationName: shift.locationName },
    state: isOpen ? registerState(shift.s, today) : "done",
    outflows,
    closing: isOpen || !shift.s.closing
      ? computeShiftClosing({ openingCash: shift.s.openingCash, methods: sales.methods, outflows: outflows.map((o) => o.amount) })
      : (shift.s.closing as ShiftClosing),
    serviceCount: sales.serviceCount,
    productCount: sales.productCount,
  };
}

// ── Closing ──────────────────────────────────────────────────────────────────

export async function closeShift(
  tenantId: string,
  userId: string,
  shiftId: string,
  counted: Record<string, number>,
  note?: string | null
): Promise<{ shift: ShiftRow; closing: ShiftClosing }> {
  const shift = await requireOpenShift(tenantId, shiftId);
  for (const v of Object.values(counted)) {
    if (!Number.isFinite(v) || v < 0) throw new BarbersError("amountPositive");
  }
  const [sales, outflows] = await Promise.all([
    salesByMethod(tenantId, shiftId),
    db
      .select({ amount: barberCashOutflows.amount })
      .from(barberCashOutflows)
      .where(and(eq(barberCashOutflows.tenantId, tenantId), eq(barberCashOutflows.shiftId, shiftId))),
  ]);
  const closing = computeShiftClosing({
    openingCash: shift.openingCash,
    methods: sales.methods,
    outflows: outflows.map((o) => o.amount),
    counted,
  });
  // Only an open shift is closed: a second click finds nothing to update.
  const [row] = await db
    .update(barberCashShifts)
    .set({
      status: "closed",
      closedAt: new Date(),
      closedBy: userId,
      closing,
      expectedTotal: String(closing.expectedTotal),
      countedTotal: String(closing.countedTotal),
      difference: String(closing.difference),
      note: note?.trim() || null,
    })
    .where(and(eq(barberCashShifts.tenantId, tenantId), eq(barberCashShifts.id, shiftId), eq(barberCashShifts.status, "open")))
    .returning();
  if (!row) throw new BarbersError("registerShiftClosed");
  return { shift: row, closing };
}

// ── Lists ────────────────────────────────────────────────────────────────────

export type ShiftListItem = {
  id: string;
  businessDate: string;
  shiftNumber: number;
  cashierName: string;
  status: string;
  expectedTotal: number | null;
  countedTotal: number | null;
  difference: number | null;
};

/** Shifts of a location over a date range, newest first. */
export async function listShifts(tenantId: string, locationId: string, from: string, to: string): Promise<ShiftListItem[]> {
  const rows = await db
    .select()
    .from(barberCashShifts)
    .where(
      and(
        eq(barberCashShifts.tenantId, tenantId),
        eq(barberCashShifts.locationId, locationId),
        gte(barberCashShifts.businessDate, from),
        lte(barberCashShifts.businessDate, to)
      )
    )
    .orderBy(desc(barberCashShifts.businessDate), desc(barberCashShifts.shiftNumber));
  return rows.map((r) => ({
    id: r.id,
    businessDate: r.businessDate,
    shiftNumber: r.shiftNumber,
    cashierName: r.cashierName,
    status: r.status,
    expectedTotal: r.expectedTotal == null ? null : Number(r.expectedTotal),
    countedTotal: r.countedTotal == null ? null : Number(r.countedTotal),
    difference: r.difference == null ? null : Number(r.difference),
  }));
}

/** Closed shifts with a difference, for the cashier shortfall report. */
export async function listShiftDifferences(tenantId: string, from: string, to: string) {
  const rows = await db
    .select()
    .from(barberCashShifts)
    .where(
      and(
        eq(barberCashShifts.tenantId, tenantId),
        eq(barberCashShifts.status, "closed"),
        gte(barberCashShifts.businessDate, from),
        lte(barberCashShifts.businessDate, to)
      )
    )
    .orderBy(barberCashShifts.businessDate, barberCashShifts.shiftNumber);
  return { closedCount: rows.length, rows: rows.filter((r) => Number(r.difference ?? 0) !== 0) };
}

/**
 * Today's sales at a location recorded while no shift was open (they belong
 * to no closing). Imported closings don't count: they come from the Excel.
 */
export async function getSalesOutsideShifts(tenantId: string, locationId: string, date: string): Promise<{ count: number; total: number }> {
  const [[s], [p]] = await Promise.all([
    db
      .select({ n: sql<string>`count(*)`, total: sql<string>`coalesce(sum(${barberActivities.priceCharged}), 0)` })
      .from(barberActivities)
      .where(
        and(
          eq(barberActivities.tenantId, tenantId),
          eq(barberActivities.locationId, locationId),
          eq(barberActivities.status, "active"),
          isNull(barberActivities.cashShiftId),
          isNull(barberActivities.closingFileId),
          gte(barberActivities.performedAt, startOfBusinessDay(date)),
          lte(barberActivities.performedAt, endOfBusinessDay(date))
        )
      ),
    db
      .select({ n: sql<string>`count(*)`, total: sql<string>`coalesce(sum(${productCustomerSales.total}), 0)` })
      .from(productCustomerSales)
      .where(
        and(
          eq(productCustomerSales.tenantId, tenantId),
          eq(productCustomerSales.locationId, locationId),
          isNull(productCustomerSales.cashShiftId),
          eq(productCustomerSales.saleDate, date)
        )
      ),
  ]);
  return { count: Number(s.n) + Number(p.n), total: Number(s.total) + Number(p.total) };
}

/** Pending closings (shifts left open from an earlier day), for the panel. */
export async function listPendingClosings(tenantId: string, locationIds: string[] | null, today = todayBusinessDate()) {
  const conds = [eq(barberCashShifts.tenantId, tenantId), eq(barberCashShifts.status, "open")];
  if (locationIds) {
    if (locationIds.length === 0) return [];
    conds.push(inArray(barberCashShifts.locationId, locationIds));
  }
  const rows = await db
    .select({ id: barberCashShifts.id, businessDate: barberCashShifts.businessDate, shiftNumber: barberCashShifts.shiftNumber, locationName: locations.name, locationId: barberCashShifts.locationId })
    .from(barberCashShifts)
    .innerJoin(locations, eq(locations.id, barberCashShifts.locationId))
    .where(and(...conds));
  return rows.filter((r) => r.businessDate < today);
}

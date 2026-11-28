import { and, desc, eq, gte, lte, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { barberExpenses, locations } from "@/db/schema";
import { validateExpense, type ExpenseInput, type ExpenseStatus } from "@/lib/barbers/expenses";
import { BarbersError } from "@/lib/barbers/errors";

/**
 * Operating expenses (NOURA Módulo 1 §6). Admins record (approved at once)
 * and review them; cash taken out of the register as a salon expense comes in
 * as pending (services/barbers/cash-register.ts). Only approved ones count.
 */

export type ExpenseRow = typeof barberExpenses.$inferSelect;
export type ExpenseListItem = ExpenseRow & { locationName: string | null };

export type ExpenseFilter = { from: string; to: string; locationId: string | null; status?: ExpenseStatus };

function where(tenantId: string, f: ExpenseFilter): SQL {
  const conds = [eq(barberExpenses.tenantId, tenantId), gte(barberExpenses.expenseDate, f.from), lte(barberExpenses.expenseDate, f.to)];
  // A location filter shows that location's expenses only; business-wide ones
  // (no location) appear under "all locations".
  if (f.locationId) conds.push(eq(barberExpenses.locationId, f.locationId));
  if (f.status) conds.push(eq(barberExpenses.status, f.status));
  return and(...conds)!;
}

export async function listExpenses(tenantId: string, f: ExpenseFilter): Promise<ExpenseListItem[]> {
  const rows = await db
    .select({ e: barberExpenses, locationName: locations.name })
    .from(barberExpenses)
    .leftJoin(locations, eq(locations.id, barberExpenses.locationId))
    .where(where(tenantId, f))
    .orderBy(desc(barberExpenses.expenseDate), desc(barberExpenses.createdAt));
  return rows.map((r) => ({ ...r.e, locationName: r.locationName }));
}

/** Approved expenses in a period (what the panel shows as "Gastos"). */
export async function getApprovedExpenseTotal(tenantId: string, f: Omit<ExpenseFilter, "status">): Promise<number> {
  const [row] = await db
    .select({ total: sql<string>`coalesce(sum(${barberExpenses.amount}), 0)` })
    .from(barberExpenses)
    .where(where(tenantId, { ...f, status: "approved" }));
  return Number(row.total);
}

export async function countPendingExpenses(tenantId: string): Promise<{ count: number; amount: number }> {
  const [row] = await db
    .select({ n: sql<string>`count(*)`, total: sql<string>`coalesce(sum(${barberExpenses.amount}), 0)` })
    .from(barberExpenses)
    .where(and(eq(barberExpenses.tenantId, tenantId), eq(barberExpenses.status, "pending")));
  return { count: Number(row.n), amount: Number(row.total) };
}

function check(input: ExpenseInput) {
  const problem = validateExpense(input);
  if (problem === "invalidDate" || problem === "amountPositive") throw new BarbersError(problem);
  if (problem) throw new BarbersError("invalidInput");
}

async function assertLocation(tenantId: string, locationId: string | null) {
  if (!locationId) return;
  const [l] = await db.select({ id: locations.id }).from(locations).where(and(eq(locations.tenantId, tenantId), eq(locations.id, locationId))).limit(1);
  if (!l) throw new BarbersError("notFound");
}

async function getExpense(tenantId: string, id: string): Promise<ExpenseRow> {
  const [row] = await db.select().from(barberExpenses).where(and(eq(barberExpenses.tenantId, tenantId), eq(barberExpenses.id, id))).limit(1);
  if (!row) throw new BarbersError("notFound");
  return row;
}

/** Recorded by an admin, so it's authorized at once. */
export async function createExpense(tenantId: string, userId: string, input: ExpenseInput): Promise<ExpenseRow> {
  check(input);
  await assertLocation(tenantId, input.locationId);
  const now = new Date();
  const [row] = await db
    .insert(barberExpenses)
    .values({
      id: crypto.randomUUID(),
      tenantId,
      locationId: input.locationId,
      expenseDate: input.expenseDate,
      category: input.category,
      description: input.description.trim(),
      amount: String(input.amount),
      paidWith: input.paidWith,
      status: "approved",
      reviewedBy: userId,
      reviewedAt: now,
      createdBy: userId,
    })
    .returning();
  return row;
}

/**
 * Edit an expense. One that came out of the register keeps its amount, date,
 * location and "cash": those are the register's (change them there while the
 * shift is open); its category and description can be fixed here.
 */
export async function updateExpense(tenantId: string, id: string, input: ExpenseInput): Promise<{ before: ExpenseRow; after: ExpenseRow }> {
  const before = await getExpense(tenantId, id);
  const fromRegister = before.cashOutflowId != null;
  const next: ExpenseInput = fromRegister
    ? { ...input, amount: Number(before.amount), expenseDate: before.expenseDate, locationId: before.locationId, paidWith: before.paidWith }
    : input;
  check(next);
  await assertLocation(tenantId, next.locationId);
  const [after] = await db
    .update(barberExpenses)
    .set({
      locationId: next.locationId,
      expenseDate: next.expenseDate,
      category: next.category,
      description: next.description.trim(),
      amount: String(next.amount),
      paidWith: next.paidWith,
      updatedAt: new Date(),
    })
    .where(and(eq(barberExpenses.tenantId, tenantId), eq(barberExpenses.id, id)))
    .returning();
  return { before, after };
}

/** Delete a mistaken expense. Register expenses are removed with their outflow, in the register. */
export async function deleteExpense(tenantId: string, id: string): Promise<ExpenseRow> {
  const row = await getExpense(tenantId, id);
  if (row.cashOutflowId) throw new BarbersError("expenseFromRegister");
  await db.delete(barberExpenses).where(and(eq(barberExpenses.tenantId, tenantId), eq(barberExpenses.id, id)));
  return row;
}

/** Approve, reject (reason required) or send back to pending. */
export async function reviewExpense(
  tenantId: string,
  userId: string,
  id: string,
  status: ExpenseStatus,
  reason?: string | null
): Promise<{ before: ExpenseRow; after: ExpenseRow }> {
  if (!["pending", "approved", "rejected"].includes(status)) throw new BarbersError("invalidInput");
  const trimmed = reason?.trim() || null;
  if (status === "rejected" && !trimmed) throw new BarbersError("rejectReasonRequired");
  const before = await getExpense(tenantId, id);
  const [after] = await db
    .update(barberExpenses)
    .set({
      status,
      reviewedBy: status === "pending" ? null : userId,
      reviewedAt: status === "pending" ? null : new Date(),
      rejectReason: status === "rejected" ? trimmed : null,
      updatedAt: new Date(),
    })
    .where(and(eq(barberExpenses.tenantId, tenantId), eq(barberExpenses.id, id)))
    .returning();
  return { before, after };
}

/** The pending expense a salon-expense outflow creates (written with it, in one batch). */
export function expenseFromOutflow(o: {
  tenantId: string;
  outflowId: string;
  locationId: string;
  date: string;
  concept: string;
  amount: number;
  createdBy: string;
}): typeof barberExpenses.$inferInsert {
  return {
    id: crypto.randomUUID(),
    tenantId: o.tenantId,
    locationId: o.locationId,
    expenseDate: o.date,
    category: "pettyCash",
    description: o.concept,
    amount: String(o.amount),
    paidWith: "cash",
    status: "pending",
    cashOutflowId: o.outflowId,
    createdBy: o.createdBy,
  };
}

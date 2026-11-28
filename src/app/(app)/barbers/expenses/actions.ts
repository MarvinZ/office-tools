"use server";

import { revalidatePath } from "next/cache";
import { requireBarbersAccess } from "@/services/barbers/roles";
import { createExpense, deleteExpense, reviewExpense, updateExpense } from "@/services/barbers/expenses";
import { auditBarbers, diffFields } from "@/services/barbers/audit";
import { barbersAction } from "@/services/barbers/action";
import type { ExpenseInput, ExpenseStatus } from "@/lib/barbers/expenses";

/** Recording, editing and approving expenses is for admins ("settle": it changes what was spent). */
async function requireAdmin() {
  return requireBarbersAccess(["settle"]);
}

function revalidateExpenses() {
  revalidatePath("/barbers/expenses");
  revalidatePath("/barbers/panel");
}

export async function createExpenseAction(input: ExpenseInput) {
  return barbersAction(async () => {
    const me = await requireAdmin();
    const row = await createExpense(me.tenant.id, me.userId, input);
    await auditBarbers(me.tenant.id, me.userId, "expense.created", {
      entityId: row.id,
      summary: { amount: Number(row.amount), description: row.description, date: row.expenseDate },
    });
    revalidateExpenses();
  });
}

export async function updateExpenseAction(id: string, input: ExpenseInput) {
  return barbersAction(async () => {
    const me = await requireAdmin();
    const { before, after } = await updateExpense(me.tenant.id, id, input);
    const changes = diffFields(before, after, ["expenseDate", "category", "description", "amount", "paidWith"]);
    if (Object.keys(changes).length > 0) {
      await auditBarbers(me.tenant.id, me.userId, "expense.updated", {
        entityId: id,
        summary: { amount: Number(after.amount), description: after.description, date: after.expenseDate },
        changes,
      });
    }
    revalidateExpenses();
  });
}

export async function deleteExpenseAction(id: string) {
  return barbersAction(async () => {
    const me = await requireAdmin();
    const row = await deleteExpense(me.tenant.id, id);
    await auditBarbers(me.tenant.id, me.userId, "expense.deleted", {
      entityId: id,
      summary: { amount: Number(row.amount), description: row.description, date: row.expenseDate },
    });
    revalidateExpenses();
  });
}

export async function reviewExpenseAction(id: string, status: ExpenseStatus, reason?: string) {
  return barbersAction(async () => {
    const me = await requireAdmin();
    const { before, after } = await reviewExpense(me.tenant.id, me.userId, id, status, reason);
    await auditBarbers(me.tenant.id, me.userId, "expense.reviewed", {
      entityId: id,
      summary: { amount: Number(after.amount), description: after.description, date: after.expenseDate },
      changes: { status: [before.status, after.status] },
      reason: after.rejectReason,
    });
    revalidateExpenses();
  });
}

import Decimal from "decimal.js";
import { isDateString } from "./dates";

/**
 * Operating expenses (NOURA Módulo 1 §6: "gastos operativos registrados y
 * autorizados"). Pure rules; services/barbers/expenses.ts does the I/O.
 * A fixed category list on purpose (small shop): "other" plus the
 * description covers anything unusual.
 */

export const EXPENSE_CATEGORIES = [
  "rent",
  "utilities",
  "supplies",
  "cleaning",
  "maintenance",
  "payroll",
  "marketing",
  "taxes",
  "pettyCash",
  "other",
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const PAID_WITH = ["cash", "transfer", "card", "other"] as const;
export type PaidWith = (typeof PAID_WITH)[number];

export type ExpenseStatus = "pending" | "approved" | "rejected";

export type ExpenseInput = {
  locationId: string | null;
  expenseDate: string;
  category: string;
  description: string;
  amount: number;
  paidWith: string;
};

export type ExpenseInputError = "invalidDate" | "invalidCategory" | "descriptionRequired" | "amountPositive" | "invalidPaidWith";

/** The first problem with an expense, or null when it can be saved. */
export function validateExpense(input: ExpenseInput): ExpenseInputError | null {
  if (!isDateString(input.expenseDate)) return "invalidDate";
  if (!(EXPENSE_CATEGORIES as readonly string[]).includes(input.category)) return "invalidCategory";
  if (!input.description.trim()) return "descriptionRequired";
  if (!Number.isFinite(input.amount) || input.amount <= 0) return "amountPositive";
  if (!(PAID_WITH as readonly string[]).includes(input.paidWith)) return "invalidPaidWith";
  return null;
}

export type ExpenseSummary = {
  approved: number;
  pending: number;
  rejected: number;
  pendingCount: number;
  /** Approved amounts per category, largest first. */
  byCategory: { category: string; amount: number }[];
};

const cents = (d: Decimal) => d.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();

/** Totals by status; only approved expenses count as spent. */
export function summarizeExpenses(rows: { amount: Decimal.Value; status: string; category: string }[]): ExpenseSummary {
  const by = { approved: new Decimal(0), pending: new Decimal(0), rejected: new Decimal(0) };
  const cats = new Map<string, Decimal>();
  let pendingCount = 0;
  for (const r of rows) {
    const status = r.status as ExpenseStatus;
    if (!(status in by)) continue;
    by[status] = by[status].plus(r.amount);
    if (status === "pending") pendingCount++;
    if (status === "approved") cats.set(r.category, (cats.get(r.category) ?? new Decimal(0)).plus(r.amount));
  }
  return {
    approved: cents(by.approved),
    pending: cents(by.pending),
    rejected: cents(by.rejected),
    pendingCount,
    byCategory: [...cats.entries()]
      .map(([category, amount]) => ({ category, amount: cents(amount) }))
      .sort((a, b) => b.amount - a.amount),
  };
}

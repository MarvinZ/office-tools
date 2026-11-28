import { describe, expect, it } from "vitest";
import { summarizeExpenses, validateExpense, type ExpenseInput } from "./expenses";

const ok: ExpenseInput = {
  locationId: null,
  expenseDate: "2026-11-27",
  category: "rent",
  description: "Alquiler noviembre",
  amount: 450_000,
  paidWith: "transfer",
};

describe("expense validation", () => {
  it("accepts a complete expense", () => {
    expect(validateExpense(ok)).toBeNull();
  });

  it("reports the first problem", () => {
    expect(validateExpense({ ...ok, expenseDate: "27/11/2026" })).toBe("invalidDate");
    expect(validateExpense({ ...ok, category: "fun" })).toBe("invalidCategory");
    expect(validateExpense({ ...ok, description: "  " })).toBe("descriptionRequired");
    expect(validateExpense({ ...ok, amount: 0 })).toBe("amountPositive");
    expect(validateExpense({ ...ok, amount: Number.NaN })).toBe("amountPositive");
    expect(validateExpense({ ...ok, paidWith: "bitcoin" })).toBe("invalidPaidWith");
  });
});

describe("expense summary", () => {
  it("only approved expenses count as spent", () => {
    const s = summarizeExpenses([
      { amount: 450_000, status: "approved", category: "rent" },
      { amount: 12_500.5, status: "approved", category: "cleaning" },
      { amount: 7_499.5, status: "approved", category: "cleaning" },
      { amount: 3_000, status: "pending", category: "pettyCash" },
      { amount: 2_000, status: "pending", category: "pettyCash" },
      { amount: 9_999, status: "rejected", category: "other" },
    ]);
    expect(s).toEqual({
      approved: 470_000,
      pending: 5_000,
      rejected: 9_999,
      pendingCount: 2,
      byCategory: [
        { category: "rent", amount: 450_000 },
        { category: "cleaning", amount: 20_000 },
      ],
    });
  });

  it("empty", () => {
    expect(summarizeExpenses([])).toEqual({ approved: 0, pending: 0, rejected: 0, pendingCount: 0, byCategory: [] });
  });
});

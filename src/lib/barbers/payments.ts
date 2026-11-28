import Decimal from "decimal.js";

/**
 * Split payments (NOURA Módulo 1 §5 "pagos divididos"): one ticket paid with
 * several methods. Pure and unit tested (payments.test.ts).
 *
 * The amounts must add up to the ticket's total exactly. Lines keep a single
 * method (the one paid the most, for lists and reports) and a blended fee
 * rate Σ(amount × fee) ÷ total, so the settlement's card fee
 * (price × rate) only falls on the part paid by card.
 */

export type SplitInput = { paymentMethodId: string; amount: Decimal.Value; feeRate: Decimal.Value }[];

export type SplitResult =
  | {
      ok: true;
      payments: { paymentMethodId: string; amount: string }[];
      primaryMethodId: string;
      blendedFeeRate: string; // up to 10 decimals, as stored
    }
  | { ok: false; error: "paymentsDontAddUp" | "amountPositive" };

export function splitPayment(total: Decimal.Value, input: SplitInput): SplitResult {
  const t = new Decimal(total);
  // The same method twice is one payment.
  const merged = new Map<string, { amount: Decimal; feeRate: Decimal }>();
  for (const p of input) {
    const amount = new Decimal(p.amount);
    if (!amount.isFinite() || amount.lte(0)) return { ok: false, error: "amountPositive" };
    const cur = merged.get(p.paymentMethodId);
    merged.set(p.paymentMethodId, { amount: (cur?.amount ?? new Decimal(0)).plus(amount), feeRate: new Decimal(p.feeRate) });
  }
  const sum = [...merged.values()].reduce((acc, p) => acc.plus(p.amount), new Decimal(0));
  if (!sum.toDecimalPlaces(2).equals(t.toDecimalPlaces(2))) return { ok: false, error: "paymentsDontAddUp" };

  let primary = "";
  let primaryAmount = new Decimal(-1);
  let weighted = new Decimal(0);
  for (const [id, p] of merged) {
    if (p.amount.gt(primaryAmount)) {
      primary = id;
      primaryAmount = p.amount;
    }
    weighted = weighted.plus(p.amount.times(p.feeRate));
  }
  const blended = t.isZero() ? (merged.get(primary)?.feeRate ?? new Decimal(0)) : weighted.div(t);
  return {
    ok: true,
    payments: [...merged.entries()].map(([paymentMethodId, p]) => ({ paymentMethodId, amount: p.amount.toFixed(2) })),
    primaryMethodId: primary,
    blendedFeeRate: blended.toDecimalPlaces(10, Decimal.ROUND_HALF_UP).toString(),
  };
}

/**
 * What a ticket's payments are still worth after some of its lines were
 * voided (or turned into courtesies): each payment scaled by
 * still-charged ÷ originally-paid. Used by the register's expected money.
 */
export function scaledPayments(
  payments: { paymentMethodId: string; amount: Decimal.Value }[],
  stillCharged: Decimal.Value
): { paymentMethodId: string; amount: Decimal }[] {
  const original = payments.reduce((acc, p) => acc.plus(p.amount), new Decimal(0));
  const factor = original.isZero() ? new Decimal(0) : Decimal.min(new Decimal(1), new Decimal(stillCharged).div(original));
  return payments.map((p) => ({ paymentMethodId: p.paymentMethodId, amount: new Decimal(p.amount).times(factor) }));
}

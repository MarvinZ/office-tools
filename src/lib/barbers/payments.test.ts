import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import { scaledPayments, splitPayment } from "./payments";
import { computeBarberSettlement } from "./settlement";

describe("split payments (§5)", () => {
  it("one method: the line keeps its own fee rate", () => {
    const r = splitPayment(15_000, [{ paymentMethodId: "card", amount: 15_000, feeRate: "0.065" }]);
    expect(r).toEqual({ ok: true, payments: [{ paymentMethodId: "card", amount: "15000.00" }], primaryMethodId: "card", blendedFeeRate: "0.065" });
  });

  it("cash + card: primary is the bigger one, fee only on the card part", () => {
    const r = splitPayment(15_000, [
      { paymentMethodId: "cash", amount: 10_000, feeRate: 0 },
      { paymentMethodId: "card", amount: 5_000, feeRate: "0.065" },
    ]);
    if (!r.ok) throw new Error(r.error);
    expect(r.primaryMethodId).toBe("cash");
    // 5,000 × 6.5% = 325 over 15,000 → the line pays exactly 325 of card fee.
    expect(new Decimal(15_000).times(r.blendedFeeRate).toDecimalPlaces(2).toNumber()).toBe(325);
  });

  it("the settlement's card fee only counts the card part (card fee on gross)", () => {
    const r = splitPayment(15_000, [
      { paymentMethodId: "cash", amount: 10_000, feeRate: 0 },
      { paymentMethodId: "card", amount: 5_000, feeRate: "0.065" },
    ]);
    if (!r.ok) throw new Error(r.error);
    const s = computeBarberSettlement(
      {
        profile: { appliesMaintenance: false, ivaBaseRate: 1, ivaInformative: false, fortnightlyAddition: 0 },
        lines: [
          { date: "2026-11-20", priceCharged: 10_000, commissionRate: 0.5, paymentMethodFeeRate: r.blendedFeeRate },
          { date: "2026-11-20", priceCharged: 5_000, commissionRate: 0.5, paymentMethodFeeRate: r.blendedFeeRate },
        ],
        vales: [],
        productCredit: [],
        tips: [],
      },
      { ivaRate: 0.13, maintenanceDailyFee: 1000, cardFeeOnGross: true }
    );
    expect(s.cardFee).toBe(325);
  });

  it("must add up to the total, to the céntimo", () => {
    expect(splitPayment(15_000, [{ paymentMethodId: "cash", amount: 14_999.99, feeRate: 0 }])).toEqual({ ok: false, error: "paymentsDontAddUp" });
    expect(splitPayment(15_000, [{ paymentMethodId: "cash", amount: 15_000, feeRate: 0 }, { paymentMethodId: "card", amount: 0, feeRate: 0.065 }])).toEqual({
      ok: false,
      error: "amountPositive",
    });
  });

  it("the same method twice is merged", () => {
    const r = splitPayment(3_000, [
      { paymentMethodId: "cash", amount: 1_000, feeRate: 0 },
      { paymentMethodId: "cash", amount: 2_000, feeRate: 0 },
    ]);
    expect(r.ok && r.payments).toEqual([{ paymentMethodId: "cash", amount: "3000.00" }]);
  });
});

describe("payments after a voided line", () => {
  it("scale down proportionally", () => {
    const s = scaledPayments(
      [
        { paymentMethodId: "cash", amount: 10_000 },
        { paymentMethodId: "card", amount: 5_000 },
      ],
      7_500
    );
    expect(s.map((p) => [p.paymentMethodId, p.amount.toNumber()])).toEqual([
      ["cash", 5_000],
      ["card", 2_500],
    ]);
  });

  it("nothing left → nothing expected; never more than was paid", () => {
    expect(scaledPayments([{ paymentMethodId: "cash", amount: 100 }], 0)[0].amount.toNumber()).toBe(0);
    expect(scaledPayments([{ paymentMethodId: "cash", amount: 100 }], 150)[0].amount.toNumber()).toBe(100);
  });
});

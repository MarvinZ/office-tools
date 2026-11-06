import { describe, expect, it } from "vitest";
import {
  computeBarberSettlement,
  fortnightKey,
  fortnightOf,
  fortnightRange,
  parseFortnightKey,
  shiftFortnight,
  lineCommission,
  type BarberSettlementInput,
  type BarberSettlementProfile,
  type SettlementLine,
} from "./settlement";

// Acceptance cases from the NOURA spec (§13, "CA xx"). NOURA's initial values.
const SETTINGS = { ivaRate: "0.13", maintenanceDailyFee: "1000" };
const CARD = "0.065";
const CASH = "0";

const STANDARD: BarberSettlementProfile = {
  appliesMaintenance: true,
  ivaBaseRate: 1,
  ivaInformative: false,
  fortnightlyAddition: 0,
};

function line(price: number, rate: number, fee = CASH, date = "2026-10-01"): SettlementLine {
  return { date, priceCharged: price, commissionRate: rate, paymentMethodFeeRate: fee };
}

function settle(partial: Omit<Partial<BarberSettlementInput>, "profile"> & { profile?: Partial<BarberSettlementProfile> }) {
  return computeBarberSettlement(
    {
      lines: partial.lines ?? [],
      vales: partial.vales ?? [],
      productCredit: partial.productCredit ?? [],
      tips: partial.tips ?? [],
      carryOver: partial.carryOver,
      warrantyClawbacks: partial.warrantyClawbacks,
      profile: { ...STANDARD, ...partial.profile },
    },
    SETTINGS
  );
}

describe("lineCommission", () => {
  it("CA 01: ₡11,300 at 50% → base ₡10,000, commission ₡5,000", () => {
    expect(lineCommission(11300, 0.5, 0.13).toNumber()).toBe(5000);
  });
});

describe("computeBarberSettlement", () => {
  it("CA 01: normal cash service", () => {
    const r = settle({ lines: [line(11300, 0.5)], profile: { appliesMaintenance: false } });
    expect(r.serviceIncome).toBe(5000);
    expect(r.cardFee).toBe(0);
  });

  it("CA 02: card fee is 6.5% of the IVA-free base", () => {
    const r = settle({ lines: [line(11300, 0.5, CARD)] });
    expect(r.cardFee).toBe(650);
  });

  it("CA 03: split payment — only the card line pays the fee", () => {
    const r = settle({ lines: [line(5000, 0.5, CASH), line(10000, 0.5, CARD)] });
    // 10,000 / 1.13 × 0.065
    expect(r.cardFee).toBe(575.22);
  });

  it("CA 04: two services on the same day → one maintenance fee", () => {
    const r = settle({ lines: [line(11300, 0.5), line(5650, 0.5)] });
    expect(r.daysWorked).toBe(1);
    expect(r.maintenance).toBe(1000);
  });

  it("counts each distinct day once", () => {
    const r = settle({
      lines: [line(1000, 0.5, CASH, "2026-10-01"), line(1000, 0.5, CASH, "2026-10-01"), line(1000, 0.5, CASH, "2026-10-03")],
    });
    expect(r.daysWorked).toBe(2);
    expect(r.maintenance).toBe(2000);
  });

  it("CA 05: no services → no maintenance", () => {
    const r = settle({});
    expect(r.daysWorked).toBe(0);
    expect(r.maintenance).toBe(0);
  });

  it("CA 06: exempt barber with services pays no maintenance", () => {
    const r = settle({ lines: [line(11300, 0.6)], profile: { appliesMaintenance: false } });
    expect(r.maintenance).toBe(0);
  });

  it("CA 07: fixed fortnightly addition bears IVA (₡20,000 → ₡2,600)", () => {
    const r = settle({ profile: { appliesMaintenance: false, fortnightlyAddition: 20000 } });
    expect(r.addition).toBe(20000);
    expect(r.iva).toBe(2600);
    expect(r.invoice).toBe(22600);
  });

  it("CA 08: Maicol — 100% payout, IVA only on 50% of the base", () => {
    const r = settle({
      lines: [line(113000, 1)],
      profile: { appliesMaintenance: false, ivaBaseRate: 0.5 },
    });
    expect(r.serviceIncome).toBe(100000);
    expect(r.ivaBase).toBe(50000);
    expect(r.iva).toBe(6500);
    expect(r.invoice).toBe(106500);
  });

  it("Maicol's IVA base subtracts expenses after halving the base", () => {
    const r = settle({
      lines: [line(113000, 1)],
      vales: [10000],
      profile: { appliesMaintenance: false, ivaBaseRate: 0.5 },
    });
    expect(r.ivaBase).toBe(40000);
    expect(r.net).toBe(90000);
  });

  it("CA 09: Brayan — 100% payout, exempt from maintenance", () => {
    const r = settle({ lines: [line(22600, 1)], profile: { appliesMaintenance: false } });
    expect(r.serviceIncome).toBe(20000);
    expect(r.maintenance).toBe(0);
  });

  it("CA 10: vales larger than income → transfer never negative, shortfall reported", () => {
    const r = settle({ lines: [line(22600, 1)], vales: [30000], profile: { appliesMaintenance: false } });
    expect(r.net).toBe(-10000);
    expect(r.iva).toBe(0);
    expect(r.invoice).toBe(0);
    expect(r.transfer).toBe(0);
    expect(r.shortfall).toBe(10000);
  });

  it("CA 10: Brayan's shortfall is flagged for salary deduction", () => {
    const r = settle({ lines: [line(22600, 1)], vales: [30000], profile: { appliesMaintenance: false, shortfallToSalary: true } });
    expect(r.shortfall).toBe(10000);
    expect(r.shortfallToSalary).toBe(true);
    expect(r.transfer).toBe(0);
  });

  it("CA 15: courtesy pays normal commission, no card fee, counts as a worked day", () => {
    const r = settle({ lines: [{ ...line(11300, 0.5, CARD), kind: "courtesy" }] });
    expect(r.serviceIncome).toBe(5000);
    expect(r.cardFee).toBe(0);
    expect(r.daysWorked).toBe(1);
    expect(r.maintenance).toBe(1000);
  });

  it("CA 16: warranty by a colleague — corrector paid, original's commission taken back", () => {
    // Corrector: redoes an ₡11,300 service at their 60% → base ₡10,000 × 60%.
    const corrector = settle({ lines: [{ ...line(11300, 0.6, CARD), kind: "warranty" }], profile: { appliesMaintenance: false } });
    expect(corrector.serviceIncome).toBe(6000);
    expect(corrector.cardFee).toBe(0);
    // Original barber: loses exactly the ₡5,000 they earned on it at 50%.
    const original = settle({
      lines: [line(22600, 0.5)],
      warrantyClawbacks: [{ priceCharged: 11300, commissionRate: 0.5 }],
      profile: { appliesMaintenance: false },
    });
    expect(original.warrantyClawback).toBe(5000);
    expect(original.net).toBe(5000);
  });

  it("CA 17: a voided service isn't passed in, so it affects nothing", () => {
    expect(settle({ lines: [] })).toMatchObject({ serviceIncome: 0, daysWorked: 0, maintenance: 0 });
  });

  it("groups services by commission rate (mixtos report)", () => {
    const r = settle({ lines: [line(11300, 0.5), line(11300, 0.65), line(22600, 0.5)] });
    expect(r.byRate).toEqual([
      { rate: 0.5, count: 2, grossCharged: 33900, income: 15000 },
      { rate: 0.65, count: 1, grossCharged: 11300, income: 6500 },
    ]);
  });

  it("carries a previous shortfall into the next fortnight as a deduction", () => {
    // CA 10's ₡10,000 shortfall, repaid out of next fortnight's ₡20,000 income.
    const r = settle({ lines: [line(22600, 1)], carryOver: 10000, profile: { appliesMaintenance: false } });
    expect(r.carryOver).toBe(10000);
    expect(r.totalExpenses).toBe(10000);
    expect(r.net).toBe(10000);
    expect(r.shortfall).toBe(0);
  });

  it("CA 11: Jorge — IVA shown but excluded from the transfer", () => {
    const r = settle({ lines: [line(90400, 1)], profile: { appliesMaintenance: false, ivaInformative: true } });
    expect(r.net).toBe(80000);
    expect(r.iva).toBe(10400);
    expect(r.ivaPaid).toBe(0);
    expect(r.invoice).toBe(80000);
    expect(r.transfer).toBe(80000);
  });

  it("CA 12: tips add to the transfer, not to the invoice or IVA base", () => {
    const without = settle({ lines: [line(11300, 0.5)] });
    const withTips = settle({ lines: [line(11300, 0.5)], tips: [5000] });
    expect(withTips.invoice).toBe(without.invoice);
    expect(withTips.ivaBase).toBe(without.ivaBase);
    expect(withTips.transfer).toBe(without.transfer + 5000);
  });

  it("product credit is deducted before IVA", () => {
    const r = settle({ lines: [line(113000, 0.5)], productCredit: [5000], profile: { appliesMaintenance: false } });
    expect(r.net).toBe(45000);
    expect(r.iva).toBe(5850);
  });

  it("full standard example adds up", () => {
    // 2 days, card + cash, vale, product credit, tip.
    const r = settle({
      lines: [line(11300, 0.5, CARD, "2026-10-01"), line(11300, 0.5, CASH, "2026-10-02")],
      vales: [2000],
      productCredit: [1000],
      tips: [3000],
    });
    expect(r.serviceIncome).toBe(10000);
    expect(r.cardFee).toBe(650);
    expect(r.maintenance).toBe(2000);
    expect(r.totalExpenses).toBe(5650);
    expect(r.net).toBe(4350);
    expect(r.iva).toBe(565.5);
    expect(r.invoice).toBe(4915.5);
    expect(r.transfer).toBe(7915.5);
  });

  it("does not round intermediate per-line values (spec §6.9)", () => {
    // Each line's commission is 442.4778…; rounding per line would give 1327.44.
    const r = settle({ lines: [line(1000, 0.5), line(1000, 0.5), line(1000, 0.5)] });
    expect(r.serviceIncome).toBe(1327.43);
  });
});

describe("fortnights", () => {
  it("splits a month into 1–15 and 16–end", () => {
    expect(fortnightRange(2026, 10, 1)).toMatchObject({ from: "2026-10-01", to: "2026-10-15" });
    expect(fortnightRange(2026, 10, 2)).toMatchObject({ from: "2026-10-16", to: "2026-10-31" });
    expect(fortnightRange(2026, 11, 2).to).toBe("2026-11-30");
    expect(fortnightRange(2028, 2, 2).to).toBe("2028-02-29");
  });

  it("finds the fortnight of a date", () => {
    expect(fortnightOf("2026-10-15").half).toBe(1);
    expect(fortnightOf("2026-10-16").half).toBe(2);
  });

  it("keys round-trip and shift across month and year boundaries", () => {
    const f = fortnightRange(2026, 12, 2);
    expect(fortnightKey(f)).toBe("2026-12-2");
    expect(parseFortnightKey("2026-12-2")).toEqual(f);
    expect(parseFortnightKey("2026-13-1")).toBeNull();
    expect(parseFortnightKey("2026-12-3")).toBeNull();
    expect(fortnightKey(shiftFortnight(f, 1))).toBe("2027-01-1");
    expect(fortnightKey(shiftFortnight(fortnightRange(2027, 1, 1), -1))).toBe("2026-12-2");
    expect(fortnightKey(shiftFortnight(fortnightRange(2026, 5, 1), 1))).toBe("2026-05-2");
  });
});

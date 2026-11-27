import { describe, expect, it } from "vitest";
import { computeShiftClosing, methodKind, registerState } from "./cash-register";

describe("payment method kinds", () => {
  it("reads the kind from the method's name", () => {
    expect(methodKind("Efectivo")).toBe("cash");
    expect(methodKind("Cash")).toBe("cash");
    expect(methodKind("Credit Card")).toBe("card");
    expect(methodKind("Datáfono")).toBe("card");
    expect(methodKind("SINPE Móvil")).toBe("sinpe");
    expect(methodKind("Crédito")).toBe("credit");
    expect(methodKind("Transferencia")).toBe("other");
    expect(methodKind(null)).toBe("other");
  });
});

describe("register state", () => {
  it("closed, open today, or a closing pending from an earlier day", () => {
    expect(registerState(null, "2026-11-27")).toBe("closed");
    expect(registerState({ businessDate: "2026-11-27" }, "2026-11-27")).toBe("open");
    expect(registerState({ businessDate: "2026-11-26" }, "2026-11-27")).toBe("closingPending");
  });
});

describe("shift closing (CIERRE GENERAL)", () => {
  // Corte 2 of the real 10 Nov 2026 closing: cash 50,500 + card 27,700 + SINPE
  // 82,500 + outflows 5,000 = 165,700 = system total. No float in that sheet.
  const methods = [
    { paymentMethodId: "cash", name: "Efectivo", sales: 55_500 },
    { paymentMethodId: "card", name: "Tarjeta", sales: 27_700 },
    { paymentMethodId: "sinpe", name: "SINPE Móvil", sales: 82_500 },
  ];

  it("balances when the count matches the sales", () => {
    const c = computeShiftClosing({
      openingCash: 0,
      methods,
      outflows: [3_000, 2_000],
      counted: { cash: 50_500, card: 27_700, sinpe: 82_500 },
    });
    expect(c.lines.map((l) => [l.kind, l.expected, l.difference])).toEqual([
      ["cash", 50_500, 0],
      ["card", 27_700, 0],
      ["sinpe", 82_500, 0],
    ]);
    expect(c).toMatchObject({ outflows: 5_000, expectedTotal: 160_700, countedTotal: 160_700, difference: 0 });
  });

  it("the opening float is expected back in cash; a short count is a shortfall", () => {
    const c = computeShiftClosing({
      openingCash: 20_000,
      methods,
      outflows: [5_000],
      counted: { cash: 69_000, card: 27_700, sinpe: 82_500 },
    });
    expect(c.lines[0]).toMatchObject({ expected: 70_500, counted: 69_000, difference: 1_500 });
    expect(c.difference).toBe(1_500);
  });

  it("more money than expected is a surplus (negative difference)", () => {
    const c = computeShiftClosing({ openingCash: 0, methods, outflows: [], counted: { cash: 56_000, card: 27_700, sinpe: 82_500 } });
    expect(c.difference).toBe(-500);
  });

  it("credit sales are shown but not counted", () => {
    const c = computeShiftClosing({
      openingCash: 0,
      methods: [...methods, { paymentMethodId: "credit", name: "Crédito", sales: 10_000 }],
      outflows: [],
      counted: { cash: 55_500, card: 27_700, sinpe: 82_500 },
    });
    expect(c.lines[3]).toMatchObject({ kind: "credit", counts: false, counted: null, difference: null });
    expect(c.expectedTotal).toBe(165_700);
    expect(c.difference).toBe(0);
  });

  it("a missing count is nothing handed in", () => {
    const c = computeShiftClosing({ openingCash: 0, methods, outflows: [], counted: { cash: 55_500, card: 27_700 } });
    expect(c.lines[2]).toMatchObject({ counted: 0, difference: 82_500 });
  });

  it("adds a cash line when the tenant has no cash method", () => {
    const c = computeShiftClosing({
      openingCash: 10_000,
      methods: [{ paymentMethodId: "card", name: "Tarjeta", sales: 5_000 }],
      outflows: [],
      counted: { none: 10_000, card: 5_000 },
    });
    expect(c.lines.map((l) => [l.paymentMethodId, l.kind, l.expected])).toEqual([
      [null, "cash", 10_000],
      ["card", "card", 5_000],
    ]);
    expect(c.difference).toBe(0);
  });

  it("exact decimals", () => {
    const c = computeShiftClosing({
      openingCash: 0.1,
      methods: [{ paymentMethodId: "cash", name: "Efectivo", sales: 0.2 }],
      outflows: [],
      counted: { cash: 0.3 },
    });
    expect(c.difference).toBe(0);
  });
});

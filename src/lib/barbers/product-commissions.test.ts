import { describe, expect, it } from "vitest";
import { productSaleFigures, summarizeProductClosing } from "./product-commissions";

describe("productSaleFigures (Brayan's rule, Nov 2026)", () => {
  it("with IVA: ₡8,000 → customer pays ₡9,040; ₡1,000 commission; ₡7,000 for NOURA", () => {
    expect(productSaleFigures({ unitPrice: 8000, quantity: 1, chargesIva: true, ivaRate: 0.13, commissionPerUnit: 1000 })).toEqual({
      subtotal: 8000,
      ivaAmount: 1040,
      total: 9040,
      commissionTotal: 1000,
      shopAmount: 7000,
    });
  });

  it("without IVA the customer pays the price; the commission is unchanged", () => {
    expect(productSaleFigures({ unitPrice: 8000, quantity: 1, chargesIva: false, ivaRate: 0.13, commissionPerUnit: 1000 })).toMatchObject({
      ivaAmount: 0,
      total: 8000,
      commissionTotal: 1000,
    });
  });

  it("multiplies by quantity", () => {
    expect(productSaleFigures({ unitPrice: 5000, quantity: 3, chargesIva: true, ivaRate: 0.13, commissionPerUnit: 500 })).toMatchObject({
      subtotal: 15000,
      ivaAmount: 1950,
      total: 16950,
      commissionTotal: 1500,
    });
  });
});

describe("summarizeProductClosing", () => {
  it("totals sold, commissions paid/pending, per collaborator", () => {
    const s = summarizeProductClosing([
      { barberId: "a", subtotal: 8000, ivaAmount: 1040, total: 9040, commissionTotal: 1000, paid: true },
      { barberId: "a", subtotal: 5000, ivaAmount: 0, total: 5000, commissionTotal: 500, paid: false },
      { barberId: "b", subtotal: 3000, ivaAmount: 390, total: 3390, commissionTotal: 300, paid: false },
      { barberId: null, subtotal: 2000, ivaAmount: 0, total: 2000, commissionTotal: 0, paid: false },
    ]);
    expect(s).toMatchObject({ sales: 4, subtotal: 18000, ivaAmount: 1430, total: 19430, commissions: 1800, commissionsPaid: 1000, commissionsPending: 800 });
    expect(s.byBarber).toEqual([
      { barberId: "a", sales: 2, commissions: 1500, paid: 1000, pending: 500 },
      { barberId: "b", sales: 1, commissions: 300, paid: 0, pending: 300 },
    ]);
  });
});

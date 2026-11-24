import Decimal from "decimal.js";

/**
 * Product sales to customers and their commissions (Brayan, Nov 2026):
 *
 * - The product's price is entered WITHOUT IVA. If the product is marked
 *   "charge with IVA", the shop's IVA % is added on top: ₡8,000 → the
 *   customer pays ₡9,040 (₡1,040 IVA).
 * - The commission is a fixed amount per unit, set per product from its margin
 *   (₡1,000). It comes out of the price without IVA and doesn't change what the
 *   customer pays: ₡8,000 − ₡1,000 = ₡7,000 for NOURA before the product's cost.
 * - Commissions are settled in a separate product closing (pending → paid),
 *   never in the service settlement.
 */

export type ProductSaleFigures = {
  subtotal: number; // price × qty, without IVA
  ivaAmount: number;
  total: number; // what the customer pays
  commissionTotal: number;
  shopAmount: number; // subtotal − commission, before the product's cost
};

const cents = (d: Decimal) => d.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();

export function productSaleFigures(input: {
  unitPrice: Decimal.Value;
  quantity: number;
  chargesIva: boolean;
  ivaRate: Decimal.Value;
  commissionPerUnit: Decimal.Value;
}): ProductSaleFigures {
  const subtotal = new Decimal(input.unitPrice).times(input.quantity);
  const iva = input.chargesIva ? subtotal.times(input.ivaRate) : new Decimal(0);
  const commission = new Decimal(input.commissionPerUnit).times(input.quantity);
  return {
    subtotal: cents(subtotal),
    ivaAmount: cents(iva),
    total: cents(subtotal.plus(iva)),
    commissionTotal: cents(commission),
    shopAmount: cents(subtotal.minus(commission)),
  };
}

export type ClosingSale = {
  barberId: string | null;
  subtotal: Decimal.Value;
  ivaAmount: Decimal.Value;
  total: Decimal.Value;
  commissionTotal: Decimal.Value;
  paid: boolean;
};

export type ProductClosingSummary = {
  sales: number;
  subtotal: number;
  ivaAmount: number;
  total: number;
  commissions: number;
  commissionsPaid: number;
  commissionsPending: number;
  byBarber: { barberId: string; sales: number; commissions: number; paid: number; pending: number }[];
};

/** Totals for a product closing over any set of sales (a week, a fortnight…). */
export function summarizeProductClosing(sales: ClosingSale[]): ProductClosingSummary {
  const zero = () => new Decimal(0);
  let subtotal = zero(), iva = zero(), total = zero(), commissions = zero(), paid = zero();
  const per = new Map<string, { sales: number; commissions: Decimal; paid: Decimal }>();
  for (const s of sales) {
    subtotal = subtotal.plus(s.subtotal);
    iva = iva.plus(s.ivaAmount);
    total = total.plus(s.total);
    commissions = commissions.plus(s.commissionTotal);
    if (s.paid) paid = paid.plus(s.commissionTotal);
    if (!s.barberId) continue;
    const p = per.get(s.barberId) ?? { sales: 0, commissions: zero(), paid: zero() };
    p.sales++;
    p.commissions = p.commissions.plus(s.commissionTotal);
    if (s.paid) p.paid = p.paid.plus(s.commissionTotal);
    per.set(s.barberId, p);
  }
  return {
    sales: sales.length,
    subtotal: cents(subtotal),
    ivaAmount: cents(iva),
    total: cents(total),
    commissions: cents(commissions),
    commissionsPaid: cents(paid),
    commissionsPending: cents(commissions.minus(paid)),
    byBarber: [...per].map(([barberId, p]) => ({
      barberId,
      sales: p.sales,
      commissions: cents(p.commissions),
      paid: cents(p.paid),
      pending: cents(p.commissions.minus(p.paid)),
    })),
  };
}

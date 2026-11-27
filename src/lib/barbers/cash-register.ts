import Decimal from "decimal.js";
import { paymentMethodCodeOfName } from "./closing-import/normalize";

/**
 * Cash-register shift ("corte") rules. Pure and unit tested
 * (cash-register.test.ts); services/barbers/cash-register.ts loads the data.
 *
 * Mirrors NOURA's CIERRE GENERAL sheet: per payment method, what the sales
 * say should be there (expected) against what the cashier counts or confirms
 * (counted). For cash, expected = float at opening + cash sales − cash taken
 * out during the shift. Card = the terminal's closing total; SINPE = the
 * transfers received. Sales on credit bring no money in, so they're shown but
 * not counted. Difference = expected − counted: positive is a shortfall,
 * charged to the shift's cashier (Brayan, Nov 2026).
 */

export type MethodKind = "cash" | "card" | "sinpe" | "credit" | "other";

/** What kind of money a payment method is, from its name ("Efectivo", "Tarjeta"…). */
export function methodKind(name: string | null): MethodKind {
  if (!name) return "other";
  switch (paymentMethodCodeOfName(name)) {
    case "EFECTIVO":
      return "cash";
    case "TARJETA":
      return "card";
    case "SINPE MOVIL":
      return "sinpe";
    case "CREDITO":
      return "credit";
    default:
      return "other";
  }
}

export type RegisterState = "closed" | "open" | "closingPending";

/**
 * The register's state at a location: no open shift = closed; an open shift
 * from an earlier day = closing pending (must be closed before opening again).
 */
export function registerState(openShift: { businessDate: string } | null, today: string): RegisterState {
  if (!openShift) return "closed";
  return openShift.businessDate < today ? "closingPending" : "open";
}

/** Key for a payment method in `counted` (sales without a method use "none"). */
export function methodKey(paymentMethodId: string | null): string {
  return paymentMethodId ?? "none";
}

export type ShiftMethodSales = { paymentMethodId: string | null; name: string; sales: Decimal.Value };

export type ShiftClosingLine = {
  paymentMethodId: string | null;
  name: string;
  kind: MethodKind;
  /** false for credit: no money to count. */
  counts: boolean;
  sales: number;
  expected: number;
  counted: number | null;
  difference: number | null; // expected − counted
};

export type ShiftClosing = {
  openingCash: number;
  outflows: number;
  lines: ShiftClosingLine[];
  expectedTotal: number; // countable lines only
  countedTotal: number;
  difference: number; // > 0 shortfall, < 0 surplus
};

const cents = (d: Decimal) => d.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();

/**
 * Expected vs. counted per payment method. `counted` is keyed by methodKey;
 * a missing count on a countable line is treated as 0 (nothing handed in).
 * The opening float and outflows go on the first cash method; if the tenant
 * has no cash method they still need a line, so one is added.
 */
export function computeShiftClosing(input: {
  openingCash: Decimal.Value;
  methods: ShiftMethodSales[];
  outflows: Decimal.Value[];
  counted?: Record<string, Decimal.Value | null | undefined>;
  cashLabel?: string;
}): ShiftClosing {
  const opening = new Decimal(input.openingCash);
  const outflows = input.outflows.reduce<Decimal>((acc, v) => acc.plus(v), new Decimal(0));
  const methods = [...input.methods];
  if (!methods.some((m) => methodKind(m.name) === "cash")) {
    methods.unshift({ paymentMethodId: null, name: input.cashLabel ?? "Efectivo", sales: 0 });
  }
  const firstCash = methods.findIndex((m) => methodKind(m.name) === "cash");

  let expectedTotal = new Decimal(0);
  let countedTotal = new Decimal(0);
  const lines = methods.map((m, i): ShiftClosingLine => {
    const kind = methodKind(m.name);
    const counts = kind !== "credit";
    const sales = new Decimal(m.sales);
    const expected = i === firstCash ? opening.plus(sales).minus(outflows) : sales;
    if (!counts) {
      return { paymentMethodId: m.paymentMethodId, name: m.name, kind, counts, sales: cents(sales), expected: cents(expected), counted: null, difference: null };
    }
    const raw = input.counted?.[methodKey(m.paymentMethodId)];
    const counted = new Decimal(raw ?? 0);
    expectedTotal = expectedTotal.plus(expected);
    countedTotal = countedTotal.plus(counted);
    return {
      paymentMethodId: m.paymentMethodId,
      name: m.name,
      kind,
      counts,
      sales: cents(sales),
      expected: cents(expected),
      counted: cents(counted),
      difference: cents(expected.minus(counted)),
    };
  });

  return {
    openingCash: cents(opening),
    outflows: cents(outflows),
    lines,
    expectedTotal: cents(expectedTotal),
    countedTotal: cents(countedTotal),
    difference: cents(expectedTotal.minus(countedTotal)),
  };
}

import Decimal from "decimal.js";

/**
 * THE settlement ("liquidación") engine for the Barbers module.
 *
 * Pure: no DB, no dates-from-the-clock, no I/O. The services layer loads the
 * fortnight's data and hands it in; everything here is deterministic and unit
 * tested (settlement.test.ts encodes the NOURA spec's acceptance cases).
 *
 * Money math uses decimal.js end to end — never JS floats — and nothing is
 * rounded until the very end, where each reported figure is rounded to céntimos
 * independently from the unrounded values (spec §6.9: display rounding must
 * never feed back into a total).
 *
 * Formula (spec §6 / Anexo C):
 *
 *   base (per line)   = priceCharged / (1 + ivaRate)
 *   serviceIncome     = Σ base × commissionRate
 *   cardFee           = Σ base × paymentMethodFeeRate      (0 for cash/SINPE)
 *   maintenance       = daysWorked × maintenanceDailyFee   (0 if exempt)
 *   expenses          = cardFee + maintenance + productCredit + vales
 *   net               = serviceIncome + addition − expenses
 *   ivaBase           = serviceIncome × ivaBaseRate + addition − expenses
 *   iva               = max(0, ivaBase) × ivaRate
 *   invoice           = max(0, net) + (ivaInformative ? 0 : iva)
 *   transfer          = invoice + tips
 *   shortfall         = max(0, −net)    (expenses the fortnight couldn't cover)
 *
 * With the default ivaBaseRate of 1, ivaBase equals net. Per-barber variations
 * (Maicol's 50% IVA base, Jorge's informative-only IVA, Imara's fixed addition,
 * maintenance exemptions) are plain profile fields, not special-cased names.
 */

export type DecimalLike = Decimal.Value;

export type SettlementSettings = {
  ivaRate: DecimalLike; // 0.13
  maintenanceDailyFee: DecimalLike; // 1000
};

export type BarberSettlementProfile = {
  appliesMaintenance: boolean;
  ivaBaseRate: DecimalLike; // 1 normally; 0.5 for Maicol
  ivaInformative: boolean; // true for Jorge: IVA shown but not paid
  fortnightlyAddition: DecimalLike; // e.g. Imara's ₡20,000 cleaning; IVA-bearing
};

export type SettlementLine = {
  /** Business date of the service (Costa Rica calendar day), YYYY-MM-DD. */
  date: string;
  priceCharged: DecimalLike; // IVA-inclusive amount actually collected
  commissionRate: DecimalLike; // 0.5 = 50%
  paymentMethodFeeRate: DecimalLike; // 0.065 for card, 0 otherwise
};

export type BarberSettlementInput = {
  profile: BarberSettlementProfile;
  lines: SettlementLine[];
  vales: DecimalLike[];
  productCredit: DecimalLike[];
  tips: DecimalLike[];
};

export type BarberSettlement = {
  serviceCount: number;
  daysWorked: number;
  grossCharged: number; // Σ priceCharged, IVA included
  serviceIncome: number; // "Total de ingresos por servicios antes del IVA"
  addition: number;
  cardFee: number;
  maintenance: number;
  productCredit: number;
  vales: number;
  totalExpenses: number;
  net: number;
  ivaBase: number;
  iva: number;
  ivaPaid: number; // iva, or 0 when informative
  ivaInformative: boolean;
  invoice: number;
  tips: number;
  transfer: number;
  shortfall: number;
};

const ZERO = new Decimal(0);
const ONE = new Decimal(1);

function sum(values: DecimalLike[]): Decimal {
  return values.reduce<Decimal>((acc, v) => acc.plus(v), ZERO);
}

function cents(d: Decimal): number {
  return d.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}

/** IVA-exclusive base of an IVA-inclusive amount. Unrounded. */
export function baseWithoutIva(priceCharged: DecimalLike, ivaRate: DecimalLike): Decimal {
  return new Decimal(priceCharged).div(ONE.plus(ivaRate));
}

/**
 * Commission earned on one service line, before any expenses: base × rate.
 * This is the per-line figure stored on barber_activities.commission_amount
 * (rounded to céntimos for display); settlements always recompute from the
 * raw line fields rather than summing stored rounded values.
 */
export function lineCommission(
  priceCharged: DecimalLike,
  commissionRate: DecimalLike,
  ivaRate: DecimalLike
): Decimal {
  return baseWithoutIva(priceCharged, ivaRate).times(commissionRate);
}

export function computeBarberSettlement(
  input: BarberSettlementInput,
  settings: SettlementSettings
): BarberSettlement {
  const { profile } = input;
  const ivaRate = new Decimal(settings.ivaRate);

  let grossCharged = ZERO;
  let serviceIncome = ZERO;
  let cardFee = ZERO;
  const days = new Set<string>();

  for (const line of input.lines) {
    const base = baseWithoutIva(line.priceCharged, ivaRate);
    grossCharged = grossCharged.plus(line.priceCharged);
    serviceIncome = serviceIncome.plus(base.times(line.commissionRate));
    cardFee = cardFee.plus(base.times(line.paymentMethodFeeRate));
    days.add(line.date);
  }

  // A day counts once no matter how many services were done that day, and only
  // days with at least one registered service count (spec §6.6, CA 04/05).
  const daysWorked = days.size;
  const maintenance = profile.appliesMaintenance
    ? new Decimal(settings.maintenanceDailyFee).times(daysWorked)
    : ZERO;

  const productCredit = sum(input.productCredit);
  const vales = sum(input.vales);
  const tips = sum(input.tips);
  const addition = new Decimal(profile.fortnightlyAddition);

  const totalExpenses = cardFee.plus(maintenance).plus(productCredit).plus(vales);
  const net = serviceIncome.plus(addition).minus(totalExpenses);
  const ivaBase = serviceIncome.times(profile.ivaBaseRate).plus(addition).minus(totalExpenses);
  const iva = Decimal.max(ZERO, ivaBase).times(ivaRate);
  const ivaPaid = profile.ivaInformative ? ZERO : iva;
  const invoice = Decimal.max(ZERO, net).plus(ivaPaid);
  const transfer = invoice.plus(tips);
  const shortfall = Decimal.max(ZERO, net.neg());

  return {
    serviceCount: input.lines.length,
    daysWorked,
    grossCharged: cents(grossCharged),
    serviceIncome: cents(serviceIncome),
    addition: cents(addition),
    cardFee: cents(cardFee),
    maintenance: cents(maintenance),
    productCredit: cents(productCredit),
    vales: cents(vales),
    totalExpenses: cents(totalExpenses),
    net: cents(net),
    ivaBase: cents(ivaBase),
    iva: cents(iva),
    ivaPaid: cents(ivaPaid),
    ivaInformative: profile.ivaInformative,
    invoice: cents(invoice),
    tips: cents(tips),
    transfer: cents(transfer),
    shortfall: cents(shortfall),
  };
}

// ── Fortnight periods ─────────────────────────────────────────────────────────

export type Fortnight = {
  year: number;
  month: number; // 1-12
  half: 1 | 2;
  from: string; // YYYY-MM-DD inclusive
  to: string; // YYYY-MM-DD inclusive
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Spec §3.1: first fortnight is days 1–15, second is 16–end of month. */
export function fortnightRange(year: number, month: number, half: 1 | 2): Fortnight {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const ym = `${year}-${pad2(month)}`;
  return half === 1
    ? { year, month, half, from: `${ym}-01`, to: `${ym}-15` }
    : { year, month, half, from: `${ym}-16`, to: `${ym}-${pad2(lastDay)}` };
}

/** The fortnight containing a YYYY-MM-DD date. */
export function fortnightOf(dateStr: string): Fortnight {
  const [y, m, d] = dateStr.split("-").map(Number);
  return fortnightRange(y, m, d <= 15 ? 1 : 2);
}

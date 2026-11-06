// Money is handled as integer cents end to end, so no float rounding ever reaches a total.
// The DB's numeric(12,2) and the API both use decimal strings ("12.34").

export const AMOUNT_PATTERN = /^\d{1,10}(\.\d{1,2})?$/;

/** "12.3" → 1230. Throws on anything that isn't a plain non-negative decimal. */
export function toCents(amount: string): number {
  if (!AMOUNT_PATTERN.test(amount)) throw new Error(`Invalid amount: ${amount}`);
  const [whole, fraction = ""] = amount.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

/** 1230 → "12.30" */
export function formatCents(cents: number): string {
  const whole = Math.floor(cents / 100);
  const fraction = String(cents % 100).padStart(2, "0");
  return `${whole}.${fraction}`;
}

/** Per-currency running totals. Currencies are never converted into each other. */
export class CurrencyTotals {
  private cents = new Map<string, number>();

  add(currency: string, cents: number) {
    this.cents.set(currency, (this.cents.get(currency) ?? 0) + cents);
  }

  toJSON(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [currency, cents] of [...this.cents].sort(([a], [b]) => a.localeCompare(b))) {
      out[currency] = formatCents(cents);
    }
    return out;
  }
}

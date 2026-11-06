import { toCents } from "./money";

/** Latest stored price for one (card, variant, source), as read from card_price_points. */
export type StoredPrice = {
  variant: string;
  source: string;
  currency: string;
  marketPrice: string; // numeric(12,2) comes back from the driver as a string
  observedOn: string; // YYYY-MM-DD
};

export type ResolvedPrice = {
  amount: string;
  currency: string;
  source: string;
  observedOn: string;
  isFallback: boolean; // true when the item's own printing had no price and the card's headline price was used
};

/** Variant key stored when a source doesn't split prices by printing (e.g. Cardmarket trend). */
export const DEFAULT_VARIANT = "default";

/** Same order as the app's `CardPrice.variantOrder`: base printing first. */
export const VARIANT_ORDER = ["normal", "holofoil", "reverse-holofoil", "1st-edition-holofoil", "1st-edition-normal"];

function variantRank(variant: string): number {
  const i = VARIANT_ORDER.indexOf(variant);
  return i === -1 ? VARIANT_ORDER.length : i;
}

/** TCGplayer/USD is the preferred source; any USD next; then everything else. */
function sourceRank(p: StoredPrice): number {
  if (p.source === "TCGplayer" && p.currency === "USD") return 0;
  if (p.currency === "USD") return 1;
  return 2;
}

function byPreference(a: StoredPrice, b: StoredPrice): number {
  return sourceRank(a) - sourceRank(b) || b.observedOn.localeCompare(a.observedOn);
}

/**
 * The price shown for an item: the best source for the item's own printing, or — when that
 * printing has no price — the card's headline price (base printing first), flagged as a fallback.
 * `prices` holds the latest point per (variant, source) for this one card.
 */
export function resolveItemPrice(prices: StoredPrice[], variant: string): ResolvedPrice | null {
  const own = prices.filter((p) => p.variant === variant).sort(byPreference);
  if (own.length > 0) return toResolved(own[0], false);

  const headline = [...prices].sort(
    (a, b) => sourceRank(a) - sourceRank(b) || variantRank(a.variant) - variantRank(b.variant) || b.observedOn.localeCompare(a.observedOn),
  );
  return headline.length > 0 ? toResolved(headline[0], true) : null;
}

function toResolved(p: StoredPrice, isFallback: boolean): ResolvedPrice {
  return { amount: p.marketPrice, currency: p.currency, source: p.source, observedOn: p.observedOn, isFallback };
}

export function lineValueCents(price: ResolvedPrice, quantity: number): number {
  return toCents(price.amount) * quantity;
}

import { asc, desc, inArray } from "drizzle-orm";
import { db } from "@/db";
import { cardPricePoints } from "@/db/schema";
import { generateId } from "@/lib/ids";
import { DEFAULT_VARIANT, type StoredPrice } from "@/lib/cards/pricing";
import type { ClientPrice } from "@/lib/cards/validation";

// Global, append-only price history (no tenant_id). One row per card · printing · source · day.

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Store the prices the app showed when the card was added. Already-known (card, variant, source, day) rows are kept. */
export async function recordClientPrices(catalogCardId: string, prices: ClientPrice[]): Promise<void> {
  if (prices.length === 0) return;
  await db
    .insert(cardPricePoints)
    .values(
      prices.map((p) => ({
        id: generateId(),
        catalogCardId,
        variant: p.variant ?? DEFAULT_VARIANT,
        source: p.source,
        currency: p.currency,
        marketPrice: p.amount,
        observedOn: p.updatedAt ?? todayUtc(),
      })),
    )
    .onConflictDoNothing();
}

/** Latest price per (variant, source) for each card, grouped by card id. */
export async function getCurrentPrices(catalogCardIds: string[]): Promise<Map<string, StoredPrice[]>> {
  const byCard = new Map<string, StoredPrice[]>();
  const ids = [...new Set(catalogCardIds)];
  if (ids.length === 0) return byCard;

  const rows = await db
    .selectDistinctOn([cardPricePoints.catalogCardId, cardPricePoints.variant, cardPricePoints.source], {
      catalogCardId: cardPricePoints.catalogCardId,
      variant: cardPricePoints.variant,
      source: cardPricePoints.source,
      currency: cardPricePoints.currency,
      marketPrice: cardPricePoints.marketPrice,
      observedOn: cardPricePoints.observedOn,
    })
    .from(cardPricePoints)
    .where(inArray(cardPricePoints.catalogCardId, ids))
    .orderBy(asc(cardPricePoints.catalogCardId), asc(cardPricePoints.variant), asc(cardPricePoints.source), desc(cardPricePoints.observedOn));

  for (const { catalogCardId, ...price } of rows) {
    const list = byCard.get(catalogCardId) ?? [];
    list.push(price);
    byCard.set(catalogCardId, list);
  }
  return byCard;
}

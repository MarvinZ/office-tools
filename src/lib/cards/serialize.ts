import type { InferSelectModel } from "drizzle-orm";
import type { cardCatalog, collectionItems } from "@/db/schema";
import { formatCents } from "./money";
import { lineValueCents, resolveItemPrice, type StoredPrice } from "./pricing";

type ItemRow = InferSelectModel<typeof collectionItems>;
type CardRow = InferSelectModel<typeof cardCatalog>;

/** One collection item exactly as the API returns it (spec §6). */
export type ItemDto = ReturnType<typeof toItemDto>;

export function toItemDto(item: ItemRow, card: CardRow, prices: StoredPrice[]) {
  const price = resolveItemPrice(prices, item.variant);
  const lineCents = price ? lineValueCents(price, item.quantity) : null;

  return {
    id: item.id,
    collectorId: item.collectorId,
    variant: item.variant,
    condition: item.condition,
    quantity: item.quantity,
    isFavorite: item.isFavorite,
    notes: item.notes,
    acquiredAt: item.acquiredAt,
    addedAt: item.createdAt.toISOString(),
    card: {
      tcgdexId: card.tcgdexId,
      language: card.language,
      name: card.name,
      setId: card.setId,
      setName: card.setName,
      localId: card.localId,
      setOfficialCount: card.setOfficialCount,
      rarity: card.rarity,
      imageUrl: card.imageUrl,
      marketImageUrl: card.marketImageUrl,
    },
    price: price ? { amount: price.amount, currency: price.currency, source: price.source, observedOn: price.observedOn } : null,
    priceIsFallback: price?.isFallback ?? false,
    lineValue: price && lineCents !== null ? { amount: formatCents(lineCents), currency: price.currency } : null,
    /** For sorting by value server-side; not part of the response. */
    _lineCents: lineCents,
  };
}

/** Drop internal fields before sending. */
export function publicItem({ _lineCents, ...dto }: ItemDto) {
  void _lineCents;
  return dto;
}

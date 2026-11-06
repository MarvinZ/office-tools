import { sql, type InferSelectModel } from "drizzle-orm";
import { db } from "@/db";
import { cardCatalog } from "@/db/schema";
import { generateId } from "@/lib/ids";
import type { CardSnapshot } from "@/lib/cards/validation";

// Global reference data — no tenant_id (like `tools` / `trades`). Nothing tenant-specific is stored here.

export type CatalogCardRow = InferSelectModel<typeof cardCatalog>;

/**
 * Insert the card the first time anyone collects it; on later adds refresh the snapshot.
 * Optional fields keep their stored value when the new snapshot doesn't have one, so an
 * older app build can't wipe an image or TCGplayer link that a newer one sent.
 */
export async function upsertCatalogCard(card: CardSnapshot): Promise<CatalogCardRow> {
  const keep = (column: string) => sql.raw(`coalesce(excluded.${column}, card_catalog.${column})`);

  const [row] = await db
    .insert(cardCatalog)
    .values({
      id: generateId(),
      tcgdexId: card.tcgdexId,
      language: card.language,
      name: card.name,
      setId: card.setId,
      setName: card.setName,
      localId: card.localId,
      setOfficialCount: card.setOfficialCount ?? null,
      rarity: card.rarity ?? null,
      imageUrl: card.imageUrl ?? null,
      marketImageUrl: card.marketImageUrl ?? null,
      tcgplayerGroupId: card.tcgplayerGroupId ?? null,
      tcgplayerProductId: card.tcgplayerProductId ?? null,
    })
    .onConflictDoUpdate({
      target: [cardCatalog.tcgdexId, cardCatalog.language],
      set: {
        name: sql`excluded.name`,
        setId: sql`excluded.set_id`,
        setName: sql`excluded.set_name`,
        localId: sql`excluded.local_id`,
        setOfficialCount: keep("set_official_count"),
        rarity: keep("rarity"),
        imageUrl: keep("image_url"),
        marketImageUrl: keep("market_image_url"),
        tcgplayerGroupId: keep("tcgplayer_group_id"),
        tcgplayerProductId: keep("tcgplayer_product_id"),
        updatedAt: new Date(),
      },
    })
    .returning();

  return row;
}

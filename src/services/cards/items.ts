import { and, asc, desc, eq, ilike, type InferSelectModel, type SQL, sql } from "drizzle-orm";
import { db } from "@/db";
import { cardCatalog, collectionItems } from "@/db/schema";
import { generateId } from "@/lib/ids";
import { isUniqueViolation, ApiError } from "@/lib/cards/errors";
import { mergeItems } from "@/lib/cards/merge";
import { toItemDto, type ItemDto } from "@/lib/cards/serialize";
import type { AddItemInput, ListItemsQuery, PatchItemInput } from "@/lib/cards/validation";
import { upsertCatalogCard } from "./catalog";
import { getCurrentPrices, recordClientPrices } from "./prices";

// Every function is scoped by tenantId AND collectorId: the route resolves (and permission-checks)
// the collector within the caller's family first, and every query here repeats both filters.

// ── Raw row types ─────────────────────────────────────────────────────────────

export type CollectionItemRow = InferSelectModel<typeof collectionItems>;

// ── Queries ───────────────────────────────────────────────────────────────────

function itemScope(tenantId: string, collectorId: string): SQL {
  return and(eq(collectionItems.tenantId, tenantId), eq(collectionItems.collectorId, collectorId))!;
}

async function toDtos(rows: { item: CollectionItemRow; card: typeof cardCatalog.$inferSelect }[]): Promise<ItemDto[]> {
  const prices = await getCurrentPrices(rows.map((r) => r.card.id));
  return rows.map((r) => toItemDto(r.item, r.card, prices.get(r.card.id) ?? []));
}

function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export async function listItems(
  tenantId: string,
  collectorId: string,
  query: ListItemsQuery,
): Promise<{ items: ItemDto[]; nextCursor: string | null }> {
  const filters: SQL[] = [itemScope(tenantId, collectorId)];
  if (query.q) filters.push(ilike(cardCatalog.name, `%${escapeLike(query.q)}%`));
  if (query.language) filters.push(eq(cardCatalog.language, query.language));
  if (query.setId) filters.push(eq(cardCatalog.setId, query.setId));
  if (query.favorite !== undefined) filters.push(eq(collectionItems.isFavorite, query.favorite));

  const offset = query.cursor ?? 0;
  const base = db
    .select({ item: collectionItems, card: cardCatalog })
    .from(collectionItems)
    .innerJoin(cardCatalog, eq(cardCatalog.id, collectionItems.catalogCardId))
    .where(and(...filters))
    .$dynamic();

  let page: ItemDto[];
  let hasMore: boolean;

  if (query.sort === "value") {
    // Value depends on the current price, which isn't a column — sort the collector's whole
    // (filtered) collection in memory. Fine at family scale (hundreds of rows).
    const all = await toDtos(await base);
    all.sort(
      (a, b) =>
        (b._lineCents ?? -1) - (a._lineCents ?? -1) || b.addedAt.localeCompare(a.addedAt) || a.id.localeCompare(b.id),
    );
    page = all.slice(offset, offset + query.limit);
    hasMore = all.length > offset + query.limit;
  } else {
    const order = {
      added: [desc(collectionItems.createdAt), asc(collectionItems.id)],
      name: [asc(cardCatalog.name), asc(collectionItems.id)],
      set: [asc(cardCatalog.setName), asc(cardCatalog.localId), asc(collectionItems.id)],
    }[query.sort];
    const rows = await base.orderBy(...order).limit(query.limit + 1).offset(offset);
    hasMore = rows.length > query.limit;
    page = await toDtos(rows.slice(0, query.limit));
  }

  return { items: page, nextCursor: hasMore ? String(offset + query.limit) : null };
}

async function getItemRow(tenantId: string, collectorId: string, itemId: string): Promise<CollectionItemRow | null> {
  const [row] = await db
    .select()
    .from(collectionItems)
    .where(and(itemScope(tenantId, collectorId), eq(collectionItems.id, itemId)))
    .limit(1);
  return row ?? null;
}

export async function getItem(tenantId: string, collectorId: string, itemId: string): Promise<ItemDto | null> {
  const rows = await db
    .select({ item: collectionItems, card: cardCatalog })
    .from(collectionItems)
    .innerJoin(cardCatalog, eq(cardCatalog.id, collectionItems.catalogCardId))
    .where(and(itemScope(tenantId, collectorId), eq(collectionItems.id, itemId)))
    .limit(1);
  if (rows.length === 0) return null;
  const [dto] = await toDtos(rows);
  return dto;
}

// ── Mutations ─────────────────────────────────────────────────────────────────

/**
 * Add a scanned card. If the collector already owns that card in the same printing and
 * condition, its quantity goes up instead of a duplicate row being created.
 */
export async function addItem(
  tenantId: string,
  collectorId: string,
  createdBy: string,
  input: AddItemInput,
): Promise<{ item: ItemDto; created: boolean }> {
  const card = await upsertCatalogCard(input.card);
  await recordClientPrices(card.id, input.prices);

  const [row] = await db
    .insert(collectionItems)
    .values({
      id: generateId(),
      tenantId,
      collectorId,
      catalogCardId: card.id,
      variant: input.variant,
      condition: input.condition,
      quantity: input.quantity,
      createdBy,
    })
    .onConflictDoUpdate({
      target: [collectionItems.collectorId, collectionItems.catalogCardId, collectionItems.variant, collectionItems.condition],
      set: { quantity: sql`${collectionItems.quantity} + excluded.quantity`, updatedAt: new Date() },
      // The unique key has no tenant column; this guard makes sure a conflict can only ever
      // touch a row of this tenant (collector ids are already tenant-scoped, so it's belt and braces).
      setWhere: eq(collectionItems.tenantId, tenantId),
    })
    .returning({ id: collectionItems.id, created: sql<boolean>`(xmax = 0)` });

  if (!row) throw new Error("Item upsert returned no row.");
  const item = await getItem(tenantId, collectorId, row.id);
  if (!item) throw new Error("Item vanished after upsert.");
  return { item, created: row.created };
}

/**
 * Edit an item. Changing its printing/condition into one the collector already owns merges
 * the two rows (quantities summed); the surviving row is returned with `mergedIntoId` set.
 */
export async function updateItem(
  tenantId: string,
  collectorId: string,
  itemId: string,
  patch: PatchItemInput,
): Promise<{ item: ItemDto; mergedIntoId: string | null } | null> {
  const current = await getItemRow(tenantId, collectorId, itemId);
  if (!current) return null;

  const variant = patch.variant ?? current.variant;
  const condition = patch.condition ?? current.condition;
  const keyChanged = variant !== current.variant || condition !== current.condition;

  if (keyChanged) {
    const [target] = await db
      .select()
      .from(collectionItems)
      .where(
        and(
          itemScope(tenantId, collectorId),
          eq(collectionItems.catalogCardId, current.catalogCardId),
          eq(collectionItems.variant, variant),
          eq(collectionItems.condition, condition),
        ),
      )
      .limit(1);

    if (target) {
      const merged = mergeItems(current, target, patch);
      // neon-http has no interactive transactions; db.batch runs both statements in one.
      await db.batch([
        db
          .update(collectionItems)
          .set({ ...merged, updatedAt: new Date() })
          .where(and(itemScope(tenantId, collectorId), eq(collectionItems.id, target.id))),
        db.delete(collectionItems).where(and(itemScope(tenantId, collectorId), eq(collectionItems.id, current.id))),
      ]);
      const item = await getItem(tenantId, collectorId, target.id);
      if (!item) throw new Error("Merged item vanished.");
      return { item, mergedIntoId: target.id };
    }
  }

  try {
    await db
      .update(collectionItems)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(itemScope(tenantId, collectorId), eq(collectionItems.id, itemId)));
  } catch (err) {
    // Another request created the colliding row between our check and this update.
    if (isUniqueViolation(err)) throw new ApiError(409, "conflict", "The collection changed meanwhile; retry the edit.");
    throw err;
  }

  const item = await getItem(tenantId, collectorId, itemId);
  return item ? { item, mergedIntoId: null } : null;
}

export async function deleteItem(tenantId: string, collectorId: string, itemId: string): Promise<CollectionItemRow | null> {
  const [row] = await db
    .delete(collectionItems)
    .where(and(itemScope(tenantId, collectorId), eq(collectionItems.id, itemId)))
    .returning();
  return row ?? null;
}

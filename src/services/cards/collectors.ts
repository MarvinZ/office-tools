import { and, asc, eq, type InferSelectModel } from "drizzle-orm";
import { db } from "@/db";
import { cardCollectors, collectionItems } from "@/db/schema";
import { generateId } from "@/lib/ids";
import { CurrencyTotals } from "@/lib/cards/money";
import { lineValueCents, resolveItemPrice } from "@/lib/cards/pricing";
import { getCurrentPrices } from "./prices";

// ── Raw row types ─────────────────────────────────────────────────────────────

export type CollectorRow = InferSelectModel<typeof cardCollectors>;

export type CollectorTotals = { cardCount: number; totalValue: Record<string, string> };

// ── Queries ───────────────────────────────────────────────────────────────────

export async function getCollector(tenantId: string, id: string): Promise<CollectorRow | null> {
  const [row] = await db
    .select()
    .from(cardCollectors)
    .where(and(eq(cardCollectors.tenantId, tenantId), eq(cardCollectors.id, id)))
    .limit(1);
  return row ?? null;
}

export async function listCollectors(tenantId: string): Promise<CollectorRow[]> {
  return db
    .select()
    .from(cardCollectors)
    .where(eq(cardCollectors.tenantId, tenantId))
    .orderBy(asc(cardCollectors.displayName));
}

/** Card count (sum of quantities) and per-currency value for every collector in the family. */
export async function getCollectorTotals(tenantId: string): Promise<Map<string, CollectorTotals>> {
  const items = await db
    .select({
      collectorId: collectionItems.collectorId,
      catalogCardId: collectionItems.catalogCardId,
      variant: collectionItems.variant,
      quantity: collectionItems.quantity,
    })
    .from(collectionItems)
    .where(eq(collectionItems.tenantId, tenantId));

  const prices = await getCurrentPrices(items.map((i) => i.catalogCardId));
  const acc = new Map<string, { cardCount: number; totals: CurrencyTotals }>();

  for (const item of items) {
    const entry = acc.get(item.collectorId) ?? { cardCount: 0, totals: new CurrencyTotals() };
    entry.cardCount += item.quantity;
    const price = resolveItemPrice(prices.get(item.catalogCardId) ?? [], item.variant);
    if (price) entry.totals.add(price.currency, lineValueCents(price, item.quantity));
    acc.set(item.collectorId, entry);
  }

  return new Map([...acc].map(([id, e]) => [id, { cardCount: e.cardCount, totalValue: e.totals.toJSON() }]));
}

// ── Mutations ─────────────────────────────────────────────────────────────────

/**
 * The caller's collector row, created on their first API call. `loadDisplayName` (a Clerk
 * lookup) only runs when the row doesn't exist yet, so normal requests never call Clerk.
 */
export async function getOrCreateCollector(
  tenantId: string,
  clerkUserId: string,
  loadDisplayName: () => Promise<string>,
): Promise<CollectorRow> {
  const existing = await findCollectorByUser(tenantId, clerkUserId);
  if (existing) return existing;

  await db
    .insert(cardCollectors)
    .values({ id: generateId(), tenantId, clerkUserId, displayName: await loadDisplayName() })
    .onConflictDoNothing(); // two first requests racing: the loser re-reads the winner's row

  const created = await findCollectorByUser(tenantId, clerkUserId);
  if (!created) throw new Error("Collector upsert returned no row.");
  return created;
}

async function findCollectorByUser(tenantId: string, clerkUserId: string): Promise<CollectorRow | null> {
  const [row] = await db
    .select()
    .from(cardCollectors)
    .where(and(eq(cardCollectors.tenantId, tenantId), eq(cardCollectors.clerkUserId, clerkUserId)))
    .limit(1);
  return row ?? null;
}

export async function updateCollector(
  tenantId: string,
  id: string,
  data: { displayName?: string; isPrivate?: boolean },
): Promise<CollectorRow> {
  const [row] = await db
    .update(cardCollectors)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(cardCollectors.tenantId, tenantId), eq(cardCollectors.id, id)))
    .returning();
  return row;
}

import { eq, and, desc } from "drizzle-orm";
import { db } from "@/db";
import { barberTips, barbers } from "@/db/schema";
import type { InferSelectModel } from "drizzle-orm";

// ── Raw row types ─────────────────────────────────────────────────────────────

export type TipRow = InferSelectModel<typeof barberTips>;

// ── UI-ready types ────────────────────────────────────────────────────────────

export type TipWithBarberName = TipRow & { barberName: string };

// ── Validation ────────────────────────────────────────────────────────────────

async function assertBarberBelongsToTenant(tenantId: string, barberId: string): Promise<void> {
  const [barber] = await db
    .select({ id: barbers.id })
    .from(barbers)
    .where(and(eq(barbers.tenantId, tenantId), eq(barbers.id, barberId)))
    .limit(1);
  if (!barber) throw new Error("Barber not found for this tenant.");
}

// ── Queries ───────────────────────────────────────────────────────────────────

export type ListTipsFilter = {
  barberId?: string;
};

/**
 * Tips for this tenant, most recent first. `tipDate` is the business-meaningful
 * ordering key; `createdAt` only breaks ties between tips dated the same day.
 */
export async function listTips(
  tenantId: string,
  filter: ListTipsFilter = {}
): Promise<TipWithBarberName[]> {
  const conditions = [eq(barberTips.tenantId, tenantId)];
  if (filter.barberId) conditions.push(eq(barberTips.barberId, filter.barberId));

  const rows = await db
    .select({
      id: barberTips.id,
      tenantId: barberTips.tenantId,
      barberId: barberTips.barberId,
      amount: barberTips.amount,
      tipDate: barberTips.tipDate,
      note: barberTips.note,
      createdBy: barberTips.createdBy,
      createdAt: barberTips.createdAt,
      firstName: barbers.firstName,
      lastName: barbers.lastName,
    })
    .from(barberTips)
    .innerJoin(barbers, eq(barbers.id, barberTips.barberId))
    .where(and(...conditions))
    .orderBy(desc(barberTips.tipDate), desc(barberTips.createdAt));

  return rows.map(({ firstName, lastName, ...row }) => ({
    ...row,
    barberName: `${firstName} ${lastName}`,
  }));
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export type TipInput = {
  barberId: string;
  amount: number;
  tipDate: string; // YYYY-MM-DD
  note?: string;
};

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Record a tip owed to a barber. Stored exactly as given: tips carry no IVA and
 * are added in full to the settlement transfer (never to the invoice).
 */
export async function createTip(
  tenantId: string,
  createdBy: string,
  data: TipInput
): Promise<TipRow> {
  // Never trust a client-submitted barberId: it must belong to THIS tenant.
  await assertBarberBelongsToTenant(tenantId, data.barberId);

  if (!DATE_ONLY_RE.test(data.tipDate)) {
    throw new Error(`Expected a YYYY-MM-DD date, got: ${data.tipDate}`);
  }
  if (!Number.isFinite(data.amount) || data.amount <= 0) {
    throw new Error("Tip amount must be a positive number.");
  }

  const [row] = await db
    .insert(barberTips)
    .values({
      id: crypto.randomUUID(),
      tenantId,
      barberId: data.barberId,
      amount: String(data.amount),
      tipDate: data.tipDate,
      note: data.note?.trim() ? data.note.trim() : null,
      createdBy,
    })
    .returning();
  return row;
}

/**
 * Deletion is the ONLY correction path — there is no update function, by
 * design. Always scoped by tenantId AND id together, never by id alone.
 */
export async function deleteTip(tenantId: string, id: string): Promise<void> {
  await db
    .delete(barberTips)
    .where(and(eq(barberTips.tenantId, tenantId), eq(barberTips.id, id)));
}

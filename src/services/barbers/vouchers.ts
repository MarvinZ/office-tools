import { eq, and, desc } from "drizzle-orm";
import { db } from "@/db";
import { barberVouchers, barbers } from "@/db/schema";
import type { InferSelectModel } from "drizzle-orm";

// ── Raw row types ─────────────────────────────────────────────────────────────

export type VoucherRow = InferSelectModel<typeof barberVouchers>;

// ── UI-ready types ────────────────────────────────────────────────────────────

export type VoucherWithBarberName = VoucherRow & { barberName: string };

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

export type ListVouchersFilter = {
  barberId?: string;
};

/**
 * Vales for this tenant, most recently issued first. `issuedDate` is the
 * business-meaningful ordering key (the day the cash was handed over);
 * `createdAt` only breaks ties between several vales dated the same day.
 */
export async function listVouchers(
  tenantId: string,
  filter: ListVouchersFilter = {}
): Promise<VoucherWithBarberName[]> {
  const conditions = [eq(barberVouchers.tenantId, tenantId)];
  if (filter.barberId) conditions.push(eq(barberVouchers.barberId, filter.barberId));

  const rows = await db
    .select({
      id: barberVouchers.id,
      tenantId: barberVouchers.tenantId,
      barberId: barberVouchers.barberId,
      amount: barberVouchers.amount,
      issuedDate: barberVouchers.issuedDate,
      note: barberVouchers.note,
      createdBy: barberVouchers.createdBy,
      createdAt: barberVouchers.createdAt,
      firstName: barbers.firstName,
      lastName: barbers.lastName,
    })
    .from(barberVouchers)
    .innerJoin(barbers, eq(barbers.id, barberVouchers.barberId))
    .where(and(...conditions))
    .orderBy(desc(barberVouchers.issuedDate), desc(barberVouchers.createdAt));

  return rows.map(({ firstName, lastName, ...row }) => ({
    ...row,
    barberName: `${firstName} ${lastName}`,
  }));
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export type VoucherInput = {
  barberId: string;
  amount: number;
  issuedDate: string; // YYYY-MM-DD
  note?: string;
};

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Record a vale. The amount is stored exactly as given — no commission, fee or
 * tax math is applied, and nothing from activities.ts is involved: a vale is
 * cash handed over, not earnings.
 */
export async function createVoucher(
  tenantId: string,
  createdBy: string,
  data: VoucherInput
): Promise<VoucherRow> {
  // Never trust a client-submitted barberId: it must belong to THIS tenant.
  await assertBarberBelongsToTenant(tenantId, data.barberId);

  if (!DATE_ONLY_RE.test(data.issuedDate)) {
    throw new Error(`Expected a YYYY-MM-DD date, got: ${data.issuedDate}`);
  }
  if (!Number.isFinite(data.amount) || data.amount <= 0) {
    throw new Error("Vale amount must be a positive number.");
  }

  const [row] = await db
    .insert(barberVouchers)
    .values({
      id: crypto.randomUUID(),
      tenantId,
      barberId: data.barberId,
      amount: String(data.amount),
      issuedDate: data.issuedDate,
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
export async function deleteVoucher(tenantId: string, id: string): Promise<void> {
  await db
    .delete(barberVouchers)
    .where(and(eq(barberVouchers.tenantId, tenantId), eq(barberVouchers.id, id)));
}

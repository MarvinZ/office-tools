import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { barberDailyRoster, barbers, locations } from "@/db/schema";

// ── Types ─────────────────────────────────────────────────────────────────────

export type RosterBarber = {
  barberId: string;
  firstName: string;
  lastName: string;
  checkedInAt: Date;
};

// ── Validation ────────────────────────────────────────────────────────────────

async function assertLocationAndBarberBelongToTenant(
  tenantId: string,
  locationId: string,
  barberId: string
): Promise<void> {
  const [[location], [barber]] = await Promise.all([
    db.select({ id: locations.id }).from(locations).where(and(eq(locations.tenantId, tenantId), eq(locations.id, locationId))).limit(1),
    db.select({ id: barbers.id }).from(barbers).where(and(eq(barbers.tenantId, tenantId), eq(barbers.id, barberId))).limit(1),
  ]);
  if (!location) throw new Error("Location not found for this tenant.");
  if (!barber) throw new Error("Barber not found for this tenant.");
}

// ── Queries ───────────────────────────────────────────────────────────────────

/** Barbers checked in to work at this location on this calendar day (YYYY-MM-DD). */
export async function listRoster(
  tenantId: string,
  locationId: string,
  workDate: string
): Promise<RosterBarber[]> {
  const rows = await db
    .select({
      barberId: barberDailyRoster.barberId,
      firstName: barbers.firstName,
      lastName: barbers.lastName,
      checkedInAt: barberDailyRoster.checkedInAt,
    })
    .from(barberDailyRoster)
    .innerJoin(barbers, eq(barbers.id, barberDailyRoster.barberId))
    .where(
      and(
        eq(barberDailyRoster.tenantId, tenantId),
        eq(barberDailyRoster.locationId, locationId),
        eq(barberDailyRoster.workDate, workDate)
      )
    )
    .orderBy(barbers.firstName, barbers.lastName);

  return rows;
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export async function checkInBarber(
  tenantId: string,
  locationId: string,
  barberId: string,
  workDate: string
): Promise<void> {
  await assertLocationAndBarberBelongToTenant(tenantId, locationId, barberId);

  await db
    .insert(barberDailyRoster)
    .values({ tenantId, locationId, barberId, workDate })
    .onConflictDoNothing();
}

export async function checkOutBarber(
  tenantId: string,
  locationId: string,
  barberId: string,
  workDate: string
): Promise<void> {
  await db
    .delete(barberDailyRoster)
    .where(
      and(
        eq(barberDailyRoster.tenantId, tenantId),
        eq(barberDailyRoster.locationId, locationId),
        eq(barberDailyRoster.barberId, barberId),
        eq(barberDailyRoster.workDate, workDate)
      )
    );
}

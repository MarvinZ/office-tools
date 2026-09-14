import { eq, and, inArray } from "drizzle-orm";
import { db } from "@/db";
import { barbers, barberLocations, locations, services, barberServiceRates } from "@/db/schema";
import { resolveEffectiveCommissionRates } from "./activities";
import type { InferSelectModel } from "drizzle-orm";

// ── Raw row types ─────────────────────────────────────────────────────────────

export type BarberRow = InferSelectModel<typeof barbers>;

// ── Composite types ───────────────────────────────────────────────────────────

export type BarberAssignedLocation = {
  locationId: string;
  name: string;
  status: "active" | "inactive";
};

export type BarberEffectiveRate = {
  serviceId: string;
  serviceName: string;
  category: string | null;
  defaultCommissionRate: number;
  commissionRate: number; // effective rate: override if present, else default
  source: "override" | "default";
};

export type BarberWithRelations = BarberRow & {
  assignedLocations: BarberAssignedLocation[];
  effectiveRates: BarberEffectiveRate[];
};

// ── Queries ───────────────────────────────────────────────────────────────────

export async function listBarbers(tenantId: string): Promise<BarberRow[]> {
  return db
    .select()
    .from(barbers)
    .where(eq(barbers.tenantId, tenantId))
    .orderBy(barbers.firstName, barbers.lastName);
}

/** Active barbers permanently assigned to work at this location (barberLocations). */
export async function listBarbersAtLocation(tenantId: string, locationId: string): Promise<BarberRow[]> {
  return db
    .select({
      id: barbers.id,
      tenantId: barbers.tenantId,
      firstName: barbers.firstName,
      lastName: barbers.lastName,
      phone: barbers.phone,
      email: barbers.email,
      status: barbers.status,
      notes: barbers.notes,
      tags: barbers.tags,
      createdBy: barbers.createdBy,
      createdAt: barbers.createdAt,
      updatedAt: barbers.updatedAt,
    })
    .from(barberLocations)
    .innerJoin(barbers, eq(barbers.id, barberLocations.barberId))
    .where(
      and(
        eq(barberLocations.tenantId, tenantId),
        eq(barberLocations.locationId, locationId),
        eq(barbers.status, "active")
      )
    )
    .orderBy(barbers.firstName, barbers.lastName);
}

export async function getBarber(tenantId: string, id: string): Promise<BarberWithRelations | null> {
  const [row] = await db
    .select()
    .from(barbers)
    .where(and(eq(barbers.tenantId, tenantId), eq(barbers.id, id)))
    .limit(1);

  if (!row) return null;

  const [locationRows, activeServices] = await Promise.all([
    db
      .select({ locationId: barberLocations.locationId, name: locations.name, status: locations.status })
      .from(barberLocations)
      .innerJoin(locations, eq(locations.id, barberLocations.locationId))
      .where(and(eq(barberLocations.tenantId, tenantId), eq(barberLocations.barberId, id))),
    // Only active services are offered for rate configuration — status filtering
    // is this list-builder's concern, not the rate resolver's.
    db
      .select()
      .from(services)
      .where(and(eq(services.tenantId, tenantId), eq(services.status, "active")))
      .orderBy(services.name),
  ]);

  // Single canonical "override else default" resolution (shared with logActivity).
  const rateByService = await resolveEffectiveCommissionRates(tenantId, id, activeServices);

  return {
    ...row,
    assignedLocations: locationRows.map((r) => ({ locationId: r.locationId, name: r.name, status: r.status })),
    effectiveRates: activeServices.map((s) => {
      const resolved = rateByService.get(s.id)!;
      return {
        serviceId: s.id,
        serviceName: s.name,
        category: s.category,
        defaultCommissionRate: resolved.defaultCommissionRate,
        commissionRate: resolved.rate,
        source: resolved.source,
      };
    }),
  };
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export type BarberInput = {
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
  status: BarberRow["status"];
  notes?: string;
  tags?: string[];
};

export async function createBarber(
  tenantId: string,
  createdBy: string,
  data: BarberInput
): Promise<BarberRow> {
  const [row] = await db
    .insert(barbers)
    .values({
      id: crypto.randomUUID(),
      tenantId,
      createdBy,
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone ?? null,
      email: data.email ?? null,
      status: data.status,
      notes: data.notes ?? null,
      tags: data.tags ?? [],
    })
    .returning();
  return row;
}

export async function updateBarber(
  tenantId: string,
  id: string,
  data: Partial<BarberInput>
): Promise<BarberRow | null> {
  const [row] = await db
    .update(barbers)
    .set({
      ...data,
      phone: data.phone !== undefined ? (data.phone ?? null) : undefined,
      email: data.email !== undefined ? (data.email ?? null) : undefined,
      notes: data.notes !== undefined ? (data.notes ?? null) : undefined,
      updatedAt: new Date(),
    })
    .where(and(eq(barbers.tenantId, tenantId), eq(barbers.id, id)))
    .returning();
  return row ?? null;
}

// ── Barber <-> Location assignment (replace-all semantics) ──────────────────

export async function setBarberLocations(
  tenantId: string,
  barberId: string,
  locationIds: string[]
): Promise<void> {
  // Validate the barber belongs to this tenant.
  const [barber] = await db
    .select({ id: barbers.id })
    .from(barbers)
    .where(and(eq(barbers.tenantId, tenantId), eq(barbers.id, barberId)))
    .limit(1);
  if (!barber) throw new Error("Barber not found for this tenant.");

  // Validate every location id actually belongs to this tenant.
  const uniqueIds = Array.from(new Set(locationIds));
  if (uniqueIds.length > 0) {
    const validLocations = await db
      .select({ id: locations.id })
      .from(locations)
      .where(and(eq(locations.tenantId, tenantId), inArray(locations.id, uniqueIds)));
    if (validLocations.length !== uniqueIds.length) {
      throw new Error("One or more locations do not belong to this tenant.");
    }
  }

  // The Neon HTTP driver used by this project does not support transactions,
  // so this can't be a delete-all-then-insert-all inside one. Instead, diff
  // against the current assignments and issue only the adds/removes needed —
  // this also avoids a brief window with zero locations assigned.
  const currentRows = await db
    .select({ locationId: barberLocations.locationId })
    .from(barberLocations)
    .where(and(eq(barberLocations.tenantId, tenantId), eq(barberLocations.barberId, barberId)));
  const currentIds = new Set(currentRows.map((r) => r.locationId));
  const nextIds = new Set(uniqueIds);

  const toAdd = uniqueIds.filter((id) => !currentIds.has(id));
  const toRemove = Array.from(currentIds).filter((id) => !nextIds.has(id));

  if (toRemove.length > 0) {
    await db
      .delete(barberLocations)
      .where(
        and(
          eq(barberLocations.tenantId, tenantId),
          eq(barberLocations.barberId, barberId),
          inArray(barberLocations.locationId, toRemove)
        )
      );
  }
  if (toAdd.length > 0) {
    await db
      .insert(barberLocations)
      .values(toAdd.map((locationId) => ({ barberId, locationId, tenantId })))
      .onConflictDoNothing();
  }
}

// ── Barber <-> Service commission overrides ──────────────────────────────────

async function assertBarberAndServiceBelongToTenant(
  tenantId: string,
  barberId: string,
  serviceId: string
): Promise<void> {
  const [[barber], [service]] = await Promise.all([
    db.select({ id: barbers.id }).from(barbers).where(and(eq(barbers.tenantId, tenantId), eq(barbers.id, barberId))).limit(1),
    db.select({ id: services.id }).from(services).where(and(eq(services.tenantId, tenantId), eq(services.id, serviceId))).limit(1),
  ]);
  if (!barber) throw new Error("Barber not found for this tenant.");
  if (!service) throw new Error("Service not found for this tenant.");
}

export async function setBarberServiceRate(
  tenantId: string,
  barberId: string,
  serviceId: string,
  commissionRate: number
): Promise<void> {
  await assertBarberAndServiceBelongToTenant(tenantId, barberId, serviceId);

  await db
    .insert(barberServiceRates)
    .values({
      barberId,
      serviceId,
      tenantId,
      commissionRate: String(commissionRate),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [barberServiceRates.tenantId, barberServiceRates.barberId, barberServiceRates.serviceId],
      set: { commissionRate: String(commissionRate), updatedAt: new Date() },
    });
}

export async function removeBarberServiceRate(
  tenantId: string,
  barberId: string,
  serviceId: string
): Promise<void> {
  await assertBarberAndServiceBelongToTenant(tenantId, barberId, serviceId);

  await db
    .delete(barberServiceRates)
    .where(
      and(
        eq(barberServiceRates.tenantId, tenantId),
        eq(barberServiceRates.barberId, barberId),
        eq(barberServiceRates.serviceId, serviceId)
      )
    );
}

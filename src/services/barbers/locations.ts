import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { locations, barberLocations, barbers, locationServices, services } from "@/db/schema";
import type { InferSelectModel } from "drizzle-orm";

// ── Raw row types ─────────────────────────────────────────────────────────────

export type LocationRow = InferSelectModel<typeof locations>;

// ── Composite types ───────────────────────────────────────────────────────────

export type LocationAssignedBarber = {
  barberId: string;
  firstName: string;
  lastName: string;
  status: "active" | "inactive";
};

export type LocationServicePriceItem = {
  serviceId: string;
  serviceName: string;
  category: string | null;
  status: "active" | "inactive";
  price: number | null; // null = unset at this location
};

export type LocationWithRelations = LocationRow & {
  assignedBarbers: LocationAssignedBarber[];
  servicePrices: LocationServicePriceItem[];
};

// ── Queries ───────────────────────────────────────────────────────────────────

export async function listLocations(tenantId: string): Promise<LocationRow[]> {
  return db
    .select()
    .from(locations)
    .where(eq(locations.tenantId, tenantId))
    .orderBy(locations.name);
}

export async function getLocation(tenantId: string, id: string): Promise<LocationWithRelations | null> {
  const [row] = await db
    .select()
    .from(locations)
    .where(and(eq(locations.tenantId, tenantId), eq(locations.id, id)))
    .limit(1);

  if (!row) return null;

  const [assignedRows, allServices, priceRows] = await Promise.all([
    db
      .select({ barberId: barberLocations.barberId, firstName: barbers.firstName, lastName: barbers.lastName, status: barbers.status })
      .from(barberLocations)
      .innerJoin(barbers, eq(barbers.id, barberLocations.barberId))
      .where(and(eq(barberLocations.tenantId, tenantId), eq(barberLocations.locationId, id))),
    db
      .select()
      .from(services)
      .where(eq(services.tenantId, tenantId))
      .orderBy(services.name),
    db
      .select()
      .from(locationServices)
      .where(and(eq(locationServices.tenantId, tenantId), eq(locationServices.locationId, id))),
  ]);

  const priceByService = new Map(priceRows.map((p) => [p.serviceId, parseFloat(p.price)]));

  return {
    ...row,
    assignedBarbers: assignedRows.map((r) => ({
      barberId: r.barberId,
      firstName: r.firstName,
      lastName: r.lastName,
      status: r.status,
    })),
    servicePrices: allServices.map((s) => ({
      serviceId: s.id,
      serviceName: s.name,
      category: s.category,
      status: s.status,
      price: priceByService.get(s.id) ?? null,
    })),
  };
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export type LocationInput = {
  name: string;
  addressStreet?: string;
  addressCity?: string;
  addressState?: string;
  addressZip?: string;
  addressCountry?: string;
  phone?: string;
  status: LocationRow["status"];
  tags?: string[];
};

export async function createLocation(
  tenantId: string,
  createdBy: string,
  data: LocationInput
): Promise<LocationRow> {
  const [row] = await db
    .insert(locations)
    .values({
      id: crypto.randomUUID(),
      tenantId,
      createdBy,
      name: data.name,
      addressStreet: data.addressStreet ?? null,
      addressCity: data.addressCity ?? null,
      addressState: data.addressState ?? null,
      addressZip: data.addressZip ?? null,
      addressCountry: data.addressCountry ?? null,
      phone: data.phone ?? null,
      status: data.status,
      tags: data.tags ?? [],
    })
    .returning();
  return row;
}

export async function updateLocation(
  tenantId: string,
  id: string,
  data: Partial<LocationInput>
): Promise<LocationRow | null> {
  const [row] = await db
    .update(locations)
    .set({
      ...data,
      addressStreet: data.addressStreet !== undefined ? (data.addressStreet ?? null) : undefined,
      addressCity: data.addressCity !== undefined ? (data.addressCity ?? null) : undefined,
      addressState: data.addressState !== undefined ? (data.addressState ?? null) : undefined,
      addressZip: data.addressZip !== undefined ? (data.addressZip ?? null) : undefined,
      addressCountry: data.addressCountry !== undefined ? (data.addressCountry ?? null) : undefined,
      phone: data.phone !== undefined ? (data.phone ?? null) : undefined,
      updatedAt: new Date(),
    })
    .where(and(eq(locations.tenantId, tenantId), eq(locations.id, id)))
    .returning();
  return row ?? null;
}

// ── Location service prices ──────────────────────────────────────────────────

async function assertLocationAndServiceBelongToTenant(
  tenantId: string,
  locationId: string,
  serviceId: string
): Promise<void> {
  const [[location], [service]] = await Promise.all([
    db.select({ id: locations.id }).from(locations).where(and(eq(locations.tenantId, tenantId), eq(locations.id, locationId))).limit(1),
    db.select({ id: services.id }).from(services).where(and(eq(services.tenantId, tenantId), eq(services.id, serviceId))).limit(1),
  ]);
  if (!location) throw new Error("Location not found for this tenant.");
  if (!service) throw new Error("Service not found for this tenant.");
}

export async function setLocationServicePrice(
  tenantId: string,
  locationId: string,
  serviceId: string,
  price: number
): Promise<void> {
  await assertLocationAndServiceBelongToTenant(tenantId, locationId, serviceId);

  await db
    .insert(locationServices)
    .values({
      locationId,
      serviceId,
      tenantId,
      price: String(price),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [locationServices.tenantId, locationServices.locationId, locationServices.serviceId],
      set: { price: String(price), updatedAt: new Date() },
    });
}

export async function removeLocationServicePrice(
  tenantId: string,
  locationId: string,
  serviceId: string
): Promise<void> {
  await assertLocationAndServiceBelongToTenant(tenantId, locationId, serviceId);

  await db
    .delete(locationServices)
    .where(
      and(
        eq(locationServices.tenantId, tenantId),
        eq(locationServices.locationId, locationId),
        eq(locationServices.serviceId, serviceId)
      )
    );
}

import { eq, and, gte, desc, count, inArray } from "drizzle-orm";
import { db } from "@/db";
import { services, locationServices, barberServiceRates, locations, barbers, barberActivities } from "@/db/schema";
import type { InferSelectModel } from "drizzle-orm";

// ── Raw row types ─────────────────────────────────────────────────────────────

export type ServiceRow = InferSelectModel<typeof services>;
export type LocationServiceRow = InferSelectModel<typeof locationServices>;
export type BarberServiceRateRow = InferSelectModel<typeof barberServiceRates>;

// ── Composite types ───────────────────────────────────────────────────────────

export type ServiceLocationPrice = {
  locationId: string;
  locationName: string;
  price: number;
};

export type ServiceBarberOverride = {
  barberId: string;
  barberName: string;
  commissionRate: number;
};

export type ServiceWithPricing = ServiceRow & {
  locationPrices: ServiceLocationPrice[];
  barberOverrides: ServiceBarberOverride[];
};

// ── Queries ───────────────────────────────────────────────────────────────────

export async function listServices(tenantId: string): Promise<ServiceRow[]> {
  return db
    .select()
    .from(services)
    .where(eq(services.tenantId, tenantId))
    .orderBy(services.name);
}

export async function getService(tenantId: string, id: string): Promise<ServiceWithPricing | null> {
  const [row] = await db
    .select()
    .from(services)
    .where(and(eq(services.tenantId, tenantId), eq(services.id, id)))
    .limit(1);

  if (!row) return null;

  const [priceRows, overrideRows] = await Promise.all([
    db
      .select({ locationId: locationServices.locationId, locationName: locations.name, price: locationServices.price })
      .from(locationServices)
      .innerJoin(locations, eq(locations.id, locationServices.locationId))
      .where(and(eq(locationServices.tenantId, tenantId), eq(locationServices.serviceId, id))),
    db
      .select({ barberId: barberServiceRates.barberId, firstName: barbers.firstName, lastName: barbers.lastName, commissionRate: barberServiceRates.commissionRate })
      .from(barberServiceRates)
      .innerJoin(barbers, eq(barbers.id, barberServiceRates.barberId))
      .where(and(eq(barberServiceRates.tenantId, tenantId), eq(barberServiceRates.serviceId, id))),
  ]);

  return {
    ...row,
    locationPrices: priceRows.map((r) => ({
      locationId: r.locationId,
      locationName: r.locationName,
      price: parseFloat(r.price),
    })),
    barberOverrides: overrideRows.map((r) => ({
      barberId: r.barberId,
      barberName: `${r.firstName} ${r.lastName}`,
      commissionRate: parseFloat(r.commissionRate),
    })),
  };
}

/**
 * The services actually logged most often at THIS location recently — the
 * "favorites" row above the service picker, so the handful of services that make
 * up most of the day's work are one tap away instead of a search.
 *
 * Deliberately returns [] when there's no history (a brand-new location, or a
 * quiet window). The caller must then render nothing at all rather than fall
 * back to, say, the first N services alphabetically: a row labelled "most used
 * here" that was never learned from real activity would be a lie to the front
 * desk staff who trust it.
 *
 * Two queries: rank the ids by usage, then hydrate them into full active rows.
 * SQL `IN` does not preserve order, so rank order is re-applied in JS afterwards.
 */
export async function getMostUsedServicesAtLocation(
  tenantId: string,
  locationId: string,
  opts: { windowDays?: number; limit?: number } = {}
): Promise<ServiceRow[]> {
  const windowDays = opts.windowDays ?? 30;
  const limit = opts.limit ?? 8;

  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  const ranked = await db
    .select({ serviceId: barberActivities.serviceId, n: count() })
    .from(barberActivities)
    .where(
      and(
        eq(barberActivities.tenantId, tenantId),
        eq(barberActivities.locationId, locationId),
        gte(barberActivities.performedAt, since)
      )
    )
    .groupBy(barberActivities.serviceId)
    .orderBy(desc(count()))
    .limit(limit);

  if (ranked.length === 0) return [];

  const rankedIds = ranked.map((r) => r.serviceId);

  // Only surface services still active — a retired service shouldn't be offered
  // as a one-tap favorite even if it was popular last month.
  const rows = await db
    .select()
    .from(services)
    .where(
      and(
        eq(services.tenantId, tenantId),
        eq(services.status, "active"),
        inArray(services.id, rankedIds)
      )
    );

  const rankByid = new Map(rankedIds.map((id, i) => [id, i]));
  return rows.sort((a, b) => (rankByid.get(a.id) ?? 0) - (rankByid.get(b.id) ?? 0));
}

// ── Mutations ─────────────────────────────────────────────────────────────────
// Note: no delete function is implemented on purpose. Once a service has
// location_services / barber_service_rates / barber_activities referencing it,
// hard-deleting it would corrupt pricing config and historical payout records.
// Deactivating (status: "inactive") is the only supported way to retire a service.

export type ServiceInput = {
  name: string;
  category?: string;
  defaultCommissionRate: number;
  status: ServiceRow["status"];
  tags?: string[];
};

export async function createService(
  tenantId: string,
  createdBy: string,
  data: ServiceInput
): Promise<ServiceRow> {
  const [row] = await db
    .insert(services)
    .values({
      id: crypto.randomUUID(),
      tenantId,
      createdBy,
      name: data.name,
      category: data.category ?? null,
      defaultCommissionRate: String(data.defaultCommissionRate),
      status: data.status,
      tags: data.tags ?? [],
    })
    .returning();
  return row;
}

export async function updateService(
  tenantId: string,
  id: string,
  data: Partial<ServiceInput>
): Promise<ServiceRow | null> {
  const [row] = await db
    .update(services)
    .set({
      ...data,
      category: data.category !== undefined ? (data.category ?? null) : undefined,
      defaultCommissionRate: data.defaultCommissionRate != null ? String(data.defaultCommissionRate) : undefined,
      updatedAt: new Date(),
    })
    .where(and(eq(services.tenantId, tenantId), eq(services.id, id)))
    .returning();
  return row ?? null;
}

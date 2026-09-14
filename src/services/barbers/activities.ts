import { eq, and, gte, lte, desc } from "drizzle-orm";
import { db } from "@/db";
import { barberActivities, barbers, locations, services, barberServiceRates, locationServices } from "@/db/schema";
import type { InferSelectModel } from "drizzle-orm";

// ── Raw row types ─────────────────────────────────────────────────────────────

export type BarberActivityRow = InferSelectModel<typeof barberActivities>;

// ── UI-ready types ────────────────────────────────────────────────────────────

export type ActivityListItem = {
  id: string;
  tenantId: string;
  barberId: string;
  barberName: string;
  locationId: string;
  locationName: string;
  serviceId: string;
  serviceName: string;
  customerName: string | null;
  priceCharged: number;
  commissionRate: number;
  commissionAmount: number;
  performedAt: Date;
  createdBy: string;
  createdAt: Date;
};

// ── Resolvers ─────────────────────────────────────────────────────────────────

export type EffectiveCommissionRate = { rate: number; source: "override" | "default" };

/**
 * CANONICAL resolver for the effective commission rate of a barber+service:
 * the barber's override if one exists, otherwise the service's
 * default_commission_rate. Returns null if the service itself can't be found
 * for this tenant.
 *
 * Deliberately does NOT filter by service status. Status filtering is the
 * concern of whoever builds a *list* of services to offer the user (e.g. the
 * entry form only offers active services). Given an exact barberId+serviceId,
 * the rate that applies is well-defined regardless of whether the service is
 * currently active — historical corrections on retired services still need it.
 */
export async function getEffectiveCommissionRate(
  tenantId: string,
  barberId: string,
  serviceId: string
): Promise<EffectiveCommissionRate | null> {
  const [overrideRow] = await db
    .select({ commissionRate: barberServiceRates.commissionRate })
    .from(barberServiceRates)
    .where(
      and(
        eq(barberServiceRates.tenantId, tenantId),
        eq(barberServiceRates.barberId, barberId),
        eq(barberServiceRates.serviceId, serviceId)
      )
    )
    .limit(1);

  if (overrideRow) {
    return { rate: parseFloat(overrideRow.commissionRate), source: "override" };
  }

  const [serviceRow] = await db
    .select({ defaultCommissionRate: services.defaultCommissionRate })
    .from(services)
    .where(and(eq(services.tenantId, tenantId), eq(services.id, serviceId)))
    .limit(1);

  if (!serviceRow) return null;
  return { rate: parseFloat(serviceRow.defaultCommissionRate), source: "default" };
}

export type EffectiveRateForService = EffectiveCommissionRate & {
  serviceId: string;
  defaultCommissionRate: number;
};

/**
 * Batch form of {@link getEffectiveCommissionRate}: resolves the effective rate
 * for one barber across many services in two queries instead of 2N. Applies the
 * exact same "override else default" rule as the canonical single resolver, so
 * list views and the single-lookup path can never disagree.
 *
 * `serviceRows` is supplied by the caller, which is also what decides which
 * services belong in the list (e.g. active-only) — status filtering stays a
 * concern of the caller, not of rate resolution.
 */
export async function resolveEffectiveCommissionRates(
  tenantId: string,
  barberId: string,
  serviceRows: { id: string; defaultCommissionRate: string }[]
): Promise<Map<string, EffectiveRateForService>> {
  const overrideRows = await db
    .select({ serviceId: barberServiceRates.serviceId, commissionRate: barberServiceRates.commissionRate })
    .from(barberServiceRates)
    .where(and(eq(barberServiceRates.tenantId, tenantId), eq(barberServiceRates.barberId, barberId)));

  const overrideByService = new Map(overrideRows.map((o) => [o.serviceId, parseFloat(o.commissionRate)]));

  const result = new Map<string, EffectiveRateForService>();
  for (const s of serviceRows) {
    const override = overrideByService.get(s.id);
    const defaultRate = parseFloat(s.defaultCommissionRate);
    result.set(s.id, {
      serviceId: s.id,
      defaultCommissionRate: defaultRate,
      rate: override ?? defaultRate,
      source: override != null ? "override" : "default",
    });
  }
  return result;
}

export async function getLocationServicePrice(
  tenantId: string,
  locationId: string,
  serviceId: string
): Promise<number | null> {
  const [row] = await db
    .select({ price: locationServices.price })
    .from(locationServices)
    .where(
      and(
        eq(locationServices.tenantId, tenantId),
        eq(locationServices.locationId, locationId),
        eq(locationServices.serviceId, serviceId)
      )
    )
    .limit(1);

  return row ? parseFloat(row.price) : null;
}

// ── Mutations ─────────────────────────────────────────────────────────────────

/**
 * NOTE: there is deliberately no `commissionRate` field here. The rate is
 * authoritative payout data and is always resolved server-side from the DB via
 * getEffectiveCommissionRate — a caller must not be able to supply one.
 */
export type LogActivityInput = {
  barberId: string;
  locationId: string;
  serviceId: string;
  customerName?: string;
  priceCharged: number;
  performedAt?: string; // ISO datetime; defaults to now
};

async function assertActivityRefsBelongToTenant(
  tenantId: string,
  barberId: string,
  locationId: string,
  serviceId: string
): Promise<void> {
  const [[barber], [location], [service]] = await Promise.all([
    db.select({ id: barbers.id }).from(barbers).where(and(eq(barbers.tenantId, tenantId), eq(barbers.id, barberId))).limit(1),
    db.select({ id: locations.id }).from(locations).where(and(eq(locations.tenantId, tenantId), eq(locations.id, locationId))).limit(1),
    db.select({ id: services.id }).from(services).where(and(eq(services.tenantId, tenantId), eq(services.id, serviceId))).limit(1),
  ]);
  if (!barber) throw new Error("Barber not found for this tenant.");
  if (!location) throw new Error("Location not found for this tenant.");
  if (!service) throw new Error("Service not found for this tenant.");
}

/**
 * Log a barber activity. Both the commission RATE and the commission AMOUNT are
 * always resolved/computed server-side: the rate comes from the DB via
 * getEffectiveCommissionRate(barber, service) and the amount from
 * priceCharged * that rate. Nothing rate-related is ever trusted from the caller.
 */
export async function logActivity(
  tenantId: string,
  createdBy: string,
  data: LogActivityInput
): Promise<BarberActivityRow> {
  await assertActivityRefsBelongToTenant(tenantId, data.barberId, data.locationId, data.serviceId);

  const effective = await getEffectiveCommissionRate(tenantId, data.barberId, data.serviceId);
  if (!effective) throw new Error("Could not resolve a commission rate for this barber and service.");

  const commissionRate = effective.rate;
  const commissionAmount = Math.round(data.priceCharged * commissionRate * 100) / 100;

  const [row] = await db
    .insert(barberActivities)
    .values({
      id: crypto.randomUUID(),
      tenantId,
      barberId: data.barberId,
      locationId: data.locationId,
      serviceId: data.serviceId,
      customerName: data.customerName ?? null,
      priceCharged: String(data.priceCharged),
      commissionRate: String(commissionRate),
      commissionAmount: String(commissionAmount),
      performedAt: data.performedAt ? new Date(data.performedAt) : new Date(),
      createdBy,
    })
    .returning();
  return row;
}

export type ListActivitiesFilter = {
  barberId?: string;
  locationId?: string;
  dateFrom?: Date;
  dateTo?: Date;
};

export async function listActivities(
  tenantId: string,
  filter: ListActivitiesFilter = {}
): Promise<ActivityListItem[]> {
  const conditions = [eq(barberActivities.tenantId, tenantId)];
  if (filter.barberId) conditions.push(eq(barberActivities.barberId, filter.barberId));
  if (filter.locationId) conditions.push(eq(barberActivities.locationId, filter.locationId));
  if (filter.dateFrom) conditions.push(gte(barberActivities.performedAt, filter.dateFrom));
  if (filter.dateTo) conditions.push(lte(barberActivities.performedAt, filter.dateTo));

  const rows = await db
    .select({
      id: barberActivities.id,
      tenantId: barberActivities.tenantId,
      barberId: barberActivities.barberId,
      firstName: barbers.firstName,
      lastName: barbers.lastName,
      locationId: barberActivities.locationId,
      locationName: locations.name,
      serviceId: barberActivities.serviceId,
      serviceName: services.name,
      customerName: barberActivities.customerName,
      priceCharged: barberActivities.priceCharged,
      commissionRate: barberActivities.commissionRate,
      commissionAmount: barberActivities.commissionAmount,
      performedAt: barberActivities.performedAt,
      createdBy: barberActivities.createdBy,
      createdAt: barberActivities.createdAt,
    })
    .from(barberActivities)
    .innerJoin(barbers, eq(barbers.id, barberActivities.barberId))
    .innerJoin(locations, eq(locations.id, barberActivities.locationId))
    .innerJoin(services, eq(services.id, barberActivities.serviceId))
    .where(and(...conditions))
    .orderBy(desc(barberActivities.performedAt));

  return rows.map((r) => ({
    id: r.id,
    tenantId: r.tenantId,
    barberId: r.barberId,
    barberName: `${r.firstName} ${r.lastName}`,
    locationId: r.locationId,
    locationName: r.locationName,
    serviceId: r.serviceId,
    serviceName: r.serviceName,
    customerName: r.customerName,
    priceCharged: parseFloat(r.priceCharged),
    commissionRate: parseFloat(r.commissionRate),
    commissionAmount: parseFloat(r.commissionAmount),
    performedAt: r.performedAt,
    createdBy: r.createdBy,
    createdAt: r.createdAt,
  }));
}

/**
 * NOTE: as with LogActivityInput, there is deliberately no `commissionRate`
 * field. If barberId or serviceId change, the rate is re-resolved server-side.
 */
export type UpdateActivityInput = Partial<{
  barberId: string;
  locationId: string;
  serviceId: string;
  customerName: string | null;
  priceCharged: number;
  performedAt: string;
}>;

export async function updateActivity(
  tenantId: string,
  id: string,
  data: UpdateActivityInput
): Promise<BarberActivityRow | null> {
  const [existing] = await db
    .select()
    .from(barberActivities)
    .where(and(eq(barberActivities.tenantId, tenantId), eq(barberActivities.id, id)))
    .limit(1);
  if (!existing) return null;

  const barberId = data.barberId ?? existing.barberId;
  const locationId = data.locationId ?? existing.locationId;
  const serviceId = data.serviceId ?? existing.serviceId;

  const refsChanged =
    barberId !== existing.barberId ||
    locationId !== existing.locationId ||
    serviceId !== existing.serviceId;

  if (refsChanged) {
    await assertActivityRefsBelongToTenant(tenantId, barberId, locationId, serviceId);
  }

  // The rate is authoritative payout data: keep the snapshot taken at log time
  // unless the barber or the service changed, in which case re-resolve it from
  // the DB. It is never accepted from the caller.
  let commissionRate = parseFloat(existing.commissionRate);
  if (barberId !== existing.barberId || serviceId !== existing.serviceId) {
    const effective = await getEffectiveCommissionRate(tenantId, barberId, serviceId);
    if (!effective) throw new Error("Could not resolve a commission rate for this barber and service.");
    commissionRate = effective.rate;
  }

  // Recompute commissionAmount from the (possibly updated) price and the
  // server-resolved rate.
  const priceCharged = data.priceCharged ?? parseFloat(existing.priceCharged);
  const commissionAmount = Math.round(priceCharged * commissionRate * 100) / 100;

  const [row] = await db
    .update(barberActivities)
    .set({
      barberId: data.barberId != null ? barberId : undefined,
      locationId: data.locationId != null ? locationId : undefined,
      serviceId: data.serviceId != null ? serviceId : undefined,
      customerName: data.customerName !== undefined ? data.customerName : undefined,
      priceCharged: data.priceCharged != null ? String(data.priceCharged) : undefined,
      commissionRate: String(commissionRate),
      commissionAmount: String(commissionAmount),
      performedAt: data.performedAt ? new Date(data.performedAt) : undefined,
    })
    .where(and(eq(barberActivities.tenantId, tenantId), eq(barberActivities.id, id)))
    .returning();
  return row ?? null;
}

export async function deleteActivity(tenantId: string, id: string): Promise<void> {
  await db
    .delete(barberActivities)
    .where(and(eq(barberActivities.tenantId, tenantId), eq(barberActivities.id, id)));
}

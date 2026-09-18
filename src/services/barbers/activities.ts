import { eq, and, gte, lte, desc, inArray } from "drizzle-orm";
import { db } from "@/db";
import { barberActivities, barbers, locations, services, barberServiceRates, locationServices, paymentMethods } from "@/db/schema";
import { getPaymentMethodFeeRate } from "./payment-methods";
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
  paymentMethodId: string;
  paymentMethodName: string;
  paymentMethodFeeRate: number;
  customerName: string | null;
  priceCharged: number;
  commissionRate: number;
  commissionAmount: number;
  performedAt: Date;
  createdBy: string;
  createdAt: Date;
};

// ── Commission math ───────────────────────────────────────────────────────────

/**
 * THE canonical commission formula for this module. Three factors:
 *
 *   commissionAmount = priceCharged × effectiveCommissionRate × (1 − paymentMethodFeeRate)
 *
 * The payment method's processing fee is passed through to the barber, so paying
 * by card yields a smaller commission than the same sale in cash. Example:
 * ₡100 at a 50% commission rate on a credit card (6% fee) →
 * 100 × 0.50 × 0.94 = ₡47.00.
 *
 * Every write path (logActivity, logActivityBatch, updateActivity) must go
 * through this function so they can never drift apart.
 */
export function computeCommissionAmount(
  priceCharged: number,
  commissionRate: number,
  paymentMethodFeeRate: number
): number {
  return Math.round(priceCharged * commissionRate * (1 - paymentMethodFeeRate) * 100) / 100;
}

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
 * NOTE: there is deliberately no `commissionRate` or `paymentMethodFeeRate`
 * field here. Both are authoritative payout data and are always resolved
 * server-side from the DB (via getEffectiveCommissionRate and
 * getPaymentMethodFeeRate) — a caller must not be able to supply either.
 */
export type LogActivityInput = {
  barberId: string;
  locationId: string;
  serviceId: string;
  paymentMethodId: string;
  customerName?: string;
  priceCharged: number;
  performedAt?: string; // ISO datetime; defaults to now
};

async function assertActivityRefsBelongToTenant(
  tenantId: string,
  barberId: string,
  locationId: string,
  serviceId: string | null,
  paymentMethodId: string
): Promise<void> {
  const [[barber], [location], serviceRows, [paymentMethod]] = await Promise.all([
    db.select({ id: barbers.id }).from(barbers).where(and(eq(barbers.tenantId, tenantId), eq(barbers.id, barberId))).limit(1),
    db.select({ id: locations.id }).from(locations).where(and(eq(locations.tenantId, tenantId), eq(locations.id, locationId))).limit(1),
    // serviceId is null for the batch path, which validates its own (many)
    // service ids in one inArray query instead.
    serviceId == null
      ? Promise.resolve([{ id: serviceId }])
      : db.select({ id: services.id }).from(services).where(and(eq(services.tenantId, tenantId), eq(services.id, serviceId))).limit(1),
    db.select({ id: paymentMethods.id }).from(paymentMethods).where(and(eq(paymentMethods.tenantId, tenantId), eq(paymentMethods.id, paymentMethodId))).limit(1),
  ]);
  if (!barber) throw new Error("Barber not found for this tenant.");
  if (!location) throw new Error("Location not found for this tenant.");
  if (!serviceRows[0]) throw new Error("Service not found for this tenant.");
  if (!paymentMethod) throw new Error("Payment method not found for this tenant.");
}

/**
 * Log a barber activity. The commission RATE, the payment method FEE RATE and
 * the resulting commission AMOUNT are all resolved/computed server-side: the
 * rate from getEffectiveCommissionRate(barber, service), the fee from
 * getPaymentMethodFeeRate(paymentMethod), and the amount from
 * computeCommissionAmount. Nothing payout-related is ever trusted from the
 * caller. Both resolved rates are snapshotted onto the row so later edits to the
 * service, the barber's override or the payment method's fee can never
 * retroactively change a historical payout.
 */
export async function logActivity(
  tenantId: string,
  createdBy: string,
  data: LogActivityInput
): Promise<BarberActivityRow> {
  await assertActivityRefsBelongToTenant(
    tenantId,
    data.barberId,
    data.locationId,
    data.serviceId,
    data.paymentMethodId
  );

  const [effective, feeRate] = await Promise.all([
    getEffectiveCommissionRate(tenantId, data.barberId, data.serviceId),
    getPaymentMethodFeeRate(tenantId, data.paymentMethodId),
  ]);
  if (!effective) throw new Error("Could not resolve a commission rate for this barber and service.");
  if (feeRate == null) throw new Error("Could not resolve a fee rate for this payment method.");

  const commissionRate = effective.rate;
  const commissionAmount = computeCommissionAmount(data.priceCharged, commissionRate, feeRate);

  const [row] = await db
    .insert(barberActivities)
    .values({
      id: crypto.randomUUID(),
      tenantId,
      barberId: data.barberId,
      locationId: data.locationId,
      serviceId: data.serviceId,
      paymentMethodId: data.paymentMethodId,
      customerName: data.customerName ?? null,
      priceCharged: String(data.priceCharged),
      commissionRate: String(commissionRate),
      paymentMethodFeeRate: String(feeRate),
      commissionAmount: String(commissionAmount),
      performedAt: data.performedAt ? new Date(data.performedAt) : new Date(),
      createdBy,
    })
    .returning();
  return row;
}

export type LogActivityBatchInput = {
  barberId: string;
  locationId: string;
  paymentMethodId: string;
  customerName?: string;
  performedAt?: string; // ISO datetime; defaults to now
  lines: { serviceId: string; priceCharged: number }[]; // must be non-empty
};

/**
 * Log several services for one barber + payment method in a single write — the
 * front desk's normal case (a customer gets a cut, a beard trim and a wash, all
 * paid together).
 *
 * DO NOT wrap this in `db.transaction()`. This project uses the Neon HTTP driver
 * (drizzle-orm/neon-http), which has no transaction support and throws
 * "No transactions support in neon-http driver" at runtime — that exact bug was
 * already hit and fixed elsewhere in this module (see setBarberLocations). It
 * isn't needed here either: every row is inserted by ONE multi-row INSERT
 * statement, which Postgres applies atomically on its own. Rewriting this as a
 * loop of inserts, or as separate statements inside a transaction, would
 * *remove* the all-or-nothing guarantee rather than add it — and that guarantee
 * is what lets the UI safely offer "retry the same cart" after a failure.
 *
 * All validation and rate resolution happens BEFORE any insert values are built,
 * so a validation failure writes nothing at all.
 */
export async function logActivityBatch(
  tenantId: string,
  createdBy: string,
  data: LogActivityBatchInput
): Promise<BarberActivityRow[]> {
  if (data.lines.length === 0) throw new Error("Cannot log an empty batch of services.");

  // Validate the shared refs (barber, location, payment method) once.
  await assertActivityRefsBelongToTenant(
    tenantId,
    data.barberId,
    data.locationId,
    null,
    data.paymentMethodId
  );

  // Validate every distinct service in one tenant-scoped query rather than N
  // lookups: if the returned count doesn't match the distinct count, at least
  // one service id doesn't belong to this tenant.
  const distinctServiceIds = Array.from(new Set(data.lines.map((l) => l.serviceId)));
  const serviceRows = await db
    .select({ id: services.id, defaultCommissionRate: services.defaultCommissionRate })
    .from(services)
    .where(and(eq(services.tenantId, tenantId), inArray(services.id, distinctServiceIds)));
  if (serviceRows.length !== distinctServiceIds.length) {
    throw new Error("One or more services do not belong to this tenant.");
  }

  // Resolve every rate up front: effective commission rates for all services in
  // one batch query, and the payment method's fee rate once for the whole cart.
  const [rateByService, feeRate] = await Promise.all([
    resolveEffectiveCommissionRates(tenantId, data.barberId, serviceRows),
    getPaymentMethodFeeRate(tenantId, data.paymentMethodId),
  ]);
  if (feeRate == null) throw new Error("Could not resolve a fee rate for this payment method.");

  const performedAt = data.performedAt ? new Date(data.performedAt) : new Date();
  const customerName = data.customerName ?? null;

  const values = data.lines.map((line) => {
    const resolved = rateByService.get(line.serviceId);
    if (!resolved) throw new Error("Could not resolve a commission rate for this barber and service.");
    return {
      id: crypto.randomUUID(),
      tenantId,
      barberId: data.barberId,
      locationId: data.locationId,
      serviceId: line.serviceId,
      paymentMethodId: data.paymentMethodId,
      customerName,
      priceCharged: String(line.priceCharged),
      commissionRate: String(resolved.rate),
      paymentMethodFeeRate: String(feeRate),
      commissionAmount: String(computeCommissionAmount(line.priceCharged, resolved.rate, feeRate)),
      performedAt,
      createdBy,
    };
  });

  // One statement — see the transaction note above.
  return db.insert(barberActivities).values(values).returning();
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
      paymentMethodId: barberActivities.paymentMethodId,
      paymentMethodName: paymentMethods.name,
      paymentMethodFeeRate: barberActivities.paymentMethodFeeRate,
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
    .innerJoin(paymentMethods, eq(paymentMethods.id, barberActivities.paymentMethodId))
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
    paymentMethodId: r.paymentMethodId,
    paymentMethodName: r.paymentMethodName,
    paymentMethodFeeRate: parseFloat(r.paymentMethodFeeRate),
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
 * NOTE: as with LogActivityInput, there is deliberately no `commissionRate` or
 * `paymentMethodFeeRate` field. If barberId or serviceId change the commission
 * rate is re-resolved server-side; if paymentMethodId changes the fee rate is
 * re-resolved the same way. Neither is ever accepted from the caller.
 */
export type UpdateActivityInput = Partial<{
  barberId: string;
  locationId: string;
  serviceId: string;
  paymentMethodId: string;
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
  const paymentMethodId = data.paymentMethodId ?? existing.paymentMethodId;

  const refsChanged =
    barberId !== existing.barberId ||
    locationId !== existing.locationId ||
    serviceId !== existing.serviceId ||
    paymentMethodId !== existing.paymentMethodId;

  if (refsChanged) {
    await assertActivityRefsBelongToTenant(tenantId, barberId, locationId, serviceId, paymentMethodId);
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

  // Same snapshot discipline for the payment method's fee: keep the value taken
  // at log time unless the payment method itself changed, in which case
  // re-resolve the CURRENT fee from the DB. Never accepted from the caller, and
  // never re-read for an unchanged payment method (that would let a later fee
  // edit rewrite history on an unrelated update).
  let paymentMethodFeeRate = parseFloat(existing.paymentMethodFeeRate);
  if (paymentMethodId !== existing.paymentMethodId) {
    const resolvedFee = await getPaymentMethodFeeRate(tenantId, paymentMethodId);
    if (resolvedFee == null) throw new Error("Could not resolve a fee rate for this payment method.");
    paymentMethodFeeRate = resolvedFee;
  }

  // Recompute commissionAmount from the (possibly updated) price and the
  // server-resolved rates, via the single canonical formula.
  const priceCharged = data.priceCharged ?? parseFloat(existing.priceCharged);
  const commissionAmount = computeCommissionAmount(priceCharged, commissionRate, paymentMethodFeeRate);

  const [row] = await db
    .update(barberActivities)
    .set({
      barberId: data.barberId != null ? barberId : undefined,
      locationId: data.locationId != null ? locationId : undefined,
      serviceId: data.serviceId != null ? serviceId : undefined,
      paymentMethodId: data.paymentMethodId != null ? paymentMethodId : undefined,
      customerName: data.customerName !== undefined ? data.customerName : undefined,
      priceCharged: data.priceCharged != null ? String(data.priceCharged) : undefined,
      commissionRate: String(commissionRate),
      paymentMethodFeeRate: String(paymentMethodFeeRate),
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

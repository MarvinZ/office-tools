import { and, asc, eq, gte, inArray, isNull, ne } from "drizzle-orm";
import { db } from "@/db";
import {
  barberActivities,
  barberFortnightClosings,
  barberRateChanges,
  barbers,
  barberServiceRates,
  services,
} from "@/db/schema";
import { businessDateOf, startOfBusinessDay, todayBusinessDate } from "@/lib/barbers/dates";
import { fortnightKey, fortnightOf } from "@/lib/barbers/settlement";
import { commissionRateOn, scopeRateOn, type RateBaselines, type RateChange } from "@/lib/barbers/rate-schedule";
import { getBarberSettings } from "./settings";
import { lineCommission } from "@/lib/barbers/settlement";
import { BarbersError } from "@/lib/barbers/errors";

/**
 * Commission changes with a start date. All date logic is in
 * lib/barbers/rate-schedule.ts; this loads, records and re-rates.
 */

export type RateContext = { changes: RateChange[]; baselines: RateBaselines };

export async function loadRateContext(tenantId: string, barberId: string): Promise<RateContext> {
  const map = await loadRateContexts(tenantId, [barberId]);
  return map.get(barberId) ?? { changes: [], baselines: { fixed: null, overrides: new Map() } };
}

/** Rate contexts for many barbers in three queries. */
export async function loadRateContexts(tenantId: string, barberIds: string[]): Promise<Map<string, RateContext>> {
  const result = new Map<string, RateContext>();
  if (barberIds.length === 0) return result;
  const [barberRows, overrideRows, changeRows] = await Promise.all([
    db
      .select({ id: barbers.id, fixed: barbers.fixedCommissionRate })
      .from(barbers)
      .where(and(eq(barbers.tenantId, tenantId), inArray(barbers.id, barberIds))),
    db
      .select()
      .from(barberServiceRates)
      .where(and(eq(barberServiceRates.tenantId, tenantId), inArray(barberServiceRates.barberId, barberIds))),
    db
      .select()
      .from(barberRateChanges)
      .where(and(eq(barberRateChanges.tenantId, tenantId), inArray(barberRateChanges.barberId, barberIds))),
  ]);
  for (const b of barberRows) {
    result.set(b.id, {
      changes: [],
      baselines: { fixed: b.fixed != null ? Number(b.fixed) : null, overrides: new Map() },
    });
  }
  for (const o of overrideRows) result.get(o.barberId)?.baselines.overrides.set(o.serviceId, Number(o.commissionRate));
  for (const c of changeRows) {
    result.get(c.barberId)?.changes.push({
      serviceId: c.serviceId,
      rate: c.rate != null ? Number(c.rate) : null,
      previousRate: c.previousRate != null ? Number(c.previousRate) : null,
      effectiveFrom: c.effectiveFrom,
      createdAt: c.createdAt,
    });
  }
  return result;
}

function dayBefore(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export type RateChangeInput = {
  barberId: string;
  serviceId: string | null; // null = fixed rate for all services
  rate: number | null; // 0–1; null = remove (fall back)
  effectiveFrom: string; // YYYY-MM-DD
  note?: string | null;
};

/**
 * Record a change. Keeps today's columns in step and, when the change starts
 * on or before today, re-rates the barber's services from that date in open
 * fortnights. Returns how many service lines were re-rated.
 */
export async function recordRateChange(
  tenantId: string,
  userId: string,
  input: RateChangeInput
): Promise<{ reRated: number; previousRate: number | null }> {
  if (input.rate != null && (!Number.isFinite(input.rate) || input.rate <= 0 || input.rate > 1)) {
    throw new BarbersError("rateOutOfRange");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.effectiveFrom)) throw new BarbersError("invalidDate");
  const [barber] = await db
    .select({ id: barbers.id })
    .from(barbers)
    .where(and(eq(barbers.tenantId, tenantId), eq(barbers.id, input.barberId)))
    .limit(1);
  if (!barber) throw new BarbersError("notFound");
  if (input.serviceId) {
    const [service] = await db
      .select({ id: services.id })
      .from(services)
      .where(and(eq(services.tenantId, tenantId), eq(services.id, input.serviceId)))
      .limit(1);
    if (!service) throw new BarbersError("notFound");
  }

  const ctx = await loadRateContext(tenantId, input.barberId);
  const baseline = input.serviceId ? (ctx.baselines.overrides.get(input.serviceId) ?? null) : ctx.baselines.fixed;
  const previousRate = scopeRateOn(ctx.changes, input.serviceId, dayBefore(input.effectiveFrom), baseline);

  await db.insert(barberRateChanges).values({
    id: crypto.randomUUID(),
    tenantId,
    barberId: input.barberId,
    serviceId: input.serviceId,
    rate: input.rate != null ? String(input.rate) : null,
    previousRate: previousRate != null ? String(previousRate) : null,
    effectiveFrom: input.effectiveFrom,
    note: input.note?.trim() || null,
    createdBy: userId,
  });

  await syncTodayColumns(tenantId, input.barberId, input.serviceId);
  const reRated = input.effectiveFrom <= todayBusinessDate() ? await reRateFrom(tenantId, input.barberId, input.effectiveFrom) : 0;
  return { reRated, previousRate };
}

/** Delete a change that hasn't started yet. */
export async function deleteFutureRateChange(tenantId: string, id: string) {
  const [row] = await db
    .select()
    .from(barberRateChanges)
    .where(and(eq(barberRateChanges.tenantId, tenantId), eq(barberRateChanges.id, id)))
    .limit(1);
  if (!row) return null;
  if (row.effectiveFrom <= todayBusinessDate()) throw new BarbersError("rateChangeStarted");
  await db.delete(barberRateChanges).where(and(eq(barberRateChanges.tenantId, tenantId), eq(barberRateChanges.id, id)));
  await syncTodayColumns(tenantId, row.barberId, row.serviceId);
  return row;
}

/** Make barbers.fixed_commission_rate / barber_service_rates equal the value in force today. */
async function syncTodayColumns(tenantId: string, barberId: string, serviceId: string | null) {
  const ctx = await loadRateContext(tenantId, barberId);
  const today = todayBusinessDate();
  if (serviceId == null) {
    const value = scopeRateOn(ctx.changes, null, today, ctx.baselines.fixed);
    await db
      .update(barbers)
      .set({ fixedCommissionRate: value != null ? String(value) : null, updatedAt: new Date() })
      .where(and(eq(barbers.tenantId, tenantId), eq(barbers.id, barberId)));
    return;
  }
  const value = scopeRateOn(ctx.changes, serviceId, today, ctx.baselines.overrides.get(serviceId) ?? null);
  if (value == null) {
    await db
      .delete(barberServiceRates)
      .where(
        and(
          eq(barberServiceRates.tenantId, tenantId),
          eq(barberServiceRates.barberId, barberId),
          eq(barberServiceRates.serviceId, serviceId)
        )
      );
  } else {
    await db
      .insert(barberServiceRates)
      .values({ tenantId, barberId, serviceId, commissionRate: String(value), updatedAt: new Date() })
      .onConflictDoUpdate({
        target: [barberServiceRates.tenantId, barberServiceRates.barberId, barberServiceRates.serviceId],
        set: { commissionRate: String(value), updatedAt: new Date() },
      });
  }
}

/**
 * Recompute the rate of the barber's services from `from` onward, as of each
 * service's own date. Closed fortnights are never touched; voided services and
 * warranty redos keep their rate.
 */
async function reRateFrom(tenantId: string, barberId: string, from: string): Promise<number> {
  const [ctx, settings, lines, closed] = await Promise.all([
    loadRateContext(tenantId, barberId),
    getBarberSettings(tenantId),
    db
      .select({
        id: barberActivities.id,
        serviceId: barberActivities.serviceId,
        performedAt: barberActivities.performedAt,
        priceCharged: barberActivities.priceCharged,
        commissionRate: barberActivities.commissionRate,
        writtenRate: barberActivities.writtenRate,
        defaultRate: services.defaultCommissionRate,
      })
      .from(barberActivities)
      .leftJoin(services, eq(services.id, barberActivities.serviceId))
      .where(
        and(
          eq(barberActivities.tenantId, tenantId),
          eq(barberActivities.barberId, barberId),
          gte(barberActivities.performedAt, startOfBusinessDay(from)),
          ne(barberActivities.status, "voided"),
          ne(barberActivities.status, "warranty")
        )
      ),
    db
      .select({ period: barberFortnightClosings.period })
      .from(barberFortnightClosings)
      .where(and(eq(barberFortnightClosings.tenantId, tenantId), isNull(barberFortnightClosings.reopenedAt))),
  ]);
  const closedPeriods = new Set(closed.map((c) => c.period));

  const updates = [];
  for (const l of lines) {
    const date = businessDateOf(l.performedAt);
    if (closedPeriods.has(fortnightKey(fortnightOf(date)))) continue;
    // Catalog service → its default; imported line → the % the cashier wrote.
    const fallback = l.serviceId ? (l.defaultRate != null ? Number(l.defaultRate) : null) : l.writtenRate != null ? Number(l.writtenRate) : null;
    const { rate } = commissionRateOn(ctx.changes, ctx.baselines, l.serviceId, date, fallback);
    const next = rate ?? Number(l.commissionRate);
    if (Math.abs(next - Number(l.commissionRate)) < 1e-9) continue;
    const amount = lineCommission(l.priceCharged, next, settings.ivaRate).toDecimalPlaces(2).toNumber();
    updates.push(
      db
        .update(barberActivities)
        .set({ commissionRate: String(next), commissionAmount: String(amount) })
        .where(and(eq(barberActivities.tenantId, tenantId), eq(barberActivities.id, l.id)))
    );
  }
  if (updates.length > 0) await db.batch(updates as unknown as Parameters<typeof db.batch>[0]);
  return updates.length;
}

export type RateChangeListItem = {
  id: string;
  serviceId: string | null;
  serviceName: string | null;
  rate: number | null;
  previousRate: number | null;
  effectiveFrom: string;
  note: string | null;
  createdAt: Date;
  upcoming: boolean;
};

export async function listRateChanges(tenantId: string, barberId: string): Promise<RateChangeListItem[]> {
  const today = todayBusinessDate();
  const rows = await db
    .select({ change: barberRateChanges, serviceName: services.name })
    .from(barberRateChanges)
    .leftJoin(services, eq(services.id, barberRateChanges.serviceId))
    .where(and(eq(barberRateChanges.tenantId, tenantId), eq(barberRateChanges.barberId, barberId)))
    .orderBy(asc(barberRateChanges.effectiveFrom), asc(barberRateChanges.createdAt));
  return rows.reverse().map(({ change: c, serviceName }) => ({
    id: c.id,
    serviceId: c.serviceId,
    serviceName,
    rate: c.rate != null ? Number(c.rate) : null,
    previousRate: c.previousRate != null ? Number(c.previousRate) : null,
    effectiveFrom: c.effectiveFrom,
    note: c.note,
    createdAt: c.createdAt,
    upcoming: c.effectiveFrom > today,
  }));
}

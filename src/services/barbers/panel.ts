import { and, desc, eq, gt, gte, inArray, isNull, lt, lte, ne, sql, type SQL } from "drizzle-orm";
import Decimal from "decimal.js";
import { db } from "@/db";
import {
  barberActivities, barberPanelAlerts, barberSettings, barbers, locations, paymentMethods, productCustomerSales, services,
} from "@/db/schema";
import { endOfBusinessDay, startOfBusinessDay, isDateString, businessDateOf } from "@/lib/barbers/dates";
import { fortnightKey, fortnightOf, shiftFortnight } from "@/lib/barbers/settlement";
import {
  buildRecommendations, compare, dayMessage, goalProgress, isOperatingDay, monthOf, monthRange, operatingDaysBetween,
  previousDay, type Comparison, type DayMessage, type GoalProgress, type Recommendation,
} from "@/lib/barbers/panel";
import { isFortnightClosed } from "./settlements";
import { getBarberSettings } from "./settings";
import { BarbersError } from "@/lib/barbers/errors";

/**
 * Data for the admin panel (NOURA Módulo 1). Every figure comes from saved
 * movements: services (barber_activities) and products sold to customers
 * (product_customer_sales). The rules live in lib/barbers/panel.ts.
 *
 * Sales = what customers paid, IVA included: services with status "active"
 * (voided, courtesy and warranty bring no money in) plus product sales.
 * The totals and the detail list are built from the SAME where-clauses below,
 * so the list behind a figure always adds up to it (§16, CA 10).
 */

export type SalesFilter = {
  from: string; // YYYY-MM-DD, Costa Rica calendar
  to: string;
  locationId: string | null; // null = every location
};

function serviceWhere(tenantId: string, f: SalesFilter): SQL {
  const conds = [
    eq(barberActivities.tenantId, tenantId),
    eq(barberActivities.status, "active"),
    gte(barberActivities.performedAt, startOfBusinessDay(f.from)),
    lte(barberActivities.performedAt, endOfBusinessDay(f.to)),
  ];
  if (f.locationId) conds.push(eq(barberActivities.locationId, f.locationId));
  return and(...conds)!;
}

function productWhere(tenantId: string, f: SalesFilter): SQL {
  const conds = [
    eq(productCustomerSales.tenantId, tenantId),
    gte(productCustomerSales.saleDate, f.from),
    lte(productCustomerSales.saleDate, f.to),
  ];
  if (f.locationId) conds.push(eq(productCustomerSales.locationId, f.locationId));
  return and(...conds)!;
}

export type SalesTotals = {
  services: { count: number; amount: number };
  products: { units: number; amount: number };
  total: number;
};

export async function getSalesTotals(tenantId: string, f: SalesFilter): Promise<SalesTotals> {
  const [[s], [p]] = await Promise.all([
    db
      .select({
        count: sql<string>`count(*)`,
        amount: sql<string>`coalesce(sum(${barberActivities.priceCharged}), 0)`,
      })
      .from(barberActivities)
      .where(serviceWhere(tenantId, f)),
    db
      .select({
        units: sql<string>`coalesce(sum(${productCustomerSales.quantity}), 0)`,
        amount: sql<string>`coalesce(sum(${productCustomerSales.total}), 0)`,
      })
      .from(productCustomerSales)
      .where(productWhere(tenantId, f)),
  ]);
  return {
    services: { count: Number(s.count), amount: Number(s.amount) },
    products: { units: Number(p.units), amount: Number(p.amount) },
    total: new Decimal(s.amount).plus(p.amount).toNumber(),
  };
}

export type SalesDetailRow = {
  kind: "service" | "product";
  id: string;
  date: string; // business day
  performedAt: Date | null; // services only (products are dated, not timed)
  description: string;
  barberName: string | null;
  locationName: string | null;
  paymentMethodName: string | null;
  customerName: string | null;
  amount: number;
  createdBy: string; // Clerk user id of who recorded it (or imported it)
};

/** Everything a total is made of, newest first. */
export async function listSalesDetail(tenantId: string, f: SalesFilter): Promise<SalesDetailRow[]> {
  const [serviceRows, productRows] = await Promise.all([
    db
      .select({
        id: barberActivities.id,
        performedAt: barberActivities.performedAt,
        serviceName: services.name,
        description: barberActivities.description,
        firstName: barbers.firstName,
        lastName: barbers.lastName,
        locationName: locations.name,
        paymentMethodName: paymentMethods.name,
        customerName: barberActivities.customerName,
        amount: barberActivities.priceCharged,
        createdBy: barberActivities.createdBy,
      })
      .from(barberActivities)
      .innerJoin(barbers, eq(barbers.id, barberActivities.barberId))
      .innerJoin(locations, eq(locations.id, barberActivities.locationId))
      .innerJoin(paymentMethods, eq(paymentMethods.id, barberActivities.paymentMethodId))
      .leftJoin(services, eq(services.id, barberActivities.serviceId))
      .where(serviceWhere(tenantId, f))
      .orderBy(desc(barberActivities.performedAt)),
    db
      .select({
        id: productCustomerSales.id,
        saleDate: productCustomerSales.saleDate,
        createdAt: productCustomerSales.createdAt,
        productName: productCustomerSales.productName,
        quantity: productCustomerSales.quantity,
        firstName: barbers.firstName,
        lastName: barbers.lastName,
        locationName: locations.name,
        paymentMethodName: paymentMethods.name,
        note: productCustomerSales.note,
        amount: productCustomerSales.total,
        createdBy: productCustomerSales.createdBy,
      })
      .from(productCustomerSales)
      .leftJoin(barbers, eq(barbers.id, productCustomerSales.barberId))
      .leftJoin(locations, eq(locations.id, productCustomerSales.locationId))
      .leftJoin(paymentMethods, eq(paymentMethods.id, productCustomerSales.paymentMethodId))
      .where(productWhere(tenantId, f))
      .orderBy(desc(productCustomerSales.saleDate), desc(productCustomerSales.createdAt)),
  ]);

  const rows: (SalesDetailRow & { sortKey: number })[] = [
    ...serviceRows.map((r) => ({
      kind: "service" as const,
      id: r.id,
      date: businessDateOf(r.performedAt),
      performedAt: r.performedAt,
      description: r.serviceName ?? r.description ?? "",
      barberName: `${r.firstName} ${r.lastName}`,
      locationName: r.locationName,
      paymentMethodName: r.paymentMethodName,
      customerName: r.customerName,
      amount: Number(r.amount),
      createdBy: r.createdBy,
      sortKey: r.performedAt.getTime(),
    })),
    ...productRows.map((r) => ({
      kind: "product" as const,
      id: r.id,
      date: r.saleDate,
      performedAt: null,
      description: r.quantity > 1 ? `${r.productName} × ${r.quantity}` : r.productName,
      barberName: r.firstName ? `${r.firstName} ${r.lastName}` : null,
      locationName: r.locationName,
      paymentMethodName: r.paymentMethodName,
      customerName: r.note,
      amount: Number(r.amount),
      createdBy: r.createdBy,
      // A product sale has a date but no time: sort it by when it was entered.
      sortKey: r.createdAt.getTime(),
    })),
  ];
  rows.sort((a, b) => b.sortKey - a.sortKey);
  return rows.map((r) => {
    const { sortKey, ...row } = r;
    void sortKey;
    return row;
  });
}

export type RecentVisit = {
  id: string;
  performedAt: Date;
  customerName: string | null;
  service: string;
  barberName: string;
  paymentMethodName: string;
  amount: number;
  status: "active" | "courtesy" | "warranty" | "voided";
  locationId: string;
};

/** The latest services, voided ones left out (§10.1). */
export async function listRecentVisits(tenantId: string, locationId: string | null, limit = 10): Promise<RecentVisit[]> {
  const conds = [eq(barberActivities.tenantId, tenantId), ne(barberActivities.status, "voided")];
  if (locationId) conds.push(eq(barberActivities.locationId, locationId));
  const rows = await db
    .select({
      id: barberActivities.id,
      performedAt: barberActivities.performedAt,
      customerName: barberActivities.customerName,
      serviceName: services.name,
      description: barberActivities.description,
      firstName: barbers.firstName,
      lastName: barbers.lastName,
      paymentMethodName: paymentMethods.name,
      amount: barberActivities.priceCharged,
      status: barberActivities.status,
      locationId: barberActivities.locationId,
    })
    .from(barberActivities)
    .innerJoin(barbers, eq(barbers.id, barberActivities.barberId))
    .innerJoin(paymentMethods, eq(paymentMethods.id, barberActivities.paymentMethodId))
    .leftJoin(services, eq(services.id, barberActivities.serviceId))
    .where(and(...conds))
    .orderBy(desc(barberActivities.performedAt))
    .limit(limit);
  return rows.map((r) => ({
    id: r.id,
    performedAt: r.performedAt,
    customerName: r.customerName?.trim() || null,
    service: r.serviceName ?? r.description ?? "",
    barberName: `${r.firstName} ${r.lastName}`,
    paymentMethodName: r.paymentMethodName,
    amount: Number(r.amount),
    status: r.status,
    locationId: r.locationId,
  }));
}

// ── Goals and operating days ─────────────────────────────────────────────────

export type PanelLocation = { id: string; name: string; monthlyGoal: number | null; dailyGoal: number | null };

export type PanelConfig = { locations: PanelLocation[]; closedWeekdays: number[] };

export async function getPanelConfig(tenantId: string): Promise<PanelConfig> {
  await getBarberSettings(tenantId); // creates the settings row on first use
  const [rows, [settings]] = await Promise.all([
    db
      .select({ id: locations.id, name: locations.name, monthlyGoal: locations.monthlyGoal, dailyGoal: locations.dailyGoal })
      .from(locations)
      .where(and(eq(locations.tenantId, tenantId), eq(locations.status, "active")))
      .orderBy(locations.name),
    db.select({ closedWeekdays: barberSettings.closedWeekdays }).from(barberSettings).where(eq(barberSettings.tenantId, tenantId)).limit(1),
  ]);
  return {
    locations: rows.map((r) => ({
      id: r.id,
      name: r.name,
      monthlyGoal: r.monthlyGoal == null ? null : Number(r.monthlyGoal),
      dailyGoal: r.dailyGoal == null ? null : Number(r.dailyGoal),
    })),
    closedWeekdays: settings?.closedWeekdays ?? [],
  };
}

export type GoalsInput = {
  closedWeekdays: number[];
  goals: { locationId: string; monthlyGoal: number | null; dailyGoal: number | null }[];
};

/** Owner-set goals per location and the days the shop is closed, saved together. */
export async function updatePanelGoals(tenantId: string, userId: string, input: GoalsInput): Promise<void> {
  const days = [...new Set(input.closedWeekdays)].sort();
  if (days.some((d) => !Number.isInteger(d) || d < 0 || d > 6) || days.length === 7) {
    throw new BarbersError("invalidInput");
  }
  for (const g of input.goals) {
    for (const v of [g.monthlyGoal, g.dailyGoal]) {
      if (v != null && (!Number.isFinite(v) || v < 0)) throw new BarbersError("goalNegative");
    }
  }
  const ids = input.goals.map((g) => g.locationId);
  if (ids.length > 0) {
    const owned = await db
      .select({ id: locations.id })
      .from(locations)
      .where(and(eq(locations.tenantId, tenantId), inArray(locations.id, ids)));
    if (owned.length !== new Set(ids).size) throw new BarbersError("notFound");
  }
  await getBarberSettings(tenantId); // the settings row must exist for the update below

  const money = (v: number | null) => (v == null || v === 0 ? null : String(v));
  await db.batch([
    db
      .update(barberSettings)
      .set({ closedWeekdays: days, updatedBy: userId, updatedAt: new Date() })
      .where(eq(barberSettings.tenantId, tenantId)),
    ...input.goals.map((g) =>
      db
        .update(locations)
        .set({ monthlyGoal: money(g.monthlyGoal), dailyGoal: money(g.dailyGoal), updatedAt: new Date() })
        .where(and(eq(locations.tenantId, tenantId), eq(locations.id, g.locationId)))
    ),
  ]);
}

// ── Recommendation decisions (§9 Historial) ─────────────────────────────────

export type AlertDecision = { key: string; status: "attended" | "dismissed"; decidedBy: string; decidedAt: Date };

/** null status = back to pending (the row is removed). */
export async function setAlertDecision(
  tenantId: string,
  userId: string,
  key: string,
  status: "attended" | "dismissed" | null
): Promise<void> {
  if (!key || key.length > 200) throw new BarbersError("invalidInput");
  if (status === null) {
    await db.delete(barberPanelAlerts).where(and(eq(barberPanelAlerts.tenantId, tenantId), eq(barberPanelAlerts.key, key)));
    return;
  }
  if (status !== "attended" && status !== "dismissed") throw new BarbersError("invalidInput");
  await db
    .insert(barberPanelAlerts)
    .values({ tenantId, key, status, decidedBy: userId, decidedAt: new Date() })
    .onConflictDoUpdate({
      target: [barberPanelAlerts.tenantId, barberPanelAlerts.key],
      set: { status, decidedBy: userId, decidedAt: new Date() },
    });
}

async function getAlertDecisions(tenantId: string, keys: string[]): Promise<Map<string, AlertDecision>> {
  if (keys.length === 0) return new Map();
  const rows = await db
    .select()
    .from(barberPanelAlerts)
    .where(and(eq(barberPanelAlerts.tenantId, tenantId), inArray(barberPanelAlerts.key, keys)));
  return new Map(rows.map((r) => [r.key, { key: r.key, status: r.status as AlertDecision["status"], decidedBy: r.decidedBy, decidedAt: r.decidedAt }]));
}

// ── The whole panel ──────────────────────────────────────────────────────────

export type PanelRecommendation = Recommendation & { decision: AlertDecision | null };

export type PanelData = {
  today: string;
  generatedAt: Date;
  locationId: string | null;
  config: PanelConfig;
  day: {
    sales: SalesTotals;
    operating: boolean;
    goal: GoalProgress | null;
    message: DayMessage;
  };
  month: {
    key: string;
    sales: SalesTotals;
    previousSales: SalesTotals;
    vsPrevious: Comparison;
    goal: GoalProgress | null;
  };
  comparison: {
    a: string;
    b: string;
    totals: { a: SalesTotals; b: SalesTotals };
    rows: { key: "total" | "services" | "products" | "serviceCount"; cmp: Comparison }[];
  };
  recentVisits: RecentVisit[];
  recommendations: PanelRecommendation[];
};

function sumGoals(locs: PanelLocation[], field: "monthlyGoal" | "dailyGoal"): number | null {
  const set = locs.map((l) => l[field]).filter((v): v is number => v != null && v > 0);
  return set.length === 0 ? null : set.reduce((acc, v) => acc.plus(v), new Decimal(0)).toNumber();
}

export async function getPanelData(
  tenantId: string,
  opts: { today: string; locationId: string | null; compareA: string; compareB: string; config?: PanelConfig }
): Promise<PanelData> {
  const { today, locationId } = opts;
  if (!isDateString(today)) throw new BarbersError("invalidDate");

  const config = opts.config ?? (await getPanelConfig(tenantId));
  const scopeLocations = locationId ? config.locations.filter((l) => l.id === locationId) : config.locations;
  const { closedWeekdays } = config;

  const monthKey = monthOf(today);
  const month = monthRange(monthKey);
  const prevMonth = monthRange(monthOf(previousDay(month.from)));
  const yesterday = previousDay(today);
  const currentFortnight = fortnightOf(today);
  const previousFortnight = shiftFortnight(currentFortnight, -1);

  const [daySales, monthSales, previousMonthSales, cmpA, cmpB, recentVisits, prevClosed, pending, yesterdayByLocation, monthByLocation] =
    await Promise.all([
      getSalesTotals(tenantId, { from: today, to: today, locationId }),
      getSalesTotals(tenantId, { from: month.from, to: today, locationId }),
      // Same days of the previous month, so a month in progress compares fairly.
      getSalesTotals(tenantId, { from: prevMonth.from, to: clampDay(prevMonth, today), locationId }),
      getSalesTotals(tenantId, { ...monthRange(opts.compareA), locationId }),
      getSalesTotals(tenantId, { ...monthRange(opts.compareB), locationId }),
      listRecentVisits(tenantId, locationId),
      isFortnightClosed(tenantId, previousFortnight),
      db
        .select({ count: sql<string>`count(*)`, amount: sql<string>`coalesce(sum(${productCustomerSales.commissionTotal}), 0)` })
        .from(productCustomerSales)
        .where(
          and(
            eq(productCustomerSales.tenantId, tenantId),
            isNull(productCustomerSales.commissionPaidAt),
            gt(productCustomerSales.commissionTotal, "0"),
            lt(productCustomerSales.saleDate, currentFortnight.from)
          )
        ),
      Promise.all(scopeLocations.map((l) => getSalesTotals(tenantId, { from: yesterday, to: yesterday, locationId: l.id }))),
      Promise.all(scopeLocations.map((l) => getSalesTotals(tenantId, { from: month.from, to: yesterday, locationId: l.id }))),
    ]);

  const operating = isOperatingDay(today, closedWeekdays);
  const dayGoal = goalProgress(daySales.total, sumGoals(scopeLocations, "dailyGoal"), operating ? 1 : 0);
  const monthGoal = goalProgress(
    monthSales.total,
    sumGoals(scopeLocations, "monthlyGoal"),
    operatingDaysBetween(today, month.to, closedWeekdays)
  );

  const recs = buildRecommendations({
    today,
    scope: locationId ?? "all",
    previousFortnight: { key: fortnightKey(previousFortnight), to: previousFortnight.to, closed: prevClosed },
    pendingCommissions: { count: Number(pending[0].count), amount: Number(pending[0].amount), before: currentFortnight.from },
    month: {
      key: monthKey,
      progress: monthGoal,
      elapsedOperatingDays: operatingDaysBetween(month.from, yesterday, closedWeekdays),
      totalOperatingDays: operatingDaysBetween(month.from, month.to, closedWeekdays),
    },
    yesterday: {
      date: yesterday,
      // Only the current month: on the 1st, "yesterday" belongs to last month.
      operating: isOperatingDay(yesterday, closedWeekdays) && yesterday >= month.from,
      // Locations already selling this month, with nothing at all yesterday.
      locationsWithoutSales: scopeLocations.filter((_, i) => monthByLocation[i].total > 0 && yesterdayByLocation[i].total === 0),
    },
  });
  const decisions = await getAlertDecisions(tenantId, recs.map((r) => r.key));

  return {
    today,
    generatedAt: new Date(),
    locationId,
    config,
    day: {
      sales: daySales,
      operating,
      goal: dayGoal,
      message: dayMessage({ operatingToday: operating, salesToday: daySales.total, daily: dayGoal }),
    },
    month: {
      key: monthKey,
      sales: monthSales,
      previousSales: previousMonthSales,
      vsPrevious: compare(monthSales.total, previousMonthSales.total),
      goal: monthGoal,
    },
    comparison: {
      a: opts.compareA,
      b: opts.compareB,
      totals: { a: cmpA, b: cmpB },
      rows: [
        { key: "total", cmp: compare(cmpA.total, cmpB.total) },
        { key: "services", cmp: compare(cmpA.services.amount, cmpB.services.amount) },
        { key: "products", cmp: compare(cmpA.products.amount, cmpB.products.amount) },
        { key: "serviceCount", cmp: compare(cmpA.services.count, cmpB.services.count) },
      ],
    },
    recentVisits,
    recommendations: recs.map((r) => ({ ...r, decision: decisions.get(r.key) ?? null })),
  };
}

/** The same day-of-month in another month, capped at that month's last day. */
function clampDay(month: { from: string; to: string }, today: string): string {
  const day = `${month.from.slice(0, 8)}${today.slice(8, 10)}`;
  return day > month.to ? month.to : day;
}

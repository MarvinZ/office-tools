import { and, asc, desc, eq, gte, ilike, inArray, isNotNull, isNull, lte, ne, or, sql } from "drizzle-orm";
import Decimal from "decimal.js";
import { db } from "@/db";
import { barberActivities, barberClients, barbers, locations, paymentMethods, productCustomerSales, services } from "@/db/schema";
import { businessDateOf, endOfBusinessDay, startOfBusinessDay } from "@/lib/barbers/dates";
import {
  birthdayInMonth, demographics, missingFields, phoneDigits, usualBarber, validateClient, type ClientInput, type Demographics,
} from "@/lib/barbers/clients";
import { BarbersError } from "@/lib/barbers/errors";

/**
 * Client records (NOURA Módulo 1 §10–11). A "visit" is a service that wasn't
 * voided; money spent counts normal services (what was paid) and product
 * purchases. Rules are pure in lib/barbers/clients.ts.
 */

export type ClientRow = typeof barberClients.$inferSelect;

function check(input: ClientInput, today: string) {
  const problem = validateClient(input, today);
  if (problem === "nameRequired") throw new BarbersError("clientNameRequired");
  if (problem) throw new BarbersError(problem);
}

function clean(input: ClientInput) {
  return {
    fullName: input.fullName.trim().replace(/\s+/g, " "),
    phone: input.phone?.trim() || null,
    email: input.email?.trim() || null,
    birthDate: input.birthDate || null,
    notes: input.notes?.trim() || null,
  };
}

export async function createClient(tenantId: string, userId: string, input: ClientInput, today: string): Promise<ClientRow> {
  check(input, today);
  const [row] = await db
    .insert(barberClients)
    .values({ id: crypto.randomUUID(), tenantId, ...clean(input), createdBy: userId })
    .returning();
  return row;
}

export async function updateClient(tenantId: string, id: string, input: ClientInput, today: string): Promise<{ before: ClientRow; after: ClientRow }> {
  check(input, today);
  const before = await getClientRow(tenantId, id);
  if (!before) throw new BarbersError("notFound");
  const [after] = await db
    .update(barberClients)
    .set({ ...clean(input), updatedAt: new Date() })
    .where(and(eq(barberClients.tenantId, tenantId), eq(barberClients.id, id)))
    .returning();
  return { before, after };
}

export async function getClientRow(tenantId: string, id: string): Promise<ClientRow | null> {
  const [row] = await db.select().from(barberClients).where(and(eq(barberClients.tenantId, tenantId), eq(barberClients.id, id))).limit(1);
  return row ?? null;
}

export type ClientOption = { id: string; fullName: string; phone: string | null };

/** Front-desk search by name or phone (digits). */
export async function searchClients(tenantId: string, q: string, limit = 8): Promise<ClientOption[]> {
  const text = q.trim();
  if (text.length < 2) return [];
  const digits = phoneDigits(text);
  const byPhone = digits.length >= 3 ? sql`regexp_replace(coalesce(${barberClients.phone}, ''), '[^0-9]', '', 'g') like ${`%${digits}%`}` : undefined;
  const byName = ilike(barberClients.fullName, `%${text.replace(/[%_]/g, "")}%`);
  return db
    .select({ id: barberClients.id, fullName: barberClients.fullName, phone: barberClients.phone })
    .from(barberClients)
    .where(and(eq(barberClients.tenantId, tenantId), byPhone ? or(byName, byPhone) : byName))
    .orderBy(asc(barberClients.fullName))
    .limit(limit);
}

// ── Activity per client ──────────────────────────────────────────────────────

type ClientStats = { visits: number; lastVisit: Date | null; firstVisit: Date | null; spent: number };

/** Visits, first/last visit and money spent for the given clients (all when ids is null). */
async function statsFor(tenantId: string, ids: string[] | null): Promise<Map<string, ClientStats>> {
  if (ids && ids.length === 0) return new Map();
  const svcConds = [eq(barberActivities.tenantId, tenantId), isNotNull(barberActivities.clientId), ne(barberActivities.status, "voided")];
  const prodConds = [eq(productCustomerSales.tenantId, tenantId), isNotNull(productCustomerSales.clientId)];
  if (ids) {
    svcConds.push(inArray(barberActivities.clientId, ids));
    prodConds.push(inArray(productCustomerSales.clientId, ids));
  }
  const [svc, prod] = await Promise.all([
    db
      .select({
        clientId: barberActivities.clientId,
        visits: sql<string>`count(*)`,
        last: sql<Date>`max(${barberActivities.performedAt})`,
        first: sql<Date>`min(${barberActivities.performedAt})`,
        spent: sql<string>`coalesce(sum(case when ${barberActivities.status} = 'active' then ${barberActivities.priceCharged} else 0 end), 0)`,
      })
      .from(barberActivities)
      .where(and(...svcConds))
      .groupBy(barberActivities.clientId),
    db
      .select({ clientId: productCustomerSales.clientId, spent: sql<string>`coalesce(sum(${productCustomerSales.total}), 0)` })
      .from(productCustomerSales)
      .where(and(...prodConds))
      .groupBy(productCustomerSales.clientId),
  ]);
  const map = new Map<string, ClientStats>();
  for (const r of svc) {
    map.set(r.clientId!, {
      visits: Number(r.visits),
      lastVisit: r.last ? new Date(r.last) : null,
      firstVisit: r.first ? new Date(r.first) : null,
      spent: Number(r.spent),
    });
  }
  for (const r of prod) {
    const s = map.get(r.clientId!) ?? { visits: 0, lastVisit: null, firstVisit: null, spent: 0 };
    s.spent = new Decimal(s.spent).plus(r.spent).toNumber();
    map.set(r.clientId!, s);
  }
  return map;
}

export type ClientListItem = ClientRow & ClientStats & { missing: ("phone" | "birthDate")[]; birthdayThisMonth: string | null };

export async function listClients(
  tenantId: string,
  opts: { q?: string; filter?: "incomplete" | "birthdays"; month: string }
): Promise<ClientListItem[]> {
  const q = opts.q?.trim();
  const conds = [eq(barberClients.tenantId, tenantId)];
  if (q) {
    const digits = phoneDigits(q);
    const byName = ilike(barberClients.fullName, `%${q.replace(/[%_]/g, "")}%`);
    conds.push(
      digits.length >= 3
        ? or(byName, sql`regexp_replace(coalesce(${barberClients.phone}, ''), '[^0-9]', '', 'g') like ${`%${digits}%`}`)!
        : byName
    );
  }
  if (opts.filter === "birthdays") conds.push(sql`to_char(${barberClients.birthDate}, 'MM') = ${opts.month.slice(5, 7)}`);
  if (opts.filter === "incomplete") conds.push(or(isNull(barberClients.birthDate), isNull(barberClients.phone), eq(barberClients.phone, ""))!);
  const rows = await db.select().from(barberClients).where(and(...conds)).orderBy(asc(barberClients.fullName)).limit(500);
  const stats = await statsFor(tenantId, rows.map((r) => r.id));
  return rows.map((r) => ({
    ...r,
    ...(stats.get(r.id) ?? { visits: 0, lastVisit: null, firstVisit: null, spent: 0 }),
    missing: missingFields(r),
    birthdayThisMonth: birthdayInMonth(r.birthDate, opts.month),
  }));
}

export type ClientVisit = {
  id: string;
  kind: "service" | "product";
  at: Date | null;
  date: string;
  description: string;
  barberName: string | null;
  locationName: string | null;
  paymentMethodName: string | null;
  amount: number;
  status: string;
};

export type ClientDetail = ClientRow &
  ClientStats & { missing: ("phone" | "birthDate")[]; usualBarberName: string | null; history: ClientVisit[] };

export async function getClientDetail(tenantId: string, id: string): Promise<ClientDetail | null> {
  const client = await getClientRow(tenantId, id);
  if (!client) return null;
  const [stats, svc, prod] = await Promise.all([
    statsFor(tenantId, [id]),
    db
      .select({
        id: barberActivities.id,
        at: barberActivities.performedAt,
        serviceName: services.name,
        description: barberActivities.description,
        barberId: barberActivities.barberId,
        firstName: barbers.firstName,
        lastName: barbers.lastName,
        locationName: locations.name,
        method: paymentMethods.name,
        amount: barberActivities.priceCharged,
        status: barberActivities.status,
      })
      .from(barberActivities)
      .innerJoin(barbers, eq(barbers.id, barberActivities.barberId))
      .innerJoin(locations, eq(locations.id, barberActivities.locationId))
      .innerJoin(paymentMethods, eq(paymentMethods.id, barberActivities.paymentMethodId))
      .leftJoin(services, eq(services.id, barberActivities.serviceId))
      .where(and(eq(barberActivities.tenantId, tenantId), eq(barberActivities.clientId, id)))
      .orderBy(desc(barberActivities.performedAt))
      .limit(200),
    db
      .select({
        id: productCustomerSales.id,
        date: productCustomerSales.saleDate,
        name: productCustomerSales.productName,
        quantity: productCustomerSales.quantity,
        locationName: locations.name,
        method: paymentMethods.name,
        amount: productCustomerSales.total,
      })
      .from(productCustomerSales)
      .leftJoin(locations, eq(locations.id, productCustomerSales.locationId))
      .leftJoin(paymentMethods, eq(paymentMethods.id, productCustomerSales.paymentMethodId))
      .where(and(eq(productCustomerSales.tenantId, tenantId), eq(productCustomerSales.clientId, id)))
      .orderBy(desc(productCustomerSales.saleDate))
      .limit(200),
  ]);
  const visits = svc.filter((v) => v.status !== "voided").map((v) => ({ barberId: v.barberId, date: businessDateOf(v.at) }));
  const usual = usualBarber(visits);
  const usualRow = usual ? svc.find((v) => v.barberId === usual) : null;
  const history: ClientVisit[] = [
    ...svc.map((v) => ({
      id: v.id,
      kind: "service" as const,
      at: v.at,
      date: businessDateOf(v.at),
      description: v.serviceName ?? v.description ?? "",
      barberName: `${v.firstName} ${v.lastName}`,
      locationName: v.locationName,
      paymentMethodName: v.method,
      amount: Number(v.amount),
      status: v.status,
    })),
    ...prod.map((p) => ({
      id: p.id,
      kind: "product" as const,
      at: null,
      date: p.date,
      description: p.quantity > 1 ? `${p.name} × ${p.quantity}` : p.name,
      barberName: null,
      locationName: p.locationName,
      paymentMethodName: p.method,
      amount: Number(p.amount),
      status: "active",
    })),
  ].sort((a, b) => (a.date === b.date ? (b.at?.getTime() ?? 0) - (a.at?.getTime() ?? 0) : b.date.localeCompare(a.date)));
  return {
    ...client,
    ...(stats.get(id) ?? { visits: 0, lastVisit: null, firstVisit: null, spent: 0 }),
    missing: missingFields(client),
    usualBarberName: usualRow ? `${usualRow.firstName} ${usualRow.lastName}` : null,
    history,
  };
}

// ── Panel figures ────────────────────────────────────────────────────────────

export type ClientMetrics = {
  clients: number; // unique clients served in the period
  newClients: number; // their first visit ever is in the period
  returning: number;
  unidentified: number; // services in the period with no client picked
};

/** Clients served (services or product purchases) in a period, at one location or all. */
async function clientsServed(tenantId: string, f: { from: string; to: string; locationId: string | null; barberId?: string | null }): Promise<string[]> {
  const svcConds = [
    eq(barberActivities.tenantId, tenantId),
    isNotNull(barberActivities.clientId),
    ne(barberActivities.status, "voided"),
    gte(barberActivities.performedAt, startOfBusinessDay(f.from)),
    lte(barberActivities.performedAt, endOfBusinessDay(f.to)),
  ];
  if (f.locationId) svcConds.push(eq(barberActivities.locationId, f.locationId));
  if (f.barberId) svcConds.push(eq(barberActivities.barberId, f.barberId));
  const prodConds = [
    eq(productCustomerSales.tenantId, tenantId),
    isNotNull(productCustomerSales.clientId),
    gte(productCustomerSales.saleDate, f.from),
    lte(productCustomerSales.saleDate, f.to),
  ];
  if (f.locationId) prodConds.push(eq(productCustomerSales.locationId, f.locationId));
  const [svc, prod] = await Promise.all([
    db.selectDistinct({ id: barberActivities.clientId }).from(barberActivities).where(and(...svcConds)),
    // A product sale has no professional who served it, so a barber filter leaves them out.
    f.barberId ? Promise.resolve([]) : db.selectDistinct({ id: productCustomerSales.clientId }).from(productCustomerSales).where(and(...prodConds)),
  ]);
  return [...new Set([...svc, ...prod].map((r) => r.id!).filter(Boolean))];
}

export async function getClientMetrics(tenantId: string, f: { from: string; to: string; locationId: string | null }): Promise<ClientMetrics> {
  const unidentifiedConds = [
    eq(barberActivities.tenantId, tenantId),
    isNull(barberActivities.clientId),
    ne(barberActivities.status, "voided"),
    gte(barberActivities.performedAt, startOfBusinessDay(f.from)),
    lte(barberActivities.performedAt, endOfBusinessDay(f.to)),
  ];
  if (f.locationId) unidentifiedConds.push(eq(barberActivities.locationId, f.locationId));
  const [ids, [unidentified]] = await Promise.all([
    clientsServed(tenantId, f),
    db.select({ n: sql<string>`count(*)` }).from(barberActivities).where(and(...unidentifiedConds)),
  ]);
  if (ids.length === 0) return { clients: 0, newClients: 0, returning: 0, unidentified: Number(unidentified.n) };

  // First time each client was ever served, anywhere (services or products).
  const [firstSvc, firstProd] = await Promise.all([
    db
      .select({ id: barberActivities.clientId, first: sql<Date>`min(${barberActivities.performedAt})` })
      .from(barberActivities)
      .where(and(eq(barberActivities.tenantId, tenantId), inArray(barberActivities.clientId, ids), ne(barberActivities.status, "voided")))
      .groupBy(barberActivities.clientId),
    db
      .select({ id: productCustomerSales.clientId, first: sql<string>`min(${productCustomerSales.saleDate})` })
      .from(productCustomerSales)
      .where(and(eq(productCustomerSales.tenantId, tenantId), inArray(productCustomerSales.clientId, ids)))
      .groupBy(productCustomerSales.clientId),
  ]);
  const first = new Map<string, string>();
  for (const r of firstSvc) if (r.first) first.set(r.id!, businessDateOf(new Date(r.first)));
  for (const r of firstProd) {
    const d = String(r.first).slice(0, 10);
    const cur = first.get(r.id!);
    if (!cur || d < cur) first.set(r.id!, d);
  }
  const newClients = ids.filter((id) => (first.get(id) ?? f.from) >= f.from).length;
  return { clients: ids.length, newClients, returning: ids.length - newClients, unidentified: Number(unidentified.n) };
}

export type BirthdayItem = {
  id: string;
  fullName: string;
  phone: string | null;
  birthday: string; // this year's date, YYYY-MM-DD
  birthDate: string;
  lastVisit: Date | null;
  usualBarberName: string | null;
};

/** Clients with a birthday in a "YYYY-MM" month, by day (§10.2). */
export async function listBirthdays(tenantId: string, month: string): Promise<BirthdayItem[]> {
  const rows = await db
    .select()
    .from(barberClients)
    .where(and(eq(barberClients.tenantId, tenantId), sql`to_char(${barberClients.birthDate}, 'MM') = ${month.slice(5, 7)}`));
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const visits = await db
    .select({ clientId: barberActivities.clientId, barberId: barberActivities.barberId, at: barberActivities.performedAt, firstName: barbers.firstName, lastName: barbers.lastName })
    .from(barberActivities)
    .innerJoin(barbers, eq(barbers.id, barberActivities.barberId))
    .where(and(eq(barberActivities.tenantId, tenantId), inArray(barberActivities.clientId, ids), ne(barberActivities.status, "voided")));
  return rows
    .map((r) => {
      const mine = visits.filter((v) => v.clientId === r.id);
      const usual = usualBarber(mine.map((v) => ({ barberId: v.barberId, date: businessDateOf(v.at) })));
      const usualRow = usual ? mine.find((v) => v.barberId === usual) : null;
      const last = mine.reduce<Date | null>((acc, v) => (!acc || v.at > acc ? v.at : acc), null);
      return {
        id: r.id,
        fullName: r.fullName,
        phone: r.phone,
        birthday: birthdayInMonth(r.birthDate, month)!,
        birthDate: r.birthDate!,
        lastVisit: last,
        usualBarberName: usualRow ? `${usualRow.firstName} ${usualRow.lastName}` : null,
      };
    })
    .sort((a, b) => a.birthday.localeCompare(b.birthday));
}

/** Ages of the clients served in a period (§11), filterable by location and professional. */
export async function getDemographics(
  tenantId: string,
  f: { from: string; to: string; locationId: string | null; barberId?: string | null },
  today: string
): Promise<Demographics> {
  const ids = await clientsServed(tenantId, f);
  if (ids.length === 0) return demographics([], today);
  const rows = await db
    .select({ birthDate: barberClients.birthDate })
    .from(barberClients)
    .where(and(eq(barberClients.tenantId, tenantId), inArray(barberClients.id, ids)));
  return demographics(rows.map((r) => r.birthDate), today);
}

/** For a ticket: the client must be this tenant's; returns their name for customer_name. */
export async function resolveTicketClient(tenantId: string, clientId: string | null | undefined): Promise<{ id: string; fullName: string } | null> {
  if (!clientId) return null;
  const row = await getClientRow(tenantId, clientId);
  if (!row) throw new BarbersError("notFound");
  return { id: row.id, fullName: row.fullName };
}

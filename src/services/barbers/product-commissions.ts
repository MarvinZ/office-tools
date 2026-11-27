import { and, desc, eq, gte, inArray, isNull, lte } from "drizzle-orm";
import { db } from "@/db";
import { barbers, locations, paymentMethods, productCustomerSales, products } from "@/db/schema";
import { getBarberSettings } from "./settings";
import { productSaleFigures, summarizeProductClosing, type ProductClosingSummary } from "@/lib/barbers/product-commissions";
import { isDateString } from "@/lib/barbers/dates";
import { BarbersError } from "@/lib/barbers/errors";

/**
 * Product sales to customers and the product closing (Brayan, Nov 2026).
 * Figures are computed by lib/barbers/product-commissions.ts and snapshotted
 * on the sale; commissions are paid here, separately from the service
 * settlement.
 */

export type CustomerSaleInput = {
  productId: string;
  quantity: number;
  barberId: string | null; // who earns the commission
  paymentMethodId: string | null;
  saleDate: string; // YYYY-MM-DD
  note?: string | null;
  locationId?: string | null; // where it was sold (admin panel sales by location)
};

export async function createCustomerSale(tenantId: string, userId: string, input: CustomerSaleInput) {
  const values = await prepareCustomerSale(tenantId, userId, input);
  const [row] = await db.insert(productCustomerSales).values(values).returning();
  return row;
}

/** Validate a sale and build its row without writing it (see logTicket). */
export async function prepareCustomerSale(
  tenantId: string,
  userId: string,
  input: CustomerSaleInput & { ticketId?: string | null }
): Promise<typeof productCustomerSales.$inferInsert> {
  if (!Number.isInteger(input.quantity) || input.quantity < 1) throw new BarbersError("quantityInvalid");
  if (!isDateString(input.saleDate)) throw new BarbersError("invalidDate");
  const [[product], settings] = await Promise.all([
    db.select().from(products).where(and(eq(products.tenantId, tenantId), eq(products.id, input.productId))).limit(1),
    getBarberSettings(tenantId),
  ]);
  if (!product) throw new BarbersError("notFound");
  if (input.barberId) {
    const [b] = await db.select({ id: barbers.id }).from(barbers).where(and(eq(barbers.tenantId, tenantId), eq(barbers.id, input.barberId))).limit(1);
    if (!b) throw new BarbersError("notFound");
  }
  if (input.paymentMethodId) {
    const [m] = await db
      .select({ id: paymentMethods.id })
      .from(paymentMethods)
      .where(and(eq(paymentMethods.tenantId, tenantId), eq(paymentMethods.id, input.paymentMethodId)))
      .limit(1);
    if (!m) throw new BarbersError("notFound");
  }
  if (input.locationId) {
    const [l] = await db
      .select({ id: locations.id })
      .from(locations)
      .where(and(eq(locations.tenantId, tenantId), eq(locations.id, input.locationId)))
      .limit(1);
    if (!l) throw new BarbersError("notFound");
  }

  // No collaborator → nobody earns a commission on this sale.
  const commissionPerUnit = input.barberId ? product.commissionAmount : "0";
  const ivaRate = product.chargesIva ? settings.ivaRate : 0;
  const f = productSaleFigures({
    unitPrice: product.price,
    quantity: input.quantity,
    chargesIva: product.chargesIva,
    ivaRate,
    commissionPerUnit,
  });
  return {
      id: crypto.randomUUID(),
      tenantId,
      productId: product.id,
      productName: product.name,
      quantity: input.quantity,
      unitPrice: product.price,
      ivaRate: String(ivaRate),
      ivaAmount: String(f.ivaAmount),
      total: String(f.total),
      commissionPerUnit,
      commissionTotal: String(f.commissionTotal),
      barberId: input.barberId,
      paymentMethodId: input.paymentMethodId,
      saleDate: input.saleDate,
      note: input.note?.trim() || null,
      ticketId: input.ticketId ?? null,
      locationId: input.locationId ?? null,
      createdBy: userId,
  };
}

/** Only while its commission is unpaid: a paid commission is history. */
export async function deleteCustomerSale(tenantId: string, id: string) {
  const [row] = await db
    .select()
    .from(productCustomerSales)
    .where(and(eq(productCustomerSales.tenantId, tenantId), eq(productCustomerSales.id, id)))
    .limit(1);
  if (!row) return null;
  if (row.commissionPaidAt) throw new BarbersError("commissionAlreadyPaid");
  await db.delete(productCustomerSales).where(and(eq(productCustomerSales.tenantId, tenantId), eq(productCustomerSales.id, id)));
  return row;
}

export type CustomerSaleListItem = {
  id: string;
  saleDate: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  ivaAmount: number;
  total: number;
  commissionTotal: number;
  barberId: string | null;
  barberName: string | null;
  paymentMethodName: string | null;
  commissionPaidAt: string | null;
  paidAsCashOutflow: boolean;
  note: string | null;
};

export type ProductClosing = {
  from: string;
  to: string;
  sales: CustomerSaleListItem[];
  summary: ProductClosingSummary;
  barberNames: Record<string, string>;
};

export async function getProductClosing(tenantId: string, from: string, to: string): Promise<ProductClosing> {
  const rows = await db
    .select({
      s: productCustomerSales,
      firstName: barbers.firstName,
      lastName: barbers.lastName,
      methodName: paymentMethods.name,
    })
    .from(productCustomerSales)
    .leftJoin(barbers, eq(barbers.id, productCustomerSales.barberId))
    .leftJoin(paymentMethods, eq(paymentMethods.id, productCustomerSales.paymentMethodId))
    .where(
      and(
        eq(productCustomerSales.tenantId, tenantId),
        gte(productCustomerSales.saleDate, from),
        lte(productCustomerSales.saleDate, to)
      )
    )
    .orderBy(desc(productCustomerSales.saleDate), desc(productCustomerSales.createdAt));

  const sales: CustomerSaleListItem[] = rows.map(({ s, firstName, lastName, methodName }) => ({
    id: s.id,
    saleDate: s.saleDate,
    productName: s.productName,
    quantity: s.quantity,
    unitPrice: Number(s.unitPrice),
    subtotal: Number(s.total) - Number(s.ivaAmount),
    ivaAmount: Number(s.ivaAmount),
    total: Number(s.total),
    commissionTotal: Number(s.commissionTotal),
    barberId: s.barberId,
    barberName: firstName != null ? `${firstName} ${lastName ?? ""}`.trim() : null,
    paymentMethodName: methodName,
    commissionPaidAt: s.commissionPaidAt,
    paidAsCashOutflow: s.paidAsCashOutflow,
    note: s.note,
  }));
  const summary = summarizeProductClosing(
    sales.map((s) => ({
      barberId: s.barberId,
      subtotal: s.subtotal,
      ivaAmount: s.ivaAmount,
      total: s.total,
      commissionTotal: s.commissionTotal,
      paid: s.commissionPaidAt != null,
    }))
  );
  const barberNames = Object.fromEntries(sales.filter((s) => s.barberId).map((s) => [s.barberId!, s.barberName ?? ""]));
  return { from, to, sales, summary, barberNames };
}

/**
 * Mark pending commissions as paid: one collaborator's within a date range,
 * or specific sales. Returns the sales paid and their total.
 */
export async function markCommissionsPaid(
  tenantId: string,
  userId: string,
  input: { barberId?: string; from?: string; to?: string; saleIds?: string[]; paidAt: string; asCashOutflow: boolean }
): Promise<{ count: number; amount: number }> {
  if (!isDateString(input.paidAt)) throw new BarbersError("invalidDate");
  const conditions = [eq(productCustomerSales.tenantId, tenantId), isNull(productCustomerSales.commissionPaidAt)];
  if (input.saleIds?.length) conditions.push(inArray(productCustomerSales.id, input.saleIds));
  else if (input.barberId && input.from && input.to) {
    conditions.push(
      eq(productCustomerSales.barberId, input.barberId),
      gte(productCustomerSales.saleDate, input.from),
      lte(productCustomerSales.saleDate, input.to)
    );
  } else throw new BarbersError("chooseCommissionsToPay");

  const paid = await db
    .update(productCustomerSales)
    .set({ commissionPaidAt: input.paidAt, commissionPaidBy: userId, paidAsCashOutflow: input.asCashOutflow })
    .where(and(...conditions))
    .returning({ amount: productCustomerSales.commissionTotal, barberId: productCustomerSales.barberId });
  return { count: paid.length, amount: paid.reduce((n, r) => n + Number(r.amount), 0) };
}

/** Undo a payment (a mistake): the sale's commission goes back to pending. */
export async function unmarkCommissionPaid(tenantId: string, saleId: string) {
  const [row] = await db
    .update(productCustomerSales)
    .set({ commissionPaidAt: null, commissionPaidBy: null, paidAsCashOutflow: false })
    .where(and(eq(productCustomerSales.tenantId, tenantId), eq(productCustomerSales.id, saleId)))
    .returning();
  return row ?? null;
}

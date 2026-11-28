import { and, eq, inArray } from "drizzle-orm";
import Decimal from "decimal.js";
import { db } from "@/db";
import { barberActivities, barberTicketPayments, paymentMethods, productCustomerSales } from "@/db/schema";
import { prepareActivityBatch } from "./activities";
import { prepareCustomerSale } from "./product-commissions";
import { resolveTicketClient } from "./clients";
import { getActiveShiftId } from "./cash-register";
import { businessDateOf } from "@/lib/barbers/dates";
import { BarbersError } from "@/lib/barbers/errors";
import { splitPayment } from "@/lib/barbers/payments";

/**
 * One ticket that charges services and products together (Brayan, Nov 2026:
 * "cobrar producto y servicios en la misma factura"). Everything is validated
 * first, then written in ONE db.batch, so a ticket is saved whole or not at
 * all. Services and product sales share a ticket id; product commissions are
 * still paid in the product closing, never in the service settlement.
 *
 * Payment: one method, or several that add up to the ticket's total (split,
 * NOURA Módulo 1 §5). Lines carry the method paid the most and a blended fee
 * rate, so the card fee only falls on the card part; barber_ticket_payments
 * keeps each method's amount for the register.
 */

export type TicketInput = {
  barberId: string; // who did the services; default earner of product commissions
  locationId: string;
  paymentMethodId: string;
  /** Split payment: several methods adding up to the total. Omitted = all with paymentMethodId. */
  payments?: { paymentMethodId: string; amount: number }[];
  clientId?: string | null; // a client record (barber_clients)
  customerName?: string;
  performedAt?: string; // ISO datetime; defaults to now
  services: { serviceId: string; priceCharged: number }[];
  products: { productId: string; quantity: number; barberId: string | null }[]; // barberId null = no commission
};

export async function logTicket(tenantId: string, userId: string, input: TicketInput) {
  if (input.services.length === 0 && input.products.length === 0) throw new BarbersError("emptyBatch");
  const ticketId = crypto.randomUUID();
  const performedAt = input.performedAt ?? new Date().toISOString();
  const saleDate = businessDateOf(new Date(performedAt));
  const client = await resolveTicketClient(tenantId, input.clientId);
  const customerName = client?.fullName ?? (input.customerName?.trim() || undefined);

  const activityValues = input.services.length
    ? (
        await prepareActivityBatch(tenantId, userId, {
          barberId: input.barberId,
          locationId: input.locationId,
          paymentMethodId: input.paymentMethodId,
          customerName,
          performedAt,
          lines: input.services,
        })
      ).map((v) => ({ ...v, ticketId, clientId: client?.id ?? null }))
    : [];
  const saleValues = (
    await Promise.all(
      input.products.map((p) =>
        prepareCustomerSale(tenantId, userId, {
          productId: p.productId,
          quantity: p.quantity,
          barberId: p.barberId,
          paymentMethodId: input.paymentMethodId,
          saleDate,
          note: customerName ?? null,
          ticketId,
          locationId: input.locationId,
        })
      )
    )
  ).map((v) => ({ ...v, clientId: client?.id ?? null }));

  // ── Payment ──
  const total = [...activityValues.map((a) => a.priceCharged as string), ...saleValues.map((s) => s.total as string)].reduce(
    (acc, v) => acc.plus(v),
    new Decimal(0)
  );
  const requested = input.payments?.length ? input.payments : [{ paymentMethodId: input.paymentMethodId, amount: total.toNumber() }];
  const methodIds = [...new Set(requested.map((p) => p.paymentMethodId))];
  const methods = await db
    .select({ id: paymentMethods.id, feeRate: paymentMethods.feeRate })
    .from(paymentMethods)
    .where(and(eq(paymentMethods.tenantId, tenantId), inArray(paymentMethods.id, methodIds)));
  if (methods.length !== methodIds.length) throw new BarbersError("notFound");
  const split = splitPayment(
    total,
    requested.map((p) => ({ ...p, feeRate: methods.find((m) => m.id === p.paymentMethodId)!.feeRate }))
  );
  if (!split.ok) throw new BarbersError(split.error);
  // Lines show the method paid the most; the blended rate keeps the card fee exact.
  if (split.payments.length > 1 || split.primaryMethodId !== input.paymentMethodId) {
    for (const a of activityValues) {
      a.paymentMethodId = split.primaryMethodId;
      a.paymentMethodFeeRate = split.blendedFeeRate;
    }
    for (const s of saleValues) s.paymentMethodId = split.primaryMethodId;
  }
  const cashShiftId = await getActiveShiftId(tenantId, input.locationId, saleDate);
  const paymentValues = split.payments.map((p) => ({
    id: crypto.randomUUID(),
    tenantId,
    ticketId,
    paymentMethodId: p.paymentMethodId,
    amount: p.amount,
    locationId: input.locationId,
    cashShiftId,
    createdBy: userId,
  }));

  const statements = [
    ...(activityValues.length ? [db.insert(barberActivities).values(activityValues).returning()] : []),
    ...(saleValues.length ? [db.insert(productCustomerSales).values(saleValues).returning()] : []),
    db.insert(barberTicketPayments).values(paymentValues),
  ];
  const results = (await db.batch(statements as unknown as Parameters<typeof db.batch>[0])) as unknown as unknown[][];
  const activities = (activityValues.length ? results[0] : []) as (typeof barberActivities.$inferSelect)[];
  const sales = (saleValues.length ? results[activityValues.length ? 1 : 0] : []) as (typeof productCustomerSales.$inferSelect)[];
  return { ticketId, activities, sales, split: split.payments.length > 1 };
}

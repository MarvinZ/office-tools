import { db } from "@/db";
import { barberActivities, productCustomerSales } from "@/db/schema";
import { prepareActivityBatch } from "./activities";
import { prepareCustomerSale } from "./product-commissions";
import { businessDateOf } from "@/lib/barbers/dates";
import { BarbersError } from "@/lib/barbers/errors";

/**
 * One ticket that charges services and products together (Brayan, Nov 2026:
 * "cobrar producto y servicios en la misma factura"). Everything is validated
 * first, then written in ONE db.batch, so a ticket is saved whole or not at
 * all. Services and product sales share a ticket id; product commissions are
 * still paid in the product closing, never in the service settlement.
 */

export type TicketInput = {
  barberId: string; // who did the services; default earner of product commissions
  locationId: string;
  paymentMethodId: string;
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

  const activityValues = input.services.length
    ? (
        await prepareActivityBatch(tenantId, userId, {
          barberId: input.barberId,
          locationId: input.locationId,
          paymentMethodId: input.paymentMethodId,
          customerName: input.customerName,
          performedAt,
          lines: input.services,
        })
      ).map((v) => ({ ...v, ticketId }))
    : [];
  const saleValues = await Promise.all(
    input.products.map((p) =>
      prepareCustomerSale(tenantId, userId, {
        productId: p.productId,
        quantity: p.quantity,
        barberId: p.barberId,
        paymentMethodId: input.paymentMethodId,
        saleDate,
        note: input.customerName ?? null,
        ticketId,
        locationId: input.locationId,
      })
    )
  );

  const statements = [
    ...(activityValues.length ? [db.insert(barberActivities).values(activityValues).returning()] : []),
    ...(saleValues.length ? [db.insert(productCustomerSales).values(saleValues).returning()] : []),
  ];
  const results = (await db.batch(statements as unknown as Parameters<typeof db.batch>[0])) as unknown as unknown[][];
  const activities = (activityValues.length ? results[0] : []) as (typeof barberActivities.$inferSelect)[];
  const sales = (saleValues.length ? results[activityValues.length ? 1 : 0] : []) as (typeof productCustomerSales.$inferSelect)[];
  return { ticketId, activities, sales };
}

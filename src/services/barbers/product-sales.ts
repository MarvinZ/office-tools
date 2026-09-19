import { eq, and, desc } from "drizzle-orm";
import { db } from "@/db";
import { productSales, products, barbers } from "@/db/schema";
import type { InferSelectModel } from "drizzle-orm";

// ── Raw row types ─────────────────────────────────────────────────────────────

export type ProductSaleRow = InferSelectModel<typeof productSales>;

// ── UI-ready types ────────────────────────────────────────────────────────────

export type ProductSaleWithDetails = ProductSaleRow & {
  barberName: string;
  productName: string;
};

// ── Validation ────────────────────────────────────────────────────────────────

/**
 * Both foreign keys are validated against THIS tenant before anything is
 * inserted — a client-submitted id is never trusted to be in-tenant. Same shape
 * as vouchers.ts's check, extended to two refs (as activities.ts does for four).
 */
async function assertSaleRefsBelongToTenant(
  tenantId: string,
  barberId: string,
  productId: string
): Promise<void> {
  const [[barber], [product]] = await Promise.all([
    db
      .select({ id: barbers.id })
      .from(barbers)
      .where(and(eq(barbers.tenantId, tenantId), eq(barbers.id, barberId)))
      .limit(1),
    db
      .select({ id: products.id })
      .from(products)
      .where(and(eq(products.tenantId, tenantId), eq(products.id, productId)))
      .limit(1),
  ]);
  if (!barber) throw new Error("Barber not found for this tenant.");
  if (!product) throw new Error("Product not found for this tenant.");
}

// ── Computation ───────────────────────────────────────────────────────────────

/**
 * The authoritative total. Rounded to 2 decimals in the same style as
 * computeCommissionAmount in activities.ts, though simpler: no rate or fee is
 * involved, a product sale is just quantity × the snapshotted unit price.
 */
export function computeSaleTotal(quantity: number, unitPrice: number): number {
  return Math.round(quantity * unitPrice * 100) / 100;
}

// ── Queries ───────────────────────────────────────────────────────────────────

export type ListProductSalesFilter = {
  barberId?: string;
};

/**
 * Product sales for this tenant, most recently sold first. `saleDate` is the
 * business-meaningful ordering key (the day the product changed hands);
 * `createdAt` only breaks ties between several sales dated the same day.
 */
export async function listProductSales(
  tenantId: string,
  filter: ListProductSalesFilter = {}
): Promise<ProductSaleWithDetails[]> {
  const conditions = [eq(productSales.tenantId, tenantId)];
  if (filter.barberId) conditions.push(eq(productSales.barberId, filter.barberId));

  const rows = await db
    .select({
      id: productSales.id,
      tenantId: productSales.tenantId,
      barberId: productSales.barberId,
      productId: productSales.productId,
      quantity: productSales.quantity,
      unitPrice: productSales.unitPrice,
      totalAmount: productSales.totalAmount,
      saleDate: productSales.saleDate,
      note: productSales.note,
      createdBy: productSales.createdBy,
      createdAt: productSales.createdAt,
      firstName: barbers.firstName,
      lastName: barbers.lastName,
      productName: products.name,
    })
    .from(productSales)
    .innerJoin(barbers, eq(barbers.id, productSales.barberId))
    .innerJoin(products, eq(products.id, productSales.productId))
    .where(and(...conditions))
    .orderBy(desc(productSales.saleDate), desc(productSales.createdAt));

  return rows.map(({ firstName, lastName, ...row }) => ({
    ...row,
    barberName: `${firstName} ${lastName}`,
  }));
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export type ProductSaleInput = {
  barberId: string;
  productId: string;
  quantity: number;
  saleDate: string; // YYYY-MM-DD
  note?: string;
};

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Record a product sold to a barber on credit. Like a vale, no commission, fee
 * or tax math is applied and nothing from activities.ts is involved.
 *
 * The unit price is resolved from the product's CURRENT row in the DB and
 * snapshotted onto the sale, and the total is computed from that snapshot —
 * neither is ever accepted from the caller, exactly as with commissionRate /
 * commissionAmount in logActivity. A later price change therefore cannot
 * retroactively rewrite what a barber already owes.
 */
export async function createProductSale(
  tenantId: string,
  createdBy: string,
  data: ProductSaleInput
): Promise<ProductSaleRow> {
  // Never trust client-submitted ids: both must belong to THIS tenant.
  await assertSaleRefsBelongToTenant(tenantId, data.barberId, data.productId);

  if (!DATE_ONLY_RE.test(data.saleDate)) {
    throw new Error(`Expected a YYYY-MM-DD date, got: ${data.saleDate}`);
  }
  if (!Number.isInteger(data.quantity) || data.quantity <= 0) {
    throw new Error("Quantity must be a positive whole number.");
  }

  // Tenant-scoped price lookup — the snapshot source of truth.
  const [product] = await db
    .select({ price: products.price })
    .from(products)
    .where(and(eq(products.tenantId, tenantId), eq(products.id, data.productId)))
    .limit(1);
  if (!product) throw new Error("Product not found for this tenant.");

  const unitPrice = parseFloat(product.price);
  const totalAmount = computeSaleTotal(data.quantity, unitPrice);

  const [row] = await db
    .insert(productSales)
    .values({
      id: crypto.randomUUID(),
      tenantId,
      barberId: data.barberId,
      productId: data.productId,
      quantity: data.quantity,
      unitPrice: String(unitPrice),
      totalAmount: String(totalAmount),
      saleDate: data.saleDate,
      note: data.note?.trim() ? data.note.trim() : null,
      createdBy,
    })
    .returning();
  return row;
}

/**
 * Deletion is the ONLY correction path — there is no update function, by
 * design. Always scoped by tenantId AND id together, never by id alone.
 */
export async function deleteProductSale(tenantId: string, id: string): Promise<void> {
  await db
    .delete(productSales)
    .where(and(eq(productSales.tenantId, tenantId), eq(productSales.id, id)));
}

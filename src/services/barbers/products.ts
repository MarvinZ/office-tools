import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { products } from "@/db/schema";
import type { InferSelectModel } from "drizzle-orm";

// ── Raw row types ─────────────────────────────────────────────────────────────

export type ProductRow = InferSelectModel<typeof products>;

// ── Queries ───────────────────────────────────────────────────────────────────

export async function listProducts(tenantId: string): Promise<ProductRow[]> {
  return db
    .select()
    .from(products)
    .where(eq(products.tenantId, tenantId))
    .orderBy(products.name);
}

export async function getProduct(tenantId: string, id: string): Promise<ProductRow | null> {
  const [row] = await db
    .select()
    .from(products)
    .where(and(eq(products.tenantId, tenantId), eq(products.id, id)))
    .limit(1);
  return row ?? null;
}

// ── Mutations ─────────────────────────────────────────────────────────────────
// Note: no delete function is implemented on purpose. Once a product has
// product_sales referencing it, hard-deleting it would corrupt historical debt
// records. Deactivating (status: "inactive") is the only supported way to
// retire a product — same rule as services, locations, barbers and payment
// methods.

export type ProductInput = {
  name: string;
  price: number;
  status: ProductRow["status"];
  tags?: string[];
};

export async function createProduct(
  tenantId: string,
  createdBy: string,
  data: ProductInput
): Promise<ProductRow> {
  const [row] = await db
    .insert(products)
    .values({
      id: crypto.randomUUID(),
      tenantId,
      createdBy,
      name: data.name,
      price: String(data.price),
      status: data.status,
      tags: data.tags ?? [],
    })
    .returning();
  return row;
}

export async function updateProduct(
  tenantId: string,
  id: string,
  data: Partial<ProductInput>
): Promise<ProductRow | null> {
  const [row] = await db
    .update(products)
    .set({
      ...data,
      price: data.price != null ? String(data.price) : undefined,
      updatedAt: new Date(),
    })
    .where(and(eq(products.tenantId, tenantId), eq(products.id, id)))
    .returning();
  return row ?? null;
}

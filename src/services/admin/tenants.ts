import { db } from "@/db";
import { tenants, tools, tenantTools } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export type TenantRow = typeof tenants.$inferSelect;
export type ToolRow = typeof tools.$inferSelect;

// ── Tenants ───────────────────────────────────────────────────────────────────

export async function adminListTenants() {
  return db.select().from(tenants).orderBy(tenants.createdAt);
}

export async function adminGetTenant(id: string) {
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, id)).limit(1);
  return tenant ?? null;
}

export async function adminCreateTenant(values: {
  id: string;
  clerkOrgId: string;
  name: string;
  slug: string;
}) {
  const [tenant] = await db.insert(tenants).values({ ...values, isActive: true }).returning();
  return tenant;
}

export async function adminUpdateTenantStatus(id: string, isActive: boolean) {
  await db.update(tenants).set({ isActive }).where(eq(tenants.id, id));
}

// ── Tools ─────────────────────────────────────────────────────────────────────

export async function adminListTools() {
  return db.select().from(tools);
}

/** Returns tool slugs enabled for a given tenant. */
export async function adminGetEnabledTools(tenantId: string): Promise<string[]> {
  const rows = await db
    .select({ slug: tools.slug })
    .from(tenantTools)
    .innerJoin(tools, eq(tenantTools.toolId, tools.id))
    .where(eq(tenantTools.tenantId, tenantId));

  return rows.map((r) => r.slug);
}

export async function adminEnableTool(tenantId: string, toolId: string) {
  await db
    .insert(tenantTools)
    .values({ tenantId, toolId })
    .onConflictDoNothing();
}

export async function adminDisableTool(tenantId: string, toolId: string) {
  await db
    .delete(tenantTools)
    .where(and(eq(tenantTools.tenantId, tenantId), eq(tenantTools.toolId, toolId)));
}

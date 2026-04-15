import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { tenants } from "@/db/schema";
import { eq } from "drizzle-orm";

export type TenantRow = typeof tenants.$inferSelect;

// ── Real tenant resolution from Clerk org ────────────────────────────────────

export async function getCurrentTenant(): Promise<TenantRow | null> {
  const { orgId } = await auth();
  if (!orgId) return null;

  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.clerkOrgId, orgId))
    .limit(1);

  return tenant ?? null;
}

/** Use in (app) pages — redirects to /select-org if no matching tenant. */
export async function requireTenant(): Promise<TenantRow> {
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/select-org");
  return tenant;
}

// ── Generic DB helpers ───────────────────────────────────────────────────────

export async function getTenant(id: string): Promise<TenantRow | null> {
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, id))
    .limit(1);

  return tenant ?? null;
}

export async function listTenants(): Promise<TenantRow[]> {
  return db.select().from(tenants).orderBy(tenants.createdAt);
}

// ── Legacy shim (ensureTenant used by old layout — now a no-op wrapper) ─────

/** @deprecated Use requireTenant() instead. */
export async function ensureTenant() {
  return requireTenant();
}

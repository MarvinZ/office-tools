import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { tenants, tenantTools, tools } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { adminGetEnabledTools } from "./admin/tenants";

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

// ── Tool access ──────────────────────────────────────────────────────────────

/**
 * The tool slugs this tenant may use right now: the ones enabled for it in
 * admin, or none at all while the tenant is marked inactive.
 */
export async function getAvailableTools(tenant: TenantRow): Promise<string[]> {
  if (!tenant.isActive) return [];
  return adminGetEnabledTools(tenant.id);
}

/**
 * Use in each tool's layout.tsx: hiding a nav link isn't access control, so
 * every page of a tool checks the tool is actually available to the tenant.
 * Route handlers don't run layouts — they call getAvailableTools themselves.
 */
export async function requireTool(slug: string): Promise<TenantRow> {
  const tenant = await requireTenant();
  if (!(await getAvailableTools(tenant)).includes(slug)) redirect("/dashboard");
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

export async function getTenantByClerkOrgId(clerkOrgId: string): Promise<TenantRow | null> {
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.clerkOrgId, clerkOrgId))
    .limit(1);

  return tenant ?? null;
}

/** Of the given Clerk orgs, the active tenants that have `toolSlug` enabled. */
export async function listActiveTenantsWithTool(clerkOrgIds: string[], toolSlug: string): Promise<TenantRow[]> {
  if (clerkOrgIds.length === 0) return [];
  const rows = await db
    .select({ tenant: tenants })
    .from(tenants)
    .innerJoin(tenantTools, eq(tenantTools.tenantId, tenants.id))
    .innerJoin(tools, eq(tools.id, tenantTools.toolId))
    .where(and(inArray(tenants.clerkOrgId, clerkOrgIds), eq(tenants.isActive, true), eq(tools.slug, toolSlug)));

  return rows.map((r) => r.tenant);
}

export async function listTenants(): Promise<TenantRow[]> {
  return db.select().from(tenants).orderBy(tenants.createdAt);
}

// ── Legacy shim (ensureTenant used by old layout — now a no-op wrapper) ─────

/** @deprecated Use requireTenant() instead. */
export async function ensureTenant() {
  return requireTenant();
}

import { db } from "@/db";
import { tenants } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  DEV_TENANT_ID,
  DEV_TENANT_NAME,
  DEV_TENANT_SLUG,
  DEV_TENANT_CLERK_ORG_ID,
} from "@/lib/constants";

export async function ensureTenant() {
  const existing = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, DEV_TENANT_ID))
    .limit(1);

  if (existing.length > 0) return existing[0];

  const [tenant] = await db
    .insert(tenants)
    .values({
      id: DEV_TENANT_ID,
      name: DEV_TENANT_NAME,
      slug: DEV_TENANT_SLUG,
      clerkOrgId: DEV_TENANT_CLERK_ORG_ID,
      isActive: true,
    })
    .returning();

  return tenant;
}

export async function getTenant(id: string) {
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, id))
    .limit(1);

  return tenant ?? null;
}

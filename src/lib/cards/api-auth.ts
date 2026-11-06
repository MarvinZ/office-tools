import { auth, clerkClient } from "@clerk/nextjs/server";
import { getAvailableTools, getTenantByClerkOrgId, listActiveTenantsWithTool, type TenantRow } from "@/services/tenants";
import { getCollector, getOrCreateCollector, type CollectorRow } from "@/services/cards/collectors";
import { ApiError } from "./errors";
import { canReadCollection, canWriteCollection } from "./permissions";

const TOOL_SLUG = "cards";
const PARENT_ROLE = "org:admin";

export type CardsApiContext = {
  userId: string;
  tenant: TenantRow;
  collector: CollectorRow; // the caller
  isParent: boolean;
};

/**
 * Authenticates a cards API request (spec §3). The app sends `Authorization: Bearer <Clerk
 * session JWT>`; `/api/cards/*` is public in proxy.ts so that failures here come back as JSON
 * 401/403/409 rather than the sign-in redirect pages get.
 *
 * Family resolution: the token's active org if it has one; otherwise the caller's single Clerk
 * membership whose tenant is active and has Cards enabled (or the one named by `X-Tenant-Id`).
 */
export async function requireCardsApiContext(req: Request): Promise<CardsApiContext> {
  const { userId, orgId, orgRole } = await auth();
  if (!userId) throw new ApiError(401, "unauthenticated", "Missing or invalid session token.");

  const requestedTenantId = req.headers.get("x-tenant-id");
  let tenant: TenantRow | null;
  let role: string | null | undefined;

  if (orgId) {
    tenant = await getTenantByClerkOrgId(orgId);
    role = orgRole;
    if (!tenant) throw new ApiError(403, "tool_disabled", "Cards isn't available for this organization.");
    if (requestedTenantId && requestedTenantId !== tenant.id) {
      throw new ApiError(409, "tenant_mismatch", "X-Tenant-Id doesn't match the session's active organization.");
    }
    if (!(await getAvailableTools(tenant)).includes(TOOL_SLUG)) {
      throw new ApiError(403, "tool_disabled", "Cards isn't enabled for this family.");
    }
  } else {
    const clerk = await clerkClient();
    const { data: memberships } = await clerk.users.getOrganizationMembershipList({ userId, limit: 100 });
    const candidates = await listActiveTenantsWithTool(
      memberships.map((m) => m.organization.id),
      TOOL_SLUG,
    );

    if (requestedTenantId) {
      tenant = candidates.find((t) => t.id === requestedTenantId) ?? null;
      if (!tenant) throw new ApiError(403, "tool_disabled", "Cards isn't enabled for that family, or you aren't a member.");
    } else if (candidates.length === 1) {
      tenant = candidates[0];
    } else {
      throw new ApiError(
        409,
        "tenant_ambiguous",
        candidates.length === 0 ? "You aren't in any family with Cards enabled." : "Pick a family with X-Tenant-Id.",
      );
    }
    role = memberships.find((m) => m.organization.id === tenant!.clerkOrgId)?.role;
  }

  const collector = await getOrCreateCollector(tenant.id, userId, async () => {
    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);
    return user.firstName || user.username || "Collector";
  });

  return { userId, tenant, collector, isParent: role === PARENT_ROLE };
}

/**
 * The collection a request targets (`me` = the caller), checked against the permission matrix.
 * Lookups are always within the caller's family, so another family's id is simply a 404.
 */
export async function resolveTargetCollector(
  ctx: CardsApiContext,
  collectorId: string,
  access: "read" | "write",
): Promise<CollectorRow> {
  const target = collectorId === "me" ? ctx.collector : await getCollector(ctx.tenant.id, collectorId);
  if (!target) throw new ApiError(404, "not_found", "Collector not found.");

  const viewer = { collectorId: ctx.collector.id, isParent: ctx.isParent };
  if (access === "read" && !canReadCollection(viewer, target)) {
    throw new ApiError(403, "collection_private", "This collection is private.");
  }
  if (access === "write" && !canWriteCollection(viewer, target)) {
    throw new ApiError(403, "forbidden", "You can only change your own collection.");
  }
  return target;
}

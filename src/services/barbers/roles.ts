import { and, eq, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { barberMemberRoles, locations } from "@/db/schema";
import { requireTenant, type TenantRow } from "@/services/tenants";
import { getOrgMembers } from "@/lib/clerk-admin";
import { BARBERS_ROLES, canAny, homeOf, type BarbersArea, type BarbersRole } from "@/lib/barbers/permissions";
import { BarbersError } from "@/lib/barbers/errors";

/**
 * The signed-in person's role in Barbers. An assigned role (set by an admin)
 * wins; otherwise a Clerk org admin is an admin and anyone else a cashier.
 */
export type MyBarbersRole = {
  role: BarbersRole;
  userId: string;
  tenant: TenantRow;
  /** Locations this person may work at; null = all of them. */
  locationIds: string[] | null;
};

export async function getMyBarbersRole(tenant?: TenantRow): Promise<MyBarbersRole> {
  const [{ userId, orgRole }, t] = await Promise.all([auth(), tenant ? Promise.resolve(tenant) : requireTenant()]);
  if (!userId) throw new BarbersError("notAuthenticated");
  const [row] = await db
    .select({ role: barberMemberRoles.role, locationIds: barberMemberRoles.locationIds })
    .from(barberMemberRoles)
    .where(and(eq(barberMemberRoles.tenantId, t.id), eq(barberMemberRoles.userId, userId)))
    .limit(1);
  const assigned = row && (BARBERS_ROLES as string[]).includes(row.role) ? (row.role as BarbersRole) : null;
  return {
    role: assigned ?? (orgRole === "org:admin" ? "admin" : "cashier"),
    userId,
    tenant: t,
    locationIds: row && row.locationIds.length > 0 ? row.locationIds : null,
  };
}

/** Whether this person may work at a location (no restriction = everywhere). */
export function canUseLocation(me: Pick<MyBarbersRole, "locationIds">, locationId: string): boolean {
  return me.locationIds === null || me.locationIds.includes(locationId);
}

/**
 * For front-desk actions that happen at a location: the role must cover one of
 * `areas` AND the person must be allowed at that location. A person limited
 * to some locations must always say which one (`null` is refused).
 */
export async function requireBarbersLocation(areas: BarbersArea[], locationId: string | null | undefined) {
  const me = await requireBarbersAccess(areas);
  if (!locationId) {
    if (me.locationIds !== null) throw new BarbersError("locationRequired");
  } else if (!canUseLocation(me, locationId)) {
    throw new BarbersError("locationNotAllowed");
  }
  return me;
}

/** For server actions and routes: throws unless the role covers one of `areas`. */
export async function requireBarbersAccess(areas: BarbersArea[]) {
  const me = await getMyBarbersRole();
  if (!canAny(me.role, areas)) throw new BarbersError("forbidden");
  return me;
}

/** For pages: sends the person to their own start page when they can't see this one. */
export async function requireBarbersPage(areas: BarbersArea[]) {
  const me = await getMyBarbersRole();
  if (!canAny(me.role, areas)) redirect(homeOf(me.role));
  return me;
}

export type BarbersMember = {
  userId: string;
  name: string;
  email: string;
  clerkRole: string;
  role: BarbersRole;
  assigned: boolean;
  locationIds: string[]; // empty = every location
};

/** Everyone in the tenant's organization, with their Barbers role. */
export async function listBarbersMembers(tenant: TenantRow): Promise<BarbersMember[]> {
  const [members, rows] = await Promise.all([
    getOrgMembers(tenant.clerkOrgId),
    db.select().from(barberMemberRoles).where(eq(barberMemberRoles.tenantId, tenant.id)),
  ]);
  const byUser = new Map(rows.map((r) => [r.userId, r.role as BarbersRole]));
  const locationsByUser = new Map(rows.map((r) => [r.userId, r.locationIds]));
  return members
    .filter((m) => m.publicUserData?.userId)
    .map((m) => {
      const userId = m.publicUserData!.userId;
      const assigned = byUser.get(userId);
      return {
        userId,
        name: [m.publicUserData?.firstName, m.publicUserData?.lastName].filter(Boolean).join(" ") || "—",
        email: m.publicUserData?.identifier ?? "",
        clerkRole: m.role,
        role: assigned ?? (m.role === "org:admin" ? "admin" : "cashier"),
        assigned: assigned != null,
        locationIds: locationsByUser.get(userId) ?? [],
      };
    });
}

/** Set someone's role. Admins can't change their own (no locking yourself out). */
export async function setMemberRole(tenant: TenantRow, adminUserId: string, userId: string, role: BarbersRole) {
  if (!BARBERS_ROLES.includes(role)) throw new BarbersError("invalidInput");
  if (userId === adminUserId) throw new BarbersError("ownRole");
  const members = await getOrgMembers(tenant.clerkOrgId);
  if (!members.some((m) => m.publicUserData?.userId === userId)) throw new BarbersError("notInOrganization");
  const [before] = await db
    .select({ role: barberMemberRoles.role })
    .from(barberMemberRoles)
    .where(and(eq(barberMemberRoles.tenantId, tenant.id), eq(barberMemberRoles.userId, userId)))
    .limit(1);
  await db
    .insert(barberMemberRoles)
    .values({ tenantId: tenant.id, userId, role, updatedBy: adminUserId, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: [barberMemberRoles.tenantId, barberMemberRoles.userId],
      set: { role, updatedBy: adminUserId, updatedAt: new Date() },
    });
  return { previous: before?.role ?? null };
}

/**
 * Limit where someone may work (empty = every location). Keeps their role; a
 * person without an assigned role row gets one with their current role.
 */
export async function setMemberLocations(
  tenant: TenantRow,
  adminUserId: string,
  userId: string,
  locationIds: string[]
): Promise<{ previous: string[] }> {
  const ids = [...new Set(locationIds)];
  if (ids.some((id) => typeof id !== "string" || !id)) throw new BarbersError("invalidInput");
  const [members, owned, [before]] = await Promise.all([
    getOrgMembers(tenant.clerkOrgId),
    ids.length
      ? db.select({ id: locations.id }).from(locations).where(and(eq(locations.tenantId, tenant.id), inArray(locations.id, ids)))
      : Promise.resolve([]),
    db
      .select({ role: barberMemberRoles.role, locationIds: barberMemberRoles.locationIds })
      .from(barberMemberRoles)
      .where(and(eq(barberMemberRoles.tenantId, tenant.id), eq(barberMemberRoles.userId, userId)))
      .limit(1),
  ]);
  const member = members.find((m) => m.publicUserData?.userId === userId);
  if (!member) throw new BarbersError("notInOrganization");
  if (owned.length !== ids.length) throw new BarbersError("notFound");

  const role = before?.role ?? (member.role === "org:admin" ? "admin" : "cashier");
  await db
    .insert(barberMemberRoles)
    .values({ tenantId: tenant.id, userId, role, locationIds: ids, updatedBy: adminUserId, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: [barberMemberRoles.tenantId, barberMemberRoles.userId],
      set: { locationIds: ids, updatedBy: adminUserId, updatedAt: new Date() },
    });
  return { previous: before?.locationIds ?? [] };
}

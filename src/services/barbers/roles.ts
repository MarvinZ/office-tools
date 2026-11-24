import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { barberMemberRoles } from "@/db/schema";
import { requireTenant, type TenantRow } from "@/services/tenants";
import { getOrgMembers } from "@/lib/clerk-admin";
import { BARBERS_ROLES, canAny, homeOf, type BarbersArea, type BarbersRole } from "@/lib/barbers/permissions";

/**
 * The signed-in person's role in Barbers. An assigned role (set by an admin)
 * wins; otherwise a Clerk org admin is an admin and anyone else a cashier.
 */
export async function getMyBarbersRole(tenant?: TenantRow): Promise<{ role: BarbersRole; userId: string; tenant: TenantRow }> {
  const [{ userId, orgRole }, t] = await Promise.all([auth(), tenant ? Promise.resolve(tenant) : requireTenant()]);
  if (!userId) throw new Error("Not authenticated.");
  const [row] = await db
    .select({ role: barberMemberRoles.role })
    .from(barberMemberRoles)
    .where(and(eq(barberMemberRoles.tenantId, t.id), eq(barberMemberRoles.userId, userId)))
    .limit(1);
  const assigned = row && (BARBERS_ROLES as string[]).includes(row.role) ? (row.role as BarbersRole) : null;
  return { role: assigned ?? (orgRole === "org:admin" ? "admin" : "cashier"), userId, tenant: t };
}

/** For server actions and routes: throws unless the role covers one of `areas`. */
export async function requireBarbersAccess(areas: BarbersArea[]) {
  const me = await getMyBarbersRole();
  if (!canAny(me.role, areas)) throw new Error("You don't have permission to do this.");
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
};

/** Everyone in the tenant's organization, with their Barbers role. */
export async function listBarbersMembers(tenant: TenantRow): Promise<BarbersMember[]> {
  const [members, rows] = await Promise.all([
    getOrgMembers(tenant.clerkOrgId),
    db.select().from(barberMemberRoles).where(eq(barberMemberRoles.tenantId, tenant.id)),
  ]);
  const byUser = new Map(rows.map((r) => [r.userId, r.role as BarbersRole]));
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
      };
    });
}

/** Set someone's role. Admins can't change their own (no locking yourself out). */
export async function setMemberRole(tenant: TenantRow, adminUserId: string, userId: string, role: BarbersRole) {
  if (!BARBERS_ROLES.includes(role)) throw new Error("Unknown role.");
  if (userId === adminUserId) throw new Error("You can't change your own role.");
  const members = await getOrgMembers(tenant.clerkOrgId);
  if (!members.some((m) => m.publicUserData?.userId === userId)) throw new Error("That person isn't in this organization.");
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

import { clerkClient } from "@clerk/nextjs/server";

/**
 * Creates a new Clerk organization for a client tenant.
 * The caller (adminUserId) becomes the org owner — that's required by Clerk's API.
 * They can be removed later from the org if needed.
 */
export async function createClientOrg(name: string, adminUserId: string) {
  const clerk = await clerkClient();
  const org = await clerk.organizations.createOrganization({
    name,
    createdBy: adminUserId,
  });
  return org;
}

/**
 * Sends a Clerk organization invitation to the specified email.
 * The invitee gets org:admin role so they can invite their own team.
 */
export async function inviteClientAdmin(orgId: string, email: string) {
  const clerk = await clerkClient();
  const invitation = await clerk.organizations.createOrganizationInvitation({
    organizationId: orgId,
    emailAddress: email,
    role: "org:admin",
    redirectUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/dashboard`,
  });
  return invitation;
}

/**
 * Lists all members of an organization.
 */
export async function getOrgMembers(orgId: string) {
  const clerk = await clerkClient();
  const { data } = await clerk.organizations.getOrganizationMembershipList({
    organizationId: orgId,
  });
  return data;
}

/**
 * Lists pending invitations for an organization.
 */
export async function getOrgInvitations(orgId: string) {
  const clerk = await clerkClient();
  const { data } = await clerk.organizations.getOrganizationInvitationList({
    organizationId: orgId,
    status: ["pending"],
  });
  return data;
}

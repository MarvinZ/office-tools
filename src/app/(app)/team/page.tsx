import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { getTranslations } from "next-intl/server";
import { requireTenant } from "@/services/tenants";
import { getOrgMembers, getOrgInvitations } from "@/lib/clerk-admin";
import InviteTeamMember from "./_components/invite-team-member";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const { orgRole } = await auth();
  if (orgRole !== "org:admin") redirect("/dashboard");

  const [tenant, t] = await Promise.all([requireTenant(), getTranslations("team")]);

  const [members, invitations] = await Promise.allSettled([
    getOrgMembers(tenant.clerkOrgId),
    getOrgInvitations(tenant.clerkOrgId),
  ]);

  const memberList = members.status === "fulfilled" ? members.value : [];
  const invitationList = invitations.status === "fulfilled" ? invitations.value : [];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold text-black dark:text-white">{t("page.title")}</h1>
        <p className="mt-1 text-sm text-zinc-500">{t("page.subtitle")}</p>
      </div>

      <InviteTeamMember />

      <div className="flex flex-col gap-2">
        {memberList.length === 0 && invitationList.length === 0 ? (
          <p className="text-sm text-zinc-400">{t("page.empty")}</p>
        ) : (
          <>
            {memberList.map((m) => {
              const name = [m.publicUserData?.firstName, m.publicUserData?.lastName].filter(Boolean).join(" ") || "—";
              return (
                <div key={m.id} className="flex items-center justify-between rounded-xl border border-zinc-200 px-4 py-3 dark:border-zinc-800">
                  <div>
                    <p className="text-sm font-medium text-black dark:text-white">{name}</p>
                    <p className="text-xs text-zinc-400">{m.publicUserData?.identifier ?? "—"}</p>
                  </div>
                  <span className="text-xs text-zinc-400 capitalize">{m.role.replace("org:", "")}</span>
                </div>
              );
            })}

            {invitationList.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between rounded-xl border border-zinc-200 px-4 py-3 dark:border-zinc-800 opacity-60">
                <div>
                  <p className="text-sm font-medium text-black dark:text-white">{inv.emailAddress}</p>
                  <p className="text-xs text-zinc-400">{t("page.invitationPending")}</p>
                </div>
                <span className="inline-flex rounded-full bg-yellow-50 px-2 py-0.5 text-xs font-medium text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                  {t("page.pending")}
                </span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

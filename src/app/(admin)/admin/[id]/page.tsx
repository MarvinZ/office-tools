import { notFound } from "next/navigation";
import Link from "next/link";
import { adminGetTenant, adminListTools, adminGetEnabledTools } from "@/services/admin/tenants";
import { getDemoStatus } from "@/services/admin/demo";
import { getOrgMembers, getOrgInvitations } from "@/lib/clerk-admin";
import ToolToggles from "./_components/tool-toggles";
import StatusToggle from "./_components/status-toggle";
import DemoSeedPanel from "./_components/demo-seed-panel";

type Props = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export default async function AdminClientPage({ params }: Props) {
  const { id } = await params;

  const [tenant, allTools, enabledSlugs, demoStatus] = await Promise.all([
    adminGetTenant(id),
    adminListTools(),
    adminGetEnabledTools(id),
    getDemoStatus(id),
  ]);

  if (!tenant) notFound();

  // Load Clerk data (members + pending invitations)
  const [members, invitations] = await Promise.allSettled([
    getOrgMembers(tenant.clerkOrgId),
    getOrgInvitations(tenant.clerkOrgId),
  ]);

  const memberList = members.status === "fulfilled" ? members.value : [];
  const invitationList = invitations.status === "fulfilled" ? invitations.value : [];

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-zinc-400">
        <Link href="/admin" className="hover:text-black dark:hover:text-white">Clients</Link>
        <span>›</span>
        <span className="text-black dark:text-white">{tenant.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-black dark:text-white">{tenant.name}</h1>
          <p className="mt-1 text-sm text-zinc-500 font-mono">{tenant.slug}</p>
        </div>
        <StatusToggle tenantId={tenant.id} isActive={tenant.isActive} />
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Tools */}
        <section className="flex flex-col gap-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Enabled Tools</h2>
          <ToolToggles tenantId={tenant.id} tools={allTools} enabledSlugs={enabledSlugs} />
        </section>

        {/* Team / Members */}
        <section className="flex flex-col gap-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Team Members</h2>

          {memberList.length === 0 && invitationList.length === 0 ? (
            <p className="text-sm text-zinc-400">No members yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
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
                    <p className="text-xs text-zinc-400">Invitation pending</p>
                  </div>
                  <span className="inline-flex rounded-full bg-yellow-50 px-2 py-0.5 text-xs font-medium text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                    Pending
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Demo data */}
      <DemoSeedPanel
        tenantId={tenant.id}
        demoClients={demoStatus.clients}
        demoProviders={demoStatus.providers}
        demoEmployees={demoStatus.employees}
        demoQuotes={demoStatus.quotes}
        demoAssets={demoStatus.assets}
      />

      {/* Clerk Org ID (for reference) */}
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-5 py-4 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-400 mb-2">Clerk Org ID</p>
        <p className="font-mono text-sm text-zinc-600 dark:text-zinc-400">{tenant.clerkOrgId}</p>
      </div>
    </div>
  );
}

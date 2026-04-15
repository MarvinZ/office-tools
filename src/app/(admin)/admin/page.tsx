import Link from "next/link";
import { adminListTenants } from "@/services/admin/tenants";
import CreateClientModal from "./_components/create-client-modal";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const tenants = await adminListTenants();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-black dark:text-white">Clients</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {tenants.length} {tenants.length === 1 ? "client" : "clients"} onboarded
          </p>
        </div>
        <CreateClientModal />
      </div>

      {tenants.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 bg-white px-6 py-16 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-500">No clients yet. Create your first one.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50">
                {["Company", "Slug", "Clerk Org", "Status", "Created", ""].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => (
                <tr key={t.id} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/50">
                  <td className="px-5 py-3 font-medium text-black dark:text-white">{t.name}</td>
                  <td className="px-5 py-3 font-mono text-xs text-zinc-500">{t.slug}</td>
                  <td className="px-5 py-3 font-mono text-xs text-zinc-400">{t.clerkOrgId}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      t.isActive
                        ? "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                    }`}>
                      {t.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-zinc-500">
                    {new Date(t.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Link href={`/admin/${t.id}`} className="text-xs text-zinc-400 hover:text-black dark:hover:text-white">
                      Manage →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

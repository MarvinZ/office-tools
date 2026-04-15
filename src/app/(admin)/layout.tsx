import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";

/** Only members of the internal Clerk org can access /admin routes. */
async function requireInternalOrg() {
  const { orgId } = await auth();
  const internalOrgId = process.env.INTERNAL_ORG_ID;

  if (!internalOrgId) {
    throw new Error("INTERNAL_ORG_ID env var is not set. Add it to .env.local.");
  }

  if (orgId !== internalOrgId) {
    redirect("/dashboard");
  }
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireInternalOrg();

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-zinc-200 bg-zinc-950 dark:border-zinc-800">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <Link href="/admin" className="text-sm font-semibold text-white">
              OfficeTools <span className="ml-1 rounded bg-zinc-700 px-1.5 py-0.5 text-xs text-zinc-300">Admin</span>
            </Link>
            <nav className="flex items-center gap-4">
              <Link href="/admin" className="text-sm text-zinc-400 transition-colors hover:text-white">
                Clients
              </Link>
            </nav>
          </div>
          <UserButton />
        </div>
      </header>
      <main className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">{children}</main>
    </div>
  );
}

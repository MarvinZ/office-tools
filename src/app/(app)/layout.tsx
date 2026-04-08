import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { ensureTenant } from "@/services/tenants";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await ensureTenant();

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-black">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="text-sm font-semibold text-black dark:text-white">
              OfficeTools
            </Link>
            <nav className="flex items-center gap-4">
              <Link
                href="/payroll"
                className="text-sm text-zinc-500 transition-colors hover:text-black dark:text-zinc-400 dark:hover:text-white"
              >
                Payroll
              </Link>
              <Link
                href="/dev"
                className="text-sm text-zinc-500 transition-colors hover:text-black dark:text-zinc-400 dark:hover:text-white"
              >
                Dev
              </Link>
            </nav>
          </div>
          <UserButton />
        </div>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}

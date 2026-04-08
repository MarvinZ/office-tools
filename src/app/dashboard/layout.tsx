import { UserButton } from "@clerk/nextjs";
import Link from "next/link";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-black">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Link href="/dashboard" className="text-sm font-semibold text-black dark:text-white">
            OfficeTools
          </Link>
          <nav className="flex items-center gap-6">
            <Link href="/dashboard" className="text-sm text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-white">
              Dashboard
            </Link>
            <UserButton />
          </nav>
        </div>
      </header>
      <main className="flex flex-1 flex-col">
        {children}
      </main>
    </div>
  );
}

import { currentUser } from "@clerk/nextjs/server";
import Link from "next/link";

export default async function DashboardPage() {
  const user = await currentUser();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold text-black dark:text-white">
          Welcome back, {user?.firstName ?? "there"}!
        </h1>
        <p className="mt-1 text-sm text-zinc-500">Here's your dashboard.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link
          href="/payroll"
          className="rounded-xl border border-zinc-200 bg-zinc-50 p-6 transition-colors hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600"
        >
          <p className="font-semibold text-black dark:text-white">Payroll</p>
          <p className="mt-1 text-sm text-zinc-500">Upload and send payroll emails to employees.</p>
        </Link>
        <Link
          href="/dev"
          className="rounded-xl border border-zinc-200 bg-zinc-50 p-6 transition-colors hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600"
        >
          <p className="font-semibold text-black dark:text-white">Dev Tools</p>
          <p className="mt-1 text-sm text-zinc-500">File browser and test email utilities.</p>
        </Link>
      </div>
    </div>
  );
}

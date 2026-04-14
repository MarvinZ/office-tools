import { currentUser } from "@clerk/nextjs/server";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

export default async function DashboardPage() {
  const user = await currentUser();
  const t = await getTranslations("dashboard");

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold text-black dark:text-white">
          {t("greeting", { name: user?.firstName ?? "there" })}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">{t("subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link href="/payroll" className="rounded-xl border border-zinc-200 bg-zinc-50 p-6 transition-colors hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600">
          <p className="font-semibold text-black dark:text-white">{t("payrollCard.title")}</p>
          <p className="mt-1 text-sm text-zinc-500">{t("payrollCard.description")}</p>
        </Link>
        <Link href="/assets" className="rounded-xl border border-zinc-200 bg-zinc-50 p-6 transition-colors hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600">
          <p className="font-semibold text-black dark:text-white">Assets</p>
          <p className="mt-1 text-sm text-zinc-500">Track and manage company equipment and resources.</p>
        </Link>
        <Link href="/employees" className="rounded-xl border border-zinc-200 bg-zinc-50 p-6 transition-colors hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600">
          <p className="font-semibold text-black dark:text-white">Employees</p>
          <p className="mt-1 text-sm text-zinc-500">Manage your team, roles, and HR records.</p>
        </Link>
        <Link href="/dev" className="rounded-xl border border-zinc-200 bg-zinc-50 p-6 transition-colors hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600">
          <p className="font-semibold text-black dark:text-white">{t("devCard.title")}</p>
          <p className="mt-1 text-sm text-zinc-500">{t("devCard.description")}</p>
        </Link>
      </div>
    </div>
  );
}

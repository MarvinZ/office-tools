import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";
import { getTranslations, getLocale } from "next-intl/server";
import { requireTenant } from "@/services/tenants";
import LocaleSwitcher from "@/components/locale-switcher";
import ThemeToggle from "@/components/theme-toggle";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { orgId } = await auth();

  // If the user is in the internal admin org, send them to /admin
  if (orgId && orgId === process.env.INTERNAL_ORG_ID) {
    redirect("/admin");
  }

  const tenant = await requireTenant();
  const t = await getTranslations("nav");
  const locale = await getLocale();

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-black">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="text-sm font-semibold text-black dark:text-white">
              {t("appName")}
            </Link>
            <div className="hidden h-4 w-px bg-zinc-200 dark:bg-zinc-700 sm:block" />
            <span className="hidden text-sm text-zinc-500 dark:text-zinc-400 sm:block">{tenant.name}</span>
            <nav className="flex items-center gap-4">
              <Link href="/payroll" className="text-sm text-zinc-500 transition-colors hover:text-black dark:text-zinc-400 dark:hover:text-white">
                {t("payroll")}
              </Link>
              <Link href="/assets" className="text-sm text-zinc-500 transition-colors hover:text-black dark:text-zinc-400 dark:hover:text-white">
                {t("assets")}
              </Link>
              <Link href="/employees" className="text-sm text-zinc-500 transition-colors hover:text-black dark:text-zinc-400 dark:hover:text-white">
                {t("employees")}
              </Link>
              <Link href="/quotes" className="text-sm text-zinc-500 transition-colors hover:text-black dark:text-zinc-400 dark:hover:text-white">
                {t("quotes")}
              </Link>
              <Link href="/dev" className="text-sm text-zinc-500 transition-colors hover:text-black dark:text-zinc-400 dark:hover:text-white">
                {t("dev")}
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <LocaleSwitcher current={locale} />
            <ThemeToggle />
            <UserButton />
          </div>
        </div>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}

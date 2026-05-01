import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";
import { getTranslations, getLocale } from "next-intl/server";
import { requireTenant } from "@/services/tenants";
import { adminGetEnabledTools } from "@/services/admin/tenants";
import LocaleSwitcher from "@/components/locale-switcher";
import ThemeToggle from "@/components/theme-toggle";

export const dynamic = "force-dynamic";

const NAV_LINKS = [
  { slug: "payroll",   href: "/payroll",   labelKey: "payroll" },
  { slug: "assets",    href: "/assets",    labelKey: "assets" },
  { slug: "employees", href: "/employees", labelKey: "employees" },
  { slug: "quotes",    href: "/quotes",    labelKey: "quotes" },
  { slug: "invoices",  href: "/invoices",  labelKey: "invoices" },
  { slug: "clients",   href: "/clients",   labelKey: "clients" },
  { slug: "providers", href: "/providers", labelKey: "providers" },
  { slug: "coverage",  href: "/coverage",  labelKey: "coverage" },
] as const;

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { orgId } = await auth();

  // If the user is in the internal admin org, send them to /admin
  if (orgId && orgId === process.env.INTERNAL_ORG_ID) {
    redirect("/admin");
  }

  const tenant = await requireTenant();
  const [t, locale, enabledSlugs] = await Promise.all([
    getTranslations("nav"),
    getLocale(),
    adminGetEnabledTools(tenant.id),
  ]);

  const visibleLinks = NAV_LINKS.filter((l) => enabledSlugs.includes(l.slug));

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
              {visibleLinks.map((link) => (
                <Link key={link.slug} href={link.href} className="text-sm text-zinc-500 transition-colors hover:text-black dark:text-zinc-400 dark:hover:text-white">
                  {t(link.labelKey)}
                </Link>
              ))}
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

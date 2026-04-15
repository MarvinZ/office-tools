import { currentUser } from "@clerk/nextjs/server";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { requireTenant } from "@/services/tenants";
import { adminGetEnabledTools } from "@/services/admin/tenants";

export const dynamic = "force-dynamic";

// All possible tool cards — keyed by tool slug
const TOOL_CARDS = [
  { slug: "payroll",   href: "/payroll",   titleKey: "payrollCard.title",   descKey: "payrollCard.description" },
  { slug: "assets",    href: "/assets",    titleKey: "assetsCard.title",    descKey: "assetsCard.description" },
  { slug: "employees", href: "/employees", titleKey: "employeesCard.title", descKey: "employeesCard.description" },
] as const;

export default async function DashboardPage() {
  const [user, tenant, t] = await Promise.all([
    currentUser(),
    requireTenant(),
    getTranslations("dashboard"),
  ]);

  const enabledSlugs = await adminGetEnabledTools(tenant.id);
  const visibleCards = TOOL_CARDS.filter((c) => enabledSlugs.includes(c.slug));

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold text-black dark:text-white">
          {t("greeting", { name: user?.firstName ?? "there" })}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">{t("subtitle")}</p>
      </div>

      {visibleCards.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-500">{t("noTools")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {visibleCards.map((card) => (
            <Link
              key={card.slug}
              href={card.href}
              className="rounded-xl border border-zinc-200 bg-zinc-50 p-6 transition-colors hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600"
            >
              <p className="font-semibold text-black dark:text-white">{t(card.titleKey)}</p>
              <p className="mt-1 text-sm text-zinc-500">{t(card.descKey)}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireTenant } from "@/services/tenants";
import { getProvider } from "@/services/providers/providers";
import { STATUS_CONFIG } from "../_mock/data";
import ProviderTabs from "./_components/provider-tabs";
import EditProviderModal from "./_components/edit-provider-modal";

export const dynamic = "force-dynamic";

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toISOString().slice(0, 10);
}

export default async function ProviderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [tenant, t] = await Promise.all([requireTenant(), getTranslations("providers")]);

  const provider = await getProvider(tenant.id, id);
  if (!provider) notFound();

  const initials = provider.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const cfg = STATUS_CONFIG[provider.status];
  const primaryContact = provider.contacts.find((c) => c.isPrimary) ?? provider.contacts[0];

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-zinc-400">
        <Link href="/providers" className="hover:text-black dark:hover:text-white">{t("page.title")}</Link>
        <span>›</span>
        <span className="text-black dark:text-white">{provider.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-zinc-100 text-xl font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            {initials}
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-black dark:text-white">{provider.name}</h1>
            <p className="mt-0.5 text-sm text-zinc-500">{provider.legalName} · {provider.category}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${cfg.color}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
            {t(`status.${provider.status}`)}
          </span>
          <EditProviderModal provider={provider} />
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: t("detail.statContact"),  value: primaryContact?.name ?? "—" },
          { label: t("detail.statTerms"),    value: t(`paymentTerms.${provider.paymentTerms}`) },
          { label: t("detail.statLeadTime"), value: provider.leadTimeDays != null ? t("detail.statLeadTimeDays", { days: provider.leadTimeDays }) : "—" },
          { label: t("detail.statSince"),    value: fmtDate(provider.partnerSince) },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">{s.label}</p>
            <p className="mt-1 truncate text-sm font-semibold text-black dark:text-white">{s.value}</p>
          </div>
        ))}
      </div>

      <ProviderTabs provider={provider} />
    </div>
  );
}

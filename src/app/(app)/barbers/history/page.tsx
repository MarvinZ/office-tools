import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireTenant } from "@/services/tenants";
import { listBarberAudit } from "@/services/barbers/audit";
import { listBarbers } from "@/services/barbers/barbers";
import AuditList from "../_components/audit-list";

export const dynamic = "force-dynamic";

/** Everything that changed what barbers are paid, newest first; ?barber= filters. */
export default async function BarberHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ barber?: string }>;
}) {
  const { barber } = await searchParams;
  const [tenant, t] = await Promise.all([requireTenant(), getTranslations("barbers.audit")]);
  const barbers = await listBarbers(tenant.id);
  const selected = barbers.find((b) => b.id === barber);
  const entries = await listBarberAudit(tenant.id, { barberId: selected?.id, limit: 200 });
  const names = Object.fromEntries(barbers.map((b) => [b.id, `${b.firstName} ${b.lastName}`]));

  const chip = (active: boolean) =>
    `rounded-full border px-3 py-1 text-xs ${
      active
        ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
        : "border-zinc-200 text-zinc-600 hover:text-black dark:border-zinc-700 dark:text-zinc-300 dark:hover:text-white"
    }`;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold text-black dark:text-white">{t("title")}</h1>
        <p className="mt-1 text-sm text-zinc-500">{t("subtitle")}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href="/barbers/history" className={chip(!selected)}>{t("allBarbers")}</Link>
        {barbers.map((b) => (
          <Link key={b.id} href={`/barbers/history?barber=${b.id}`} className={chip(selected?.id === b.id)}>
            {b.firstName} {b.lastName}
          </Link>
        ))}
      </div>

      <AuditList entries={entries} names={names} showBarber={!selected} />
      {entries.length === 200 && <p className="text-xs text-zinc-400">{t("limitNote", { count: 200 })}</p>}
    </div>
  );
}

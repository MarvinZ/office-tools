import { getTranslations } from "next-intl/server";
import { requireTenant } from "@/services/tenants";
import { getPayoutReport } from "@/services/barbers/payout-report";
import { listBarbers } from "@/services/barbers/barbers";
import ReportFilterBar from "./_components/report-filter-bar";
import ReportTable from "./_components/report-table";
import { isDateString, todayBusinessDate } from "@/lib/barbers/dates";

export const dynamic = "force-dynamic";

/** Default range: current month to date (Costa Rica calendar), as YYYY-MM-DD strings. */
function defaultRange(): { from: string; to: string } {
  const today = todayBusinessDate();
  return { from: `${today.slice(0, 8)}01`, to: today };
}

function parseDateParam(value: string | undefined, fallback: string): string {
  return isDateString(value) ? value : fallback;
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ barberId?: string; from?: string; to?: string }>;
}) {
  const { barberId, from, to } = await searchParams;
  const [tenant, t] = await Promise.all([requireTenant(), getTranslations("barbers")]);

  const defaults = defaultRange();
  const dateFrom = parseDateParam(from, defaults.from);
  const dateTo = parseDateParam(to, defaults.to);
  const selectedBarberId = barberId ?? "all";

  const [report, barbers] = await Promise.all([
    getPayoutReport(tenant.id, { barberId: selectedBarberId, dateFrom, dateTo }),
    listBarbers(tenant.id),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold text-black dark:text-white">{t("reportsPage.title")}</h1>
        <p className="mt-1 text-sm text-zinc-500">{t("reportsPage.subtitle")}</p>
      </div>

      <ReportFilterBar
        barbers={barbers}
        selectedBarberId={selectedBarberId}
        dateFrom={dateFrom}
        dateTo={dateTo}
      />

      <ReportTable report={report} />
    </div>
  );
}

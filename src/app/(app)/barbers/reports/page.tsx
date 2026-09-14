import { getTranslations } from "next-intl/server";
import { requireTenant } from "@/services/tenants";
import { getPayoutReport } from "@/services/barbers/payout-report";
import { listBarbers } from "@/services/barbers/barbers";
import ReportFilterBar from "./_components/report-filter-bar";
import ReportTable from "./_components/report-table";

export const dynamic = "force-dynamic";

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Dates stay plain `YYYY-MM-DD` strings through the whole report flow (search
 * params -> this page -> filter bar -> back into search params). They are only
 * converted to Date objects inside getPayoutReport, as explicit UTC boundaries.
 * Never serialize these through `new Date(...).toISOString()` — that's where the
 * one-day drift came from.
 */
function toDateString(y: number, monthIndex: number, day: number): string {
  return `${y}-${pad2(monthIndex + 1)}-${pad2(day)}`;
}

/** Default range: current month to date, as YYYY-MM-DD strings. */
function defaultRange(): { from: string; to: string } {
  const now = new Date();
  return {
    from: toDateString(now.getFullYear(), now.getMonth(), 1),
    to: toDateString(now.getFullYear(), now.getMonth(), now.getDate()),
  };
}

function parseDateParam(value: string | undefined, fallback: string): string {
  return value && DATE_ONLY_RE.test(value) ? value : fallback;
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

import { getMyBarbersRole } from "@/services/barbers/roles";
import { can } from "@/lib/barbers/permissions";
import { getTranslations } from "next-intl/server";
import { listBarberChoices, listClosingFiles } from "@/services/barbers/closing-imports";
import { listLocations } from "@/services/barbers/locations";
import { BUSINESS_TIME_ZONE, fmtDay } from "@/lib/barbers/dates";
import { fmtColones } from "@/lib/barbers/currency";
import ImportClosingsClient from "./_components/import-closings-client";

export const dynamic = "force-dynamic";

const whenFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: BUSINESS_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** Import the daily closing workbooks (CIERRE DD-MM-AAAA.xlsx, spec §4). */
export default async function ClosingImportsPage() {
  const [{ tenant, role }, t] = await Promise.all([getMyBarbersRole(), getTranslations("barbers.imports")]);
  const [files, locations, barbers] = await Promise.all([
    listClosingFiles(tenant.id),
    listLocations(tenant.id),
    listBarberChoices(tenant.id),
  ]);
  const activeLocations = locations.filter((l) => l.status === "active").map((l) => ({ id: l.id, name: l.name }));

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold text-black dark:text-white">{t("title")}</h1>
        <p className="mt-1 text-sm text-zinc-500">{t("subtitle")}</p>
      </div>

      {activeLocations.length === 0 ? (
        <p className="rounded-xl border border-zinc-200 p-4 text-sm text-zinc-500 dark:border-zinc-800">{t("noLocations")}</p>
      ) : (
        <ImportClosingsClient locations={activeLocations} barbers={barbers} canImport={can(role, "configure")} />
      )}

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-black dark:text-white">{t("importedTitle")}</h2>
        {files.length === 0 ? (
          <p className="rounded-xl border border-zinc-200 p-4 text-sm text-zinc-400 dark:border-zinc-800">{t("importedEmpty")}</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
                    <th className="px-4 py-2.5">{t("colDate")}</th>
                    <th className="px-4 py-2.5">{t("colFile")}</th>
                    <th className="px-4 py-2.5 text-right">{t("colServices")}</th>
                    <th className="px-4 py-2.5 text-right">{t("colBilled")}</th>
                    <th className="px-4 py-2.5 text-right">{t("colWarnings")}</th>
                    <th className="px-4 py-2.5">{t("colImported")}</th>
                  </tr>
                </thead>
                <tbody>
                  {files.map((f) => (
                    <tr key={f.id} className="border-b border-zinc-100 last:border-0 text-zinc-600 dark:border-zinc-800 dark:text-zinc-300">
                      <td className="whitespace-nowrap px-4 py-2.5 font-medium text-black dark:text-white">{fmtDay(f.businessDate)}</td>
                      <td className="px-4 py-2.5">
                        {f.fileName}
                        {f.version > 1 && <span className="ml-1.5 text-xs text-zinc-400">v{f.version}</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{f.services}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">{fmtColones(f.billed)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{f.warnings || "—"}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-xs text-zinc-400">{whenFmt.format(f.importedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

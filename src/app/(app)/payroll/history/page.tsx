export const dynamic = "force-dynamic";

import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { DEV_TENANT_ID } from "@/lib/constants";
import { getBatchHistory } from "@/services/payroll/history";

const statusStyles: Record<string, string> = {
  draft:      "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  queued:     "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  processing: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  sent:       "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  failed:     "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  cancelled:  "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500",
};

export default async function PayrollHistoryPage() {
  const batches = await getBatchHistory(DEV_TENANT_ID);
  const t = await getTranslations("history");

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-black dark:text-white">{t("title")}</h1>
          <p className="mt-1 text-sm text-zinc-500">{t("description")}</p>
        </div>
        <Link href="/payroll" className="rounded-full bg-black px-5 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200">
          {t("newPayroll")}
        </Link>
      </div>

      {batches.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-6 py-12 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-500">{t("empty")}</p>
          <Link href="/payroll" className="mt-3 inline-block text-sm text-black underline dark:text-white">
            {t("uploadFirst")}
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
                {["file", "date", "status", "actions"].map((k) => (
                  <th key={k} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    {t(`columns.${k}` as any)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => (
                <tr key={b.batchId} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
                  <td className="px-5 py-4 font-medium text-black dark:text-white">{b.filename}</td>
                  <td className="px-5 py-4 text-zinc-500">
                    {new Date(b.createdAt).toLocaleDateString("es-CR", {
                      year: "numeric", month: "short", day: "numeric",
                    })}
                  </td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${statusStyles[b.status] ?? statusStyles.draft}`}>
                      {t(`status.${b.status}` as any)}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Link href={`/payroll/history/${b.batchId}`} className="text-xs text-zinc-400 hover:text-black dark:hover:text-white">
                      {t("viewDetails")}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

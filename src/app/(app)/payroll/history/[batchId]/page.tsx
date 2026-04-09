import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { DEV_TENANT_ID } from "@/lib/constants";
import { getBatchWithEmails } from "@/services/payroll/history";

const emailStatusStyles: Record<string, string> = {
  queued: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  sent:   "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  failed: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

type Props = { params: Promise<{ batchId: string }> };

export default async function BatchDetailPage({ params }: Props) {
  const { batchId } = await params;
  const t = await getTranslations("history");
  const data = await getBatchWithEmails(batchId, DEV_TENANT_ID);

  if (!data) notFound();

  const sent = data.emails.filter((e) => e.status === "sent").length;
  const failed = data.emails.filter((e) => e.status === "failed").length;
  const total = data.emails.length;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10">
      <div>
        <Link href="/payroll/history" className="text-xs text-zinc-400 hover:text-black dark:hover:text-white">
          {t("backToHistory")}
        </Link>
        <h1 className="mt-3 text-2xl font-semibold text-black dark:text-white">{data.filename}</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {new Date(data.createdAt).toLocaleDateString("es-CR", { year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {([
          { key: "total", value: total, color: "text-black dark:text-white" },
          { key: "sent",  value: sent,  color: "text-green-600" },
          { key: "failed", value: failed, color: "text-red-500" },
        ] as const).map((s) => (
          <div key={s.key} className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">{t(`summary.${s.key}`)}</p>
            <p className={`mt-1 text-3xl font-semibold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {data.emails.length === 0 ? (
        <p className="text-sm text-zinc-400">{t("noEmails")}</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
                {(["employee", "recipient", "status", "sentAt", "error"] as const).map((k) => (
                  <th key={k} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    {t(`emailColumns.${k}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.emails.map((email) => {
                const payload = email.payload as Record<string, unknown>;
                return (
                  <tr key={email.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
                    <td className="px-5 py-3 font-medium text-black dark:text-white">{String(payload.empleado ?? "—")}</td>
                    <td className="px-5 py-3 text-zinc-500">{email.recipientEmail}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${emailStatusStyles[email.status] ?? ""}`}>
                        {t(`status.${email.status}` as any)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-zinc-500">
                      {email.sentAt ? new Date(email.sentAt).toLocaleTimeString("es-CR", { hour: "2-digit", minute: "2-digit" }) : "—"}
                    </td>
                    <td className="px-5 py-3 text-xs text-red-500">{email.error ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

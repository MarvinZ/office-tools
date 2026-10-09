import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireTenant } from "@/services/tenants";
import { getWebhookEvent } from "@/services/webhooks/webhooks";
import { VERIFICATION_STATUS_CONFIG } from "../_mock/data";
import DeleteEventButton from "./_components/delete-event-button";

export const dynamic = "force-dynamic";

export default async function WebhookEventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [tenant, t] = await Promise.all([requireTenant(), getTranslations("webhooks")]);

  const event = await getWebhookEvent(tenant.id, id);
  if (!event) notFound();

  const status = event.signatureValid ? "valid" : "invalid";
  const cfg = VERIFICATION_STATUS_CONFIG[status];
  const prettyBody = event.body != null ? JSON.stringify(event.body, null, 2) : event.rawBody;
  const headers = event.headers as Record<string, string>;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10">
      <div className="flex items-center gap-2 text-sm text-zinc-400">
        <Link href="/webhooks" className="hover:text-black dark:hover:text-white">{t("page.title")}</Link>
        <span>›</span>
        <span className="text-black dark:text-white">{new Date(event.receivedAt).toLocaleString()}</span>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-black dark:text-white">{t("detail.title")}</h1>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${cfg.color}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
              {t(`list.status.${status}`)}
            </span>
          </div>
          <p className="mt-1 text-sm text-zinc-500">{new Date(event.receivedAt).toLocaleString()}</p>
        </div>
        <DeleteEventButton id={event.id} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <div className="text-xs font-medium text-zinc-500">{t("detail.sourceIp")}</div>
          <div className="mt-1 text-sm text-black dark:text-white">{event.sourceIp ?? t("list.unknownSource")}</div>
        </div>
        <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <div className="text-xs font-medium text-zinc-500">{t("detail.signature")}</div>
          <div className="mt-1 text-sm text-black dark:text-white">
            {event.signatureValid ? t("detail.signatureValid") : t("detail.signatureInvalid")}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-black dark:text-white">{t("detail.bodyTitle")}</h2>
        <pre className="max-h-[32rem] overflow-auto rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-xs text-black dark:border-zinc-800 dark:bg-zinc-900 dark:text-white">
          {prettyBody}
        </pre>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-black dark:text-white">{t("detail.headersTitle")}</h2>
        <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-xs">
            <tbody>
              {Object.entries(headers).map(([key, value]) => (
                <tr key={key} className="border-b border-zinc-100 last:border-0 dark:border-zinc-900">
                  <td className="whitespace-nowrap px-4 py-2 font-medium text-zinc-500">{key}</td>
                  <td className="px-4 py-2 break-all text-black dark:text-white">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

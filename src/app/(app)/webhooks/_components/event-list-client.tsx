"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { clearWebhookEventsAction } from "../actions";
import { VERIFICATION_STATUS_CONFIG } from "../_mock/data";
import type { WebhookEventRow } from "@/services/webhooks/webhooks";

export default function EventListClient({ events }: { events: WebhookEventRow[] }) {
  const t = useTranslations("webhooks");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");

  const filtered = events.filter((e) =>
    search.trim() === "" ? true : JSON.stringify(e.body ?? e.rawBody).toLowerCase().includes(search.toLowerCase())
  );

  function handleClear() {
    if (!confirm(t("list.clearConfirm"))) return;
    startTransition(async () => {
      await clearWebhookEventsAction();
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("list.searchPlaceholder")}
          className="w-full max-w-xs rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
        />
        <div className="flex items-center gap-3">
          <span className="text-sm text-zinc-500">{t("list.resultsCount", { filtered: filtered.length, total: events.length })}</span>
          {events.length > 0 && (
            <button
              onClick={handleClear}
              disabled={isPending}
              className="shrink-0 rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
            >
              {t("list.clearAll")}
            </button>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-left text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
            <tr>
              <th className="px-4 py-3 font-medium">{t("list.colReceived")}</th>
              <th className="px-4 py-3 font-medium">{t("list.colStatus")}</th>
              <th className="px-4 py-3 font-medium">{t("list.colSource")}</th>
              <th className="px-4 py-3 font-medium">{t("list.colPreview")}</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-zinc-500">
                  {t("list.empty")}
                </td>
              </tr>
            ) : (
              filtered.map((event) => {
                const status = event.signatureValid ? "valid" : "invalid";
                const cfg = VERIFICATION_STATUS_CONFIG[status];
                const preview = JSON.stringify(event.body ?? event.rawBody).slice(0, 80);
                return (
                  <tr key={event.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-900">
                    <td className="px-4 py-3 whitespace-nowrap text-zinc-700 dark:text-zinc-300">
                      {new Date(event.receivedAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${cfg.color}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                        {t(`list.status.${status}`)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-500">{event.sourceIp ?? t("list.unknownSource")}</td>
                    <td className="px-4 py-3 max-w-xs truncate font-mono text-xs text-zinc-500">{preview}</td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/webhooks/${event.id}`} className="text-sm text-black hover:underline dark:text-white">
                        {t("list.viewLink")}
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

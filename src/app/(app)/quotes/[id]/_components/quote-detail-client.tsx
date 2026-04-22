"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Send, Copy, Download, Pencil, CheckCircle, XCircle } from "lucide-react";
import type { QuoteUI, QuoteInput, QuoteStatusTransition } from "@/services/quotes/quotes";
import { STATUS_CONFIG } from "../../_mock/data";
import { updateQuoteStatusAction, updateQuoteAction } from "../actions";
import EditQuoteModal from "./edit-quote-modal";

function fmt(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
}

const ACTIVITY_ICONS: Record<string, string> = {
  created:  "📝",
  sent:     "📧",
  viewed:   "👁",
  accepted: "✅",
  declined: "❌",
  expired:  "⏰",
  updated:  "✏️",
};

type ClientOption = { id: string; name: string; billingEmail: string };

export default function QuoteDetailClient({ quote, clients = [] }: { quote: QuoteUI; clients?: ClientOption[] }) {
  const t = useTranslations("quotes");
  const router = useRouter();
  const [showEdit, setShowEdit] = useState(false);
  const [tab, setTab] = useState<"overview" | "activity">("overview");
  const [isPending, startTransition] = useTransition();

  const canSend = quote.status === "draft";
  const canEdit = quote.status === "draft";

  function changeStatus(status: QuoteStatusTransition, note?: string) {
    startTransition(async () => {
      await updateQuoteStatusAction(quote.id, status, note);
      router.refresh();
    });
  }

  function handleEdit(data: QuoteInput) {
    startTransition(async () => {
      await updateQuoteAction(quote.id, data);
      setShowEdit(false);
      router.refresh();
    });
  }

  return (
    <>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-black dark:text-white">{quote.title}</h1>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_CONFIG[quote.status].color}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${STATUS_CONFIG[quote.status].dot}`} />
              {t(`status.${quote.status}`)}
            </span>
          </div>
          <p className="font-mono text-sm text-zinc-500">
            {quote.number} · {t("detail.issuedOn", { date: quote.issueDate })} · {t("detail.expiresOn", { date: quote.expiryDate })}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canEdit && (
            <button
              onClick={() => setShowEdit(true)}
              disabled={isPending}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 transition-colors hover:border-zinc-400 hover:text-black disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:text-white"
            >
              <Pencil size={14} />
              {t("detail.edit")}
            </button>
          )}
          <button className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 transition-colors hover:border-zinc-400 hover:text-black dark:border-zinc-700 dark:text-zinc-400 dark:hover:text-white">
            <Copy size={14} />
            {t("detail.duplicate")}
          </button>
          <button className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 transition-colors hover:border-zinc-400 hover:text-black dark:border-zinc-700 dark:text-zinc-400 dark:hover:text-white">
            <Download size={14} />
            {t("detail.downloadPdf")}
          </button>
          {canSend && (
            <button
              onClick={() => changeStatus("sent", `Sent to ${quote.clientEmail}`)}
              disabled={isPending}
              className="flex items-center gap-1.5 rounded-lg bg-black px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
            >
              <Send size={14} />
              {isPending ? "..." : t("detail.sendQuote")}
            </button>
          )}
          {(quote.status === "sent" || quote.status === "viewed") && (
            <>
              <button
                onClick={() => changeStatus("accepted")}
                disabled={isPending}
                className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
              >
                <CheckCircle size={14} />
                {t("detail.markAccepted")}
              </button>
              <button
                onClick={() => changeStatus("declined")}
                disabled={isPending}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 transition-colors hover:border-red-300 hover:text-red-600 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-400"
              >
                <XCircle size={14} />
                {t("detail.markDeclined")}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: t("detail.statClient"), value: quote.clientName },
          { label: t("detail.statEmail"),  value: quote.clientEmail },
          { label: t("detail.statItems"),  value: String(quote.lineItems.length) },
          { label: t("detail.statTotal"),  value: fmt(quote.total, quote.currency) },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-xs text-zinc-500">{s.label}</p>
            <p className="mt-0.5 font-semibold text-black dark:text-white">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-800">
        {(["overview", "activity"] as const).map((tab_key) => (
          <button
            key={tab_key}
            onClick={() => setTab(tab_key)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === tab_key
                ? "border-b-2 border-black text-black dark:border-white dark:text-white"
                : "text-zinc-500 hover:text-black dark:hover:text-white"
            }`}
          >
            {t(`detail.tab${tab_key.charAt(0).toUpperCase() + tab_key.slice(1)}`)}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {tab === "overview" && (
        <div className="flex flex-col gap-6">
          <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
                  {[t("detail.colDescription"), t("detail.colQty"), t("detail.colUnitPrice"), t("detail.colSubtotal")].map((h) => (
                    <th key={h} className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 ${h !== t("detail.colDescription") ? "text-right" : "text-left"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {quote.lineItems.map((item) => (
                  <tr key={item.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
                    <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{item.description}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-zinc-500">{item.quantity}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-zinc-500">{fmt(item.unitPrice, quote.currency)}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium text-black dark:text-white">{fmt(item.subtotal, quote.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="border-t border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="ml-auto max-w-xs space-y-1.5">
                <div className="flex justify-between text-sm text-zinc-500">
                  <span>{t("detail.subtotal")}</span>
                  <span className="tabular-nums">{fmt(quote.subtotal, quote.currency)}</span>
                </div>
                <div className="flex justify-between text-sm text-zinc-500">
                  <span>{t("detail.tax", { rate: quote.taxRate * 100 })}</span>
                  <span className="tabular-nums">{fmt(quote.taxAmount, quote.currency)}</span>
                </div>
                <div className="flex justify-between border-t border-zinc-200 pt-1.5 text-sm font-semibold text-black dark:border-zinc-700 dark:text-white">
                  <span>{t("detail.total")}</span>
                  <span className="tabular-nums">{fmt(quote.total, quote.currency)}</span>
                </div>
              </div>
            </div>
          </div>

          {quote.notes && (
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">{t("detail.notes")}</p>
              <p className="text-sm text-zinc-700 dark:text-zinc-300">{quote.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* Activity tab */}
      {tab === "activity" && (
        <div className="flex flex-col gap-2">
          {quote.activity.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-400">{t("detail.activityEmpty")}</p>
          ) : (
            <div className="relative flex flex-col gap-0 pl-8">
              <div className="absolute left-3 top-2 h-full w-px bg-zinc-200 dark:bg-zinc-800" />
              {quote.activity.map((entry, idx) => (
                <div key={entry.id} className="relative flex flex-col gap-0.5 pb-6">
                  <span className="absolute -left-5 flex h-5 w-5 items-center justify-center rounded-full border border-zinc-200 bg-white text-xs dark:border-zinc-700 dark:bg-zinc-950">
                    {ACTIVITY_ICONS[entry.action] ?? "•"}
                  </span>
                  <p className="text-sm font-medium text-black dark:text-white">
                    {t(`activity.${entry.action}`)}
                  </p>
                  {entry.note && <p className="text-xs text-zinc-500">{entry.note}</p>}
                  <p className="text-xs text-zinc-400">{entry.date}</p>
                  {idx === quote.activity.length - 1 && (
                    <div className="absolute -left-5 bottom-0 h-5 w-5 bg-white dark:bg-zinc-950" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showEdit && (
        <EditQuoteModal
          quote={quote}
          clients={clients}
          isPending={isPending}
          onClose={() => setShowEdit(false)}
          onSave={handleEdit}
        />
      )}
    </>
  );
}

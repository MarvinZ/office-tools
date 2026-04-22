"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, FileText } from "lucide-react";
import { useTranslations } from "next-intl";
import type { QuoteListItem, QuoteStatus } from "@/services/quotes/quotes";
import { STATUS_CONFIG } from "../_mock/data";

const ALL = "All";

function fmt(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
}

export default function QuoteListClient({ quotes }: { quotes: QuoteListItem[] }) {
  const t = useTranslations("quotes");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<QuoteStatus | typeof ALL>(ALL);

  const filtered = quotes.filter((q) => {
    const matchSearch =
      q.number.toLowerCase().includes(search.toLowerCase()) ||
      q.title.toLowerCase().includes(search.toLowerCase()) ||
      q.clientName.toLowerCase().includes(search.toLowerCase()) ||
      q.clientEmail.toLowerCase().includes(search.toLowerCase());
    const matchStatus = status === ALL || q.status === status;
    return matchSearch && matchStatus;
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("list.searchPlaceholder")}
            className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-8 pr-4 text-sm outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:focus:ring-white"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as QuoteStatus | typeof ALL)}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
        >
          <option value={ALL}>{t("list.allStatuses")}</option>
          {(Object.keys(STATUS_CONFIG) as QuoteStatus[]).map((s) => (
            <option key={s} value={s}>{t(`status.${s}`)}</option>
          ))}
        </select>
      </div>

      {filtered.length !== quotes.length && (
        <p className="text-sm text-zinc-400">{t("list.resultsCount", { filtered: filtered.length, total: quotes.length })}</p>
      )}

      <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
              {[t("list.colNumber"), t("list.colClient"), t("list.colTitle"), t("list.colTotal"), t("list.colExpiry"), t("list.colStatus"), ""].map((h, i) => (
                <th key={i} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-sm text-zinc-400">
                  <div className="flex flex-col items-center gap-2">
                    <FileText size={32} className="text-zinc-300 dark:text-zinc-700" />
                    <span>{t("list.empty")}</span>
                  </div>
                </td>
              </tr>
            ) : filtered.map((q) => (
              <tr key={q.id} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/50">
                <td className="px-4 py-3">
                  <p className="font-mono text-xs font-medium text-zinc-700 dark:text-zinc-300">{q.number}</p>
                  <p className="text-xs text-zinc-400">{q.issueDate}</p>
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium text-black dark:text-white">{q.clientName}</p>
                  <p className="text-xs text-zinc-400">{q.clientEmail}</p>
                </td>
                <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">{q.title}</td>
                <td className="px-4 py-3 font-medium text-black dark:text-white tabular-nums">
                  {fmt(q.total, q.currency)}
                </td>
                <td className="px-4 py-3 text-zinc-500">{q.expiryDate}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_CONFIG[q.status].color}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${STATUS_CONFIG[q.status].dot}`} />
                    {t(`status.${q.status}`)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/quotes/${q.id}`} className="text-xs text-zinc-400 hover:text-black dark:hover:text-white">
                    {t("list.viewLink")}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

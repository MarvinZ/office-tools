"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, User } from "lucide-react";
import { useTranslations } from "next-intl";
import type { BarberRow } from "@/services/barbers/barbers";

const ALL = "All";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  inactive: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

export default function BarberListClient({ barbers }: { barbers: BarberRow[] }) {
  const t = useTranslations("barbers");
  const tc = useTranslations("common");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>(ALL);

  const filtered = barbers.filter((b) => {
    const q = search.toLowerCase();
    const name = `${b.firstName} ${b.lastName}`.toLowerCase();
    const matchSearch = name.includes(q) || (b.email?.toLowerCase().includes(q) ?? false) || (b.phone?.toLowerCase().includes(q) ?? false);
    const matchStatus = status === ALL || b.status === status;
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
            placeholder={t("barbersPage.searchPlaceholder")}
            className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-8 pr-4 text-sm outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:focus:ring-white"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
        >
          <option value={ALL}>{t("barbersPage.allStatuses")}</option>
          {(["active", "inactive"] as const).map((s) => (
            <option key={s} value={s}>{t(`status.${s}`)}</option>
          ))}
        </select>
      </div>

      {filtered.length !== barbers.length && (
        <p className="text-sm text-zinc-400">{t("barbersPage.resultsCount", { filtered: filtered.length, total: barbers.length })}</p>
      )}

      <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
              {[t("barbersPage.colBarber"), t("barbersPage.colContact"), t("barbersPage.colStatus"), ""].map((h, i) => (
                <th key={i} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center text-sm text-zinc-400">
                  <div className="flex flex-col items-center gap-2">
                    <User size={32} className="text-zinc-300 dark:text-zinc-700" />
                    <span>{t("barbersPage.empty")}</span>
                  </div>
                </td>
              </tr>
            ) : filtered.map((b) => (
              <tr key={b.id} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                      {b.firstName[0]}{b.lastName[0]}
                    </div>
                    <p className="font-medium text-black dark:text-white">{b.firstName} {b.lastName}</p>
                  </div>
                </td>
                <td className="px-4 py-3 text-zinc-500">
                  {b.email ?? b.phone ?? tc("notApplicable")}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[b.status]}`}>
                    {t(`status.${b.status}`)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/barbers/barbers/${b.id}`} className="text-xs text-zinc-400 hover:text-black dark:hover:text-white">
                    {tc("viewLink")}
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

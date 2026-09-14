"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import type { LocationRow } from "@/services/barbers/locations";

const ALL = "All";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  inactive: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

export default function LocationListClient({ locations }: { locations: LocationRow[] }) {
  const t = useTranslations("barbers");
  const tc = useTranslations("common");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>(ALL);

  const filtered = locations.filter((l) => {
    const q = search.toLowerCase();
    const matchSearch = l.name.toLowerCase().includes(q) || (l.addressCity?.toLowerCase().includes(q) ?? false);
    const matchStatus = status === ALL || l.status === status;
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
            placeholder={t("locationsPage.searchPlaceholder")}
            className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-8 pr-4 text-sm outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:focus:ring-white"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
        >
          <option value={ALL}>{t("locationsPage.allStatuses")}</option>
          {(["active", "inactive"] as const).map((s) => (
            <option key={s} value={s}>{t(`status.${s}`)}</option>
          ))}
        </select>
      </div>

      {filtered.length !== locations.length && (
        <p className="text-sm text-zinc-400">{t("locationsPage.resultsCount", { filtered: filtered.length, total: locations.length })}</p>
      )}

      <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
              {[t("locationsPage.colLocation"), t("locationsPage.colAddress"), t("locationsPage.colPhone"), t("locationsPage.colStatus"), ""].map((h, i) => (
                <th key={i} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-sm text-zinc-400">
                  <div className="flex flex-col items-center gap-2">
                    <MapPin size={32} className="text-zinc-300 dark:text-zinc-700" />
                    <span>{t("locationsPage.empty")}</span>
                  </div>
                </td>
              </tr>
            ) : filtered.map((l) => (
              <tr key={l.id} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/50">
                <td className="px-4 py-3 font-medium text-black dark:text-white">{l.name}</td>
                <td className="px-4 py-3 text-zinc-500">
                  {[l.addressCity, l.addressState].filter(Boolean).join(", ") || tc("notApplicable")}
                </td>
                <td className="px-4 py-3 text-zinc-500">{l.phone ?? tc("notApplicable")}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[l.status]}`}>
                    {t(`status.${l.status}`)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/barbers/locations/${l.id}`} className="text-xs text-zinc-400 hover:text-black dark:hover:text-white">
                    {tc("viewLink")}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}

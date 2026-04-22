"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, Truck } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ProviderListItem } from "@/services/providers/providers";
import type { ProviderStatus } from "../_mock/data";
import { STATUS_CONFIG, PROVIDER_CATEGORIES } from "../_mock/data";

const ALL = "All";

function Stars({ rating }: { rating: number }) {
  return (
    <span className="text-sm tracking-tight">
      {[1,2,3,4,5].map((i) => (
        <span key={i} className={i <= rating ? "text-amber-400" : "text-zinc-200 dark:text-zinc-700"}>★</span>
      ))}
    </span>
  );
}

export default function ProviderListClient({ providers }: { providers: ProviderListItem[] }) {
  const t = useTranslations("providers");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ProviderStatus | typeof ALL>(ALL);
  const [category, setCategory] = useState<string>(ALL);

  const filtered = providers.filter((p) => {
    const q = search.toLowerCase();
    const matchSearch =
      p.name.toLowerCase().includes(q) ||
      p.legalName.toLowerCase().includes(q) ||
      (p.taxId?.toLowerCase().includes(q) ?? false) ||
      p.productsServices.toLowerCase().includes(q) ||
      (p.primaryContact?.name.toLowerCase().includes(q) ?? false);
    const matchStatus = status === ALL || p.status === status;
    const matchCategory = category === ALL || p.category === category;
    return matchSearch && matchStatus && matchCategory;
  });

  const initials = (name: string) => name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

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
          onChange={(e) => setStatus(e.target.value as ProviderStatus | typeof ALL)}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
        >
          <option value={ALL}>{t("list.allStatuses")}</option>
          {(Object.keys(STATUS_CONFIG) as ProviderStatus[]).map((s) => (
            <option key={s} value={s}>{t(`status.${s}`)}</option>
          ))}
        </select>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
        >
          <option value={ALL}>{t("list.allCategories")}</option>
          {PROVIDER_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {filtered.length !== providers.length && (
        <p className="text-sm text-zinc-400">{t("list.resultsCount", { filtered: filtered.length, total: providers.length })}</p>
      )}

      <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
              {[t("list.colProvider"), t("list.colCategory"), t("list.colContact"), t("list.colTerms"), t("list.colRating"), t("list.colStatus"), ""].map((h, i) => (
                <th key={i} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-sm text-zinc-400">
                  <div className="flex flex-col items-center gap-2">
                    <Truck size={32} className="text-zinc-300 dark:text-zinc-700" />
                    <span>{t("list.empty")}</span>
                  </div>
                </td>
              </tr>
            ) : filtered.map((p) => {
              const contact = p.primaryContact;
              return (
                <tr key={p.id} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-xs font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                        {initials(p.name)}
                      </div>
                      <div>
                        <p className="font-medium text-black dark:text-white">{p.name}</p>
                        {p.taxId && <p className="text-xs text-zinc-400">{p.taxId}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-500">{p.category}</td>
                  <td className="px-4 py-3">
                    {contact ? (
                      <>
                        <p className="text-zinc-700 dark:text-zinc-300">{contact.name}</p>
                        <p className="text-xs text-zinc-400">{contact.email}</p>
                      </>
                    ) : <span className="text-zinc-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-zinc-500">{t(`paymentTerms.${p.paymentTerms}`)}</td>
                  <td className="px-4 py-3"><Stars rating={p.rating} /></td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_CONFIG[p.status].color}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${STATUS_CONFIG[p.status].dot}`} />
                      {t(`status.${p.status}`)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/providers/${p.id}`} className="text-xs text-zinc-400 hover:text-black dark:hover:text-white">
                      {t("list.viewLink")}
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

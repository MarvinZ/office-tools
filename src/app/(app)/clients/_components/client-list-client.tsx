"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, Building2 } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ClientListItem } from "@/services/clients/clients";
import type { ClientStatus } from "../_mock/data";
import { STATUS_CONFIG, INDUSTRIES } from "../_mock/data";

const ALL = "All";

export default function ClientListClient({ clients }: { clients: ClientListItem[] }) {
  const t = useTranslations("clients");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ClientStatus | typeof ALL>(ALL);
  const [industry, setIndustry] = useState<string>(ALL);

  const filtered = clients.filter((c) => {
    const q = search.toLowerCase();
    const matchSearch =
      c.name.toLowerCase().includes(q) ||
      c.legalName.toLowerCase().includes(q) ||
      c.taxId.toLowerCase().includes(q) ||
      c.billingEmail.toLowerCase().includes(q) ||
      (c.primaryContact?.name.toLowerCase().includes(q) ?? false);
    const matchStatus = status === ALL || c.status === status;
    const matchIndustry = industry === ALL || c.industry === industry;
    return matchSearch && matchStatus && matchIndustry;
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
          onChange={(e) => setStatus(e.target.value as ClientStatus | typeof ALL)}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
        >
          <option value={ALL}>{t("list.allStatuses")}</option>
          {(Object.keys(STATUS_CONFIG) as ClientStatus[]).map((s) => (
            <option key={s} value={s}>{t(`status.${s}`)}</option>
          ))}
        </select>
        <select
          value={industry}
          onChange={(e) => setIndustry(e.target.value)}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
        >
          <option value={ALL}>{t("list.allIndustries")}</option>
          {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
        </select>
      </div>

      {filtered.length !== clients.length && (
        <p className="text-sm text-zinc-400">{t("list.resultsCount", { filtered: filtered.length, total: clients.length })}</p>
      )}

      <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
              {[t("list.colClient"), t("list.colIndustry"), t("list.colContact"), t("list.colTerms"), t("list.colStatus"), ""].map((h, i) => (
                <th key={i} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-zinc-400">
                  <div className="flex flex-col items-center gap-2">
                    <Building2 size={32} className="text-zinc-300 dark:text-zinc-700" />
                    <span>{t("list.empty")}</span>
                  </div>
                </td>
              </tr>
            ) : filtered.map((c) => {
              const contact = c.primaryContact;
              return (
                <tr key={c.id} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-xs font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                        {initials(c.name)}
                      </div>
                      <div>
                        <p className="font-medium text-black dark:text-white">{c.name}</p>
                        <p className="text-xs text-zinc-400">{c.taxId}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-500">{c.industry}</td>
                  <td className="px-4 py-3">
                    {contact ? (
                      <>
                        <p className="text-zinc-700 dark:text-zinc-300">{contact.name}</p>
                        <p className="text-xs text-zinc-400">{contact.email}</p>
                      </>
                    ) : <span className="text-zinc-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-zinc-500">{t(`paymentTerms.${c.paymentTerms}`)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_CONFIG[c.status].color}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${STATUS_CONFIG[c.status].dot}`} />
                      {t(`status.${c.status}`)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/clients/${c.id}`} className="text-xs text-zinc-400 hover:text-black dark:hover:text-white">
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

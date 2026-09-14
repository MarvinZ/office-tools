"use client";

import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import type { BarberRow } from "@/services/barbers/barbers";

export default function ReportFilterBar({
  barbers,
  selectedBarberId,
  dateFrom,
  dateTo,
}: {
  barbers: BarberRow[];
  selectedBarberId: string;
  dateFrom: string;
  dateTo: string;
}) {
  const t = useTranslations("barbers");
  const router = useRouter();
  const pathname = usePathname();

  const [barberId, setBarberId] = useState(selectedBarberId);
  const [from, setFrom] = useState(dateFrom);
  const [to, setTo] = useState(dateTo);

  function applyFilters(next: { barberId: string; from: string; to: string }) {
    const params = new URLSearchParams();
    if (next.barberId && next.barberId !== "all") params.set("barberId", next.barberId);
    if (next.from) params.set("from", next.from);
    if (next.to) params.set("to", next.to);
    router.push(`${pathname}?${params.toString()}`);
  }

  function handleBarberChange(value: string) {
    setBarberId(value);
    applyFilters({ barberId: value, from, to });
  }

  function handleFromChange(value: string) {
    setFrom(value);
    applyFilters({ barberId, from: value, to });
  }

  function handleToChange(value: string) {
    setTo(value);
    applyFilters({ barberId, from, to: value });
  }

  const inputCls = "rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:focus:ring-white";
  const labelCls = "block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1";

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950 sm:flex-row sm:items-end">
      <div>
        <label className={labelCls}>{t("reportsPage.fieldBarber")}</label>
        <select value={barberId} onChange={(e) => handleBarberChange(e.target.value)} className={inputCls}>
          <option value="all">{t("reportsPage.allBarbers")}</option>
          {barbers.map((b) => <option key={b.id} value={b.id}>{b.firstName} {b.lastName}</option>)}
        </select>
      </div>
      <div>
        <label className={labelCls}>{t("reportsPage.fieldFrom")}</label>
        <input type="date" value={from} onChange={(e) => handleFromChange(e.target.value)} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>{t("reportsPage.fieldTo")}</label>
        <input type="date" value={to} onChange={(e) => handleToChange(e.target.value)} className={inputCls} />
      </div>
    </div>
  );
}

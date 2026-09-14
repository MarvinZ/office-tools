"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { RotateCcw } from "lucide-react";
import type { BarberEffectiveRate } from "@/services/barbers/barbers";
import { setBarberServiceRateAction, removeBarberServiceRateAction } from "../actions";

function fmtPct(n: number): string {
  return `${(n * 100).toFixed(2)}%`;
}

export default function BarberRatesEditor({ barberId, rates }: { barberId: string; rates: BarberEffectiveRate[] }) {
  const t = useTranslations("barbers");
  const tc = useTranslations("common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  function handleSetRate(serviceId: string) {
    const raw = drafts[serviceId];
    const value = parseFloat(raw);
    if (Number.isNaN(value)) return;
    startTransition(async () => {
      await setBarberServiceRateAction(barberId, serviceId, value);
      router.refresh();
      setDrafts((prev) => ({ ...prev, [serviceId]: "" }));
    });
  }

  function handleReset(serviceId: string) {
    startTransition(async () => {
      await removeBarberServiceRateAction(barberId, serviceId);
      router.refresh();
    });
  }

  if (rates.length === 0) {
    return <p className="text-sm text-zinc-400">{t("barberDetail.noActiveServices")}</p>;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
            {[t("barberDetail.colService"), t("barberDetail.colDefaultRate"), t("barberDetail.colEffectiveRate"), t("barberDetail.colSource"), t("barberDetail.colOverride"), ""].map((h, i) => (
              <th key={i} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rates.map((r) => (
            <tr key={r.serviceId} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
              <td className="px-4 py-3 text-black dark:text-white">{r.serviceName}</td>
              <td className="px-4 py-3 text-zinc-500">{fmtPct(r.defaultCommissionRate)}</td>
              <td className="px-4 py-3 font-medium text-black dark:text-white">{fmtPct(r.commissionRate)}</td>
              <td className="px-4 py-3 text-zinc-500">
                {r.source === "override" ? t("barberDetail.sourceOverride") : t("barberDetail.sourceDefault")}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.0001"
                    placeholder={String(r.commissionRate)}
                    value={drafts[r.serviceId] ?? ""}
                    onChange={(e) => setDrafts((prev) => ({ ...prev, [r.serviceId]: e.target.value }))}
                    className="w-24 rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                  />
                  <button
                    onClick={() => handleSetRate(r.serviceId)}
                    disabled={pending || !drafts[r.serviceId]}
                    className="rounded-lg border border-zinc-200 px-2.5 py-1 text-xs text-zinc-600 hover:border-zinc-400 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-400"
                  >
                    {tc("saveChanges")}
                  </button>
                </div>
              </td>
              <td className="px-4 py-3 text-right">
                {r.source === "override" && (
                  <button
                    onClick={() => handleReset(r.serviceId)}
                    disabled={pending}
                    className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-black disabled:opacity-50 dark:hover:text-white"
                  >
                    <RotateCcw size={12} />
                    {t("barberDetail.resetToDefault")}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

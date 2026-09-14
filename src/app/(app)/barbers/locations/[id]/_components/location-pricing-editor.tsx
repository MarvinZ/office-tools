"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { LocationServicePriceItem } from "@/services/barbers/locations";
import { setLocationServicePriceAction } from "../actions";

function fmtMoney(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

export default function LocationPricingEditor({
  locationId,
  servicePrices,
}: {
  locationId: string;
  servicePrices: LocationServicePriceItem[];
}) {
  const t = useTranslations("barbers");
  const tc = useTranslations("common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  function handleSave(serviceId: string) {
    const raw = drafts[serviceId];
    const value = parseFloat(raw);
    if (Number.isNaN(value)) return;
    startTransition(async () => {
      await setLocationServicePriceAction(locationId, serviceId, value);
      router.refresh();
      setDrafts((prev) => ({ ...prev, [serviceId]: "" }));
    });
  }

  if (servicePrices.length === 0) {
    return <p className="text-sm text-zinc-400">{t("locationDetail.noServices")}</p>;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
            {[t("locationDetail.colService"), t("locationDetail.colCurrentPrice"), t("locationDetail.colSetPrice")].map((h, i) => (
              <th key={i} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {servicePrices.map((s) => (
            <tr key={s.serviceId} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
              <td className="px-4 py-3 text-black dark:text-white">
                {s.serviceName}
                {s.status === "inactive" && <span className="ml-2 text-xs text-zinc-400">({t("status.inactive")})</span>}
              </td>
              <td className="px-4 py-3 text-zinc-500">{s.price != null ? fmtMoney(s.price) : tc("notApplicable")}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder={s.price != null ? String(s.price) : "0.00"}
                    value={drafts[s.serviceId] ?? ""}
                    onChange={(e) => setDrafts((prev) => ({ ...prev, [s.serviceId]: e.target.value }))}
                    className="w-28 rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                  />
                  <button
                    onClick={() => handleSave(s.serviceId)}
                    disabled={pending || !drafts[s.serviceId]}
                    className="rounded-lg border border-zinc-200 px-2.5 py-1 text-xs text-zinc-600 hover:border-zinc-400 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-400"
                  >
                    {tc("saveChanges")}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

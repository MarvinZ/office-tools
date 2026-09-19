"use client";

import { useMemo, useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { deleteProductSaleAction } from "../actions";
import { fmtColones } from "@/lib/barbers/currency";
import type { BarberRow } from "@/services/barbers/barbers";
import type { ProductSaleWithDetails } from "@/services/barbers/product-sales";

const ALL = "all";

export default function ProductSaleList({
  sales,
  barbers,
  onDeleted,
}: {
  sales: ProductSaleWithDetails[];
  barbers: BarberRow[];
  onDeleted: (id: string) => void;
}) {
  const t = useTranslations("barbers");
  const [pending, startTransition] = useTransition();
  const [barberId, setBarberId] = useState<string>(ALL);

  // Built from the active barbers plus anyone who already has a sale, so a
  // barber who was later deactivated can still be filtered on (their sales
  // survive by design — the FK has no cascade).
  const filterOptions = useMemo(() => {
    const byId = new Map<string, string>();
    for (const b of barbers) byId.set(b.id, `${b.firstName} ${b.lastName}`);
    for (const s of sales) if (!byId.has(s.barberId)) byId.set(s.barberId, s.barberName);
    return Array.from(byId, ([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [barbers, sales]);

  const filtered = useMemo(
    () => (barberId === ALL ? sales : sales.filter((s) => s.barberId === barberId)),
    [sales, barberId]
  );

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteProductSaleAction(id);
      onDeleted(id);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <select
        value={barberId}
        onChange={(e) => setBarberId(e.target.value)}
        aria-label={t("productSales.filterBarber")}
        className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-white sm:w-auto"
      >
        <option value={ALL}>{t("productSales.allBarbers")}</option>
        {filterOptions.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>

      <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
                {[
                  t("productSales.colDate"),
                  t("productSales.colBarber"),
                  t("productSales.colProduct"),
                  t("productSales.colQuantity"),
                  t("productSales.colUnitPrice"),
                  t("productSales.colTotal"),
                  t("productSales.colNote"),
                  "",
                ].map((h, i) => (
                  <th key={i} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-zinc-400">
                    {t("productSales.empty")}
                  </td>
                </tr>
              ) : (
                filtered.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/50"
                  >
                    {/* saleDate is a plain YYYY-MM-DD string from a `date`
                        column, rendered as-is: passing it through `new Date(...)`
                        would reinterpret it in the viewer's timezone and can
                        shift the day by one. */}
                    <td className="whitespace-nowrap px-4 py-3 text-zinc-500">{s.saleDate}</td>
                    <td className="px-4 py-3 font-medium text-black dark:text-white">{s.barberName}</td>
                    <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{s.productName}</td>
                    <td className="px-4 py-3 text-zinc-500">{s.quantity}</td>
                    {/* The snapshotted price this sale was made at — not the
                        product's current price. */}
                    <td className="whitespace-nowrap px-4 py-3 text-zinc-500">{fmtColones(parseFloat(s.unitPrice))}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">{fmtColones(parseFloat(s.totalAmount))}</td>
                    <td className="px-4 py-3 text-zinc-500">{s.note ?? "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDelete(s.id)}
                        disabled={pending}
                        className="text-zinc-400 hover:text-red-600 disabled:opacity-50 dark:hover:text-red-400"
                        aria-label={t("productSales.deleteRow")}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

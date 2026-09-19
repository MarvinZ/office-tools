"use client";

import { useMemo, useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { deleteVoucherAction } from "../actions";
import { fmtColones } from "@/lib/barbers/currency";
import type { BarberRow } from "@/services/barbers/barbers";
import type { VoucherWithBarberName } from "@/services/barbers/vouchers";

const ALL = "all";

export default function VoucherList({
  vouchers,
  barbers,
  onDeleted,
}: {
  vouchers: VoucherWithBarberName[];
  barbers: BarberRow[];
  onDeleted: (id: string) => void;
}) {
  const t = useTranslations("barbers");
  const [pending, startTransition] = useTransition();
  const [barberId, setBarberId] = useState<string>(ALL);

  // Built from the active barbers plus anyone who already has a vale, so a
  // barber who was later deactivated can still be filtered on (their vales
  // survive by design — the FK has no cascade).
  const filterOptions = useMemo(() => {
    const byId = new Map<string, string>();
    for (const b of barbers) byId.set(b.id, `${b.firstName} ${b.lastName}`);
    for (const v of vouchers) if (!byId.has(v.barberId)) byId.set(v.barberId, v.barberName);
    return Array.from(byId, ([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [barbers, vouchers]);

  const filtered = useMemo(
    () => (barberId === ALL ? vouchers : vouchers.filter((v) => v.barberId === barberId)),
    [vouchers, barberId]
  );

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteVoucherAction(id);
      onDeleted(id);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <select
        value={barberId}
        onChange={(e) => setBarberId(e.target.value)}
        aria-label={t("vales.filterBarber")}
        className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-white sm:w-auto"
      >
        <option value={ALL}>{t("vales.allBarbers")}</option>
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
                {[t("vales.colDate"), t("vales.colBarber"), t("vales.colAmount"), t("vales.colNote"), ""].map((h, i) => (
                  <th key={i} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-zinc-400">
                    {t("vales.empty")}
                  </td>
                </tr>
              ) : (
                filtered.map((v) => (
                  <tr
                    key={v.id}
                    className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/50"
                  >
                    {/* issuedDate is a plain YYYY-MM-DD string from a `date`
                        column, rendered as-is: passing it through `new Date(...)`
                        would reinterpret it in the viewer's timezone and can
                        shift the day by one. */}
                    <td className="whitespace-nowrap px-4 py-3 text-zinc-500">{v.issuedDate}</td>
                    <td className="px-4 py-3 font-medium text-black dark:text-white">{v.barberName}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-zinc-700 dark:text-zinc-300">{fmtColones(parseFloat(v.amount))}</td>
                    <td className="px-4 py-3 text-zinc-500">{v.note ?? "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDelete(v.id)}
                        disabled={pending}
                        className="text-zinc-400 hover:text-red-600 disabled:opacity-50 dark:hover:text-red-400"
                        aria-label={t("vales.deleteRow")}
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

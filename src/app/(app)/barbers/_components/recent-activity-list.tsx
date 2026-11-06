"use client";

import { useTranslations } from "next-intl";
import ActivityRowActions, { ActivityStatusBadge } from "./activity-row-actions";
import { fmtColones } from "@/lib/barbers/currency";
import type { ActivityListItem } from "@/services/barbers/activities";

function fmtTime(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export default function RecentActivityList({
  activities,
  barbers,
}: {
  activities: ActivityListItem[];
  barbers: { id: string; name: string }[];
}) {
  const t = useTranslations("barbers");

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800">
      <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
            {[t("log.colTime"), t("log.colBarber"), t("log.colService"), t("log.colCustomer"), t("log.colPaymentMethod"), t("log.colPrice"), t("log.colCommission"), ""].map((h, i) => (
              <th key={i} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {activities.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-4 py-10 text-center text-sm text-zinc-400">{t("log.empty")}</td>
            </tr>
          ) : activities.map((a) => (
            <tr
              key={a.id}
              className={`border-b border-zinc-100 last:border-0 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/50 ${a.status === "voided" ? "text-zinc-400 line-through decoration-zinc-300" : ""}`}
            >
              <td className="px-4 py-3 text-zinc-500">{fmtTime(a.performedAt)}</td>
              <td className="px-4 py-3 font-medium text-black dark:text-white">{a.barberName}</td>
              <td className="px-4 py-3 text-zinc-500">
                {a.serviceName}
                <ActivityStatusBadge status={a.status} reason={a.statusReason} />
              </td>
              <td className="px-4 py-3 text-zinc-500">{a.customerName ?? "—"}</td>
              <td className="px-4 py-3 whitespace-nowrap text-zinc-500">{a.paymentMethodName}</td>
              <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{fmtColones(a.priceCharged)}</td>
              <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{fmtColones(a.commissionAmount)}</td>
              <td className="px-4 py-3 text-right">
                <ActivityRowActions activity={a} barbers={barbers} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}

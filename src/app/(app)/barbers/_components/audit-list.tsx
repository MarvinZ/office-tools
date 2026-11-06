import { getTranslations } from "next-intl/server";
import { BUSINESS_TIME_ZONE } from "@/lib/barbers/dates";
import { fmtColones } from "@/lib/barbers/currency";
import type { BarberAuditEntry } from "@/services/barbers/audit";

const RATE_FIELDS = new Set(["commissionRate", "defaultCommissionRate", "ivaBaseRate", "ivaRate", "feeRate"]);
const MONEY_FIELDS = new Set(["fortnightlyAddition", "maintenanceDailyFee"]);
const SUMMARY_MONEY = new Set(["amount", "total", "totalTransfer"]);

const whenFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: BUSINESS_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * Who changed what that affects pay, newest first (spec §5 "Auditoría").
 * Server component; `names` maps barber ids to display names.
 */
export default async function AuditList({
  entries,
  names,
  showBarber = true,
}: {
  entries: BarberAuditEntry[];
  names: Record<string, string>;
  showBarber?: boolean;
}) {
  const t = await getTranslations("barbers.audit");
  const ts = await getTranslations("barbers.activityStatus.status");

  if (entries.length === 0) {
    return <p className="rounded-xl border border-zinc-200 p-4 text-sm text-zinc-400 dark:border-zinc-800">{t("empty")}</p>;
  }

  function value(e: BarberAuditEntry, field: string, v: unknown): string {
    if (v == null || v === "") return "—";
    if (typeof v === "boolean") return t(v ? "yes" : "no");
    if (e.action === "activity.status" && field === "status" && typeof v === "string") return ts(v);
    if (RATE_FIELDS.has(field) && typeof v === "number") return `${Math.round(v * 10000) / 100}%`;
    if (MONEY_FIELDS.has(field) && typeof v === "number") return fmtColones(v);
    return String(v);
  }

  function summary(e: BarberAuditEntry): string {
    const s = e.details.summary ?? {};
    const values: Record<string, string | number> = {};
    for (const [k, v] of Object.entries(s)) {
      if (v == null) continue;
      values[k] = SUMMARY_MONEY.has(k) && typeof v === "number" ? fmtColones(v) : v;
    }
    return t(`actions.${e.action}`, values);
  }

  return (
    <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 text-sm dark:divide-zinc-800 dark:border-zinc-800">
      {entries.map((e) => (
        <li key={e.id} className="flex flex-col gap-1 px-4 py-2.5">
          <div className="flex flex-wrap items-baseline gap-x-2 text-zinc-700 dark:text-zinc-300">
            <span className="font-medium text-black dark:text-white">{summary(e)}</span>
            {showBarber && e.details.barberId && names[e.details.barberId] && (
              <span className="text-zinc-500">· {names[e.details.barberId]}</span>
            )}
          </div>
          {e.details.changes && Object.keys(e.details.changes).length > 0 && (
            <ul className="text-xs text-zinc-500">
              {Object.entries(e.details.changes).map(([field, [from, to]]) => (
                <li key={field}>
                  {t.has(`fields.${field}`) ? t(`fields.${field}`) : field}: {value(e, field, from)} → {value(e, field, to)}
                </li>
              ))}
            </ul>
          )}
          {e.details.reason && <p className="text-xs text-zinc-500">{t("reason", { reason: e.details.reason })}</p>}
          <p className="text-xs text-zinc-400">
            {whenFmt.format(e.createdAt)} · {e.userName}
          </p>
        </li>
      ))}
    </ul>
  );
}

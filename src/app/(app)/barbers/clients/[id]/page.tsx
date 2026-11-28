import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { MessageCircle } from "lucide-react";
import { requireBarbersPage } from "@/services/barbers/roles";
import { getClientDetail } from "@/services/barbers/clients";
import { PAGE_AREAS } from "@/lib/barbers/permissions";
import { fmtDay, todayBusinessDate } from "@/lib/barbers/dates";
import { fmtColones } from "@/lib/barbers/currency";
import { ageOn, birthdayInMonth, whatsappLink } from "@/lib/barbers/clients";
import { monthOf } from "@/lib/barbers/panel";
import { fmtDateTime } from "../../panel/_lib/format";
import ClientForm from "../_components/client-form";

export const dynamic = "force-dynamic";

/** One client's record: data (missing fields highlighted, §13), visits, usual professional (§10). */
export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireBarbersPage(PAGE_AREAS["/barbers/clients"]);
  const { id } = await params;
  const [c, t, locale] = await Promise.all([getClientDetail(me.tenant.id, id), getTranslations("barbers.clients"), getLocale()]);
  if (!c) notFound();
  const today = todayBusinessDate();
  const birthday = birthdayInMonth(c.birthDate, monthOf(today));
  const wa = birthday ? whatsappLink(c.phone, t("birthdayMessage", { name: c.fullName.split(" ")[0], business: me.tenant.name })) : null;
  const th = "px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500";

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-10">
      <div className="flex items-center gap-2 text-sm text-zinc-400">
        <Link href="/barbers/clients" className="hover:text-black dark:hover:text-white">{t("title")}</Link>
        <span>›</span>
        <span className="text-black dark:text-white">{c.fullName}</span>
      </div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-black dark:text-white">{c.fullName}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {c.birthDate ? t("ageYears", { age: ageOn(c.birthDate, today) }) : t("ageUnknown")}
            {birthday && <> · {t("birthdayOn", { date: fmtDay(birthday) })}</>}
          </p>
        </div>
        {wa && (
          <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-2 text-sm text-black hover:border-zinc-400 dark:border-zinc-700 dark:text-white">
            <MessageCircle size={14} /> {t("prepareMessage")}
          </a>
        )}
      </div>

      {c.missing.length > 0 && (
        <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
          {t("missingFields", { fields: c.missing.map((f) => t(f)).join(", ") })}
        </p>
      )}

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          [t("visits"), String(c.visits)],
          [t("spent"), fmtColones(c.spent)],
          [t("lastVisit"), c.lastVisit ? fmtDateTime(c.lastVisit, locale) : "—"],
          [t("usualProfessional"), c.usualBarberName ?? "—"],
        ].map(([k, v]) => (
          <div key={k} className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
            <dt className="text-xs text-zinc-500">{k}</dt>
            <dd className="mt-0.5 font-semibold tabular-nums text-black dark:text-white">{v}</dd>
          </div>
        ))}
      </dl>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950 sm:p-5">
        <h2 className="mb-3 text-sm font-semibold text-black dark:text-white">{t("data")}</h2>
        <ClientForm
          today={today}
          missing={c.missing}
          initial={{ id: c.id, fullName: c.fullName, phone: c.phone, email: c.email, birthDate: c.birthDate, notes: c.notes }}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-black dark:text-white">{t("history")}</h2>
        {c.history.length === 0 ? (
          <p className="text-sm text-zinc-400">{t("noHistory")}</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
                    <th className={th}>{t("when")}</th>
                    <th className={th}>{t("item")}</th>
                    <th className={th}>{t("professional")}</th>
                    <th className={th}>{t("location")}</th>
                    <th className={th}>{t("method")}</th>
                    <th className={`${th} text-right`}>{t("amount")}</th>
                  </tr>
                </thead>
                <tbody>
                  {c.history.map((h) => (
                    <tr key={`${h.kind}-${h.id}`} className={`border-b border-zinc-100 last:border-0 dark:border-zinc-800 ${h.status === "voided" ? "text-zinc-400 line-through" : ""}`}>
                      <td className="whitespace-nowrap px-3 py-2 tabular-nums">{h.at ? fmtDateTime(h.at, locale) : fmtDay(h.date)}</td>
                      <td className="px-3 py-2">
                        {h.description}
                        {h.status !== "active" && <span className="ml-1.5 text-xs text-zinc-500">({t(`status.${h.status}`)})</span>}
                      </td>
                      <td className="px-3 py-2">{h.barberName ?? "—"}</td>
                      <td className="px-3 py-2">{h.locationName ?? "—"}</td>
                      <td className="px-3 py-2">{h.paymentMethodName ?? "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtColones(h.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

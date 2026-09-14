import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireTenant } from "@/services/tenants";
import { getBarber } from "@/services/barbers/barbers";
import { listLocations } from "@/services/barbers/locations";
import EditBarberModal from "./_components/edit-barber-modal";
import BarberLocationsEditor from "./_components/barber-locations-editor";
import BarberRatesEditor from "./_components/barber-rates-editor";

export const dynamic = "force-dynamic";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  inactive: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

export default async function BarberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [tenant, t, tc] = await Promise.all([requireTenant(), getTranslations("barbers"), getTranslations("common")]);

  const [barber, allLocations] = await Promise.all([getBarber(tenant.id, id), listLocations(tenant.id)]);
  if (!barber) notFound();

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10">
      <div className="flex items-center gap-2 text-sm text-zinc-400">
        <Link href="/barbers/barbers" className="hover:text-black dark:hover:text-white">{t("barbersPage.title")}</Link>
        <span>›</span>
        <span className="text-black dark:text-white">{barber.firstName} {barber.lastName}</span>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-zinc-100 text-xl font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            {barber.firstName[0]}{barber.lastName[0]}
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-black dark:text-white">{barber.firstName} {barber.lastName}</h1>
            <p className="mt-0.5 text-sm text-zinc-500">{barber.email ?? barber.phone ?? tc("notApplicable")}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${STATUS_COLORS[barber.status]}`}>
            {t(`status.${barber.status}`)}
          </span>
          <EditBarberModal barber={barber} />
        </div>
      </div>

      {barber.notes && (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">{t("barberDetail.sectionNotes")}</p>
          <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">{barber.notes}</p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-black dark:text-white">{t("barberDetail.sectionLocations")}</h2>
        <BarberLocationsEditor barberId={barber.id} allLocations={allLocations} assignedLocationIds={barber.assignedLocations.map((l) => l.locationId)} />
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-black dark:text-white">{t("barberDetail.sectionRates")}</h2>
        <BarberRatesEditor barberId={barber.id} rates={barber.effectiveRates} />
      </div>
    </div>
  );
}

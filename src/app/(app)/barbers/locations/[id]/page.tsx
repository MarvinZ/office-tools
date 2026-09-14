import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireTenant } from "@/services/tenants";
import { getLocation } from "@/services/barbers/locations";
import EditLocationModal from "./_components/edit-location-modal";
import LocationPricingEditor from "./_components/location-pricing-editor";

export const dynamic = "force-dynamic";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  inactive: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

export default async function LocationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [tenant, t, tc] = await Promise.all([requireTenant(), getTranslations("barbers"), getTranslations("common")]);

  const location = await getLocation(tenant.id, id);
  if (!location) notFound();

  const address = [location.addressStreet, location.addressCity, location.addressState, location.addressZip, location.addressCountry].filter(Boolean).join(", ");

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10">
      <div className="flex items-center gap-2 text-sm text-zinc-400">
        <Link href="/barbers/locations" className="hover:text-black dark:hover:text-white">{t("locationsPage.title")}</Link>
        <span>›</span>
        <span className="text-black dark:text-white">{location.name}</span>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-black dark:text-white">{location.name}</h1>
          <p className="mt-0.5 text-sm text-zinc-500">{address || tc("notApplicable")}</p>
          {location.phone && <p className="mt-0.5 text-sm text-zinc-500">{location.phone}</p>}
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${STATUS_COLORS[location.status]}`}>
            {t(`status.${location.status}`)}
          </span>
          <EditLocationModal location={location} />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-black dark:text-white">{t("locationDetail.sectionBarbers")}</h2>
        <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          {location.assignedBarbers.length === 0 ? (
            <p className="text-sm text-zinc-400">{t("locationDetail.barbersEmpty")}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {location.assignedBarbers.map((b) => (
                <li key={b.barberId} className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                  <Link href={`/barbers/barbers/${b.barberId}`} className="hover:text-black dark:hover:text-white">
                    {b.firstName} {b.lastName}
                  </Link>
                  {b.status === "inactive" && <span className="text-xs text-zinc-400">({t("status.inactive")})</span>}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-zinc-400">{t("locationDetail.manageAssignmentsNote")}</p>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-black dark:text-white">{t("locationDetail.sectionPricing")}</h2>
        <LocationPricingEditor locationId={location.id} servicePrices={location.servicePrices} />
      </div>
    </div>
  );
}

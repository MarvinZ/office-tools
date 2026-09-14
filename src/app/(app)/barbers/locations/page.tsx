import { getTranslations } from "next-intl/server";
import { requireTenant } from "@/services/tenants";
import { listLocations } from "@/services/barbers/locations";
import LocationListClient from "./_components/location-list-client";
import CreateLocationModal from "./_components/create-location-modal";

export const dynamic = "force-dynamic";

export default async function LocationsListPage() {
  const [tenant, t] = await Promise.all([requireTenant(), getTranslations("barbers")]);
  const locations = await listLocations(tenant.id);
  const active = locations.filter((l) => l.status === "active").length;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-black dark:text-white">{t("locationsPage.title")}</h1>
          <p className="mt-1 text-sm text-zinc-500">{t("locationsPage.subtitle", { total: locations.length, active })}</p>
        </div>
        <CreateLocationModal />
      </div>
      <LocationListClient locations={locations} />
    </div>
  );
}

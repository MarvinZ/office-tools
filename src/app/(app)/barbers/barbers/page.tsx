import { getTranslations } from "next-intl/server";
import { requireTenant } from "@/services/tenants";
import { listBarbers } from "@/services/barbers/barbers";
import { listLocations } from "@/services/barbers/locations";
import BarberListClient from "./_components/barber-list-client";
import CreateBarberModal from "./_components/create-barber-modal";

export const dynamic = "force-dynamic";

export default async function BarbersListPage() {
  const [tenant, t] = await Promise.all([requireTenant(), getTranslations("barbers")]);
  const [barbers, locations] = await Promise.all([listBarbers(tenant.id), listLocations(tenant.id)]);
  const active = barbers.filter((b) => b.status === "active").length;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-black dark:text-white">{t("barbersPage.title")}</h1>
          <p className="mt-1 text-sm text-zinc-500">{t("barbersPage.subtitle", { total: barbers.length, active })}</p>
        </div>
        <CreateBarberModal locations={locations.filter((l) => l.status === "active")} />
      </div>
      <BarberListClient barbers={barbers} />
    </div>
  );
}

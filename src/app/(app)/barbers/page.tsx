import { getTranslations } from "next-intl/server";
import { requireTenant } from "@/services/tenants";
import { listBarbersAtLocation } from "@/services/barbers/barbers";
import { listLocations } from "@/services/barbers/locations";
import { listServices } from "@/services/barbers/catalog";
import { listActivities, resolveEffectiveCommissionRates } from "@/services/barbers/activities";
import { listRoster } from "@/services/barbers/roster";
import { startOfDayUtc, endOfDayUtc } from "@/services/barbers/payout-report";
import { db } from "@/db";
import { locationServices } from "@/db/schema";
import { eq } from "drizzle-orm";
import LocationGate from "./_components/location-gate";
import RosterChecklist from "./_components/roster-checklist";
import ActivityEntryForm from "./_components/activity-entry-form";

export const dynamic = "force-dynamic";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * "Today" as a UTC calendar day, matching the payout report's day-boundary
 * convention exactly (see startOfDayUtc/endOfDayUtc in payout-report.ts) so
 * "today" means the same thing everywhere in this module.
 */
function todayUtcDateString(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${pad2(now.getUTCMonth() + 1)}-${pad2(now.getUTCDate())}`;
}

export default async function BarbersLogPage({
  searchParams,
}: {
  searchParams: Promise<{ locationId?: string }>;
}) {
  const [{ locationId }, tenant, t] = await Promise.all([
    searchParams,
    requireTenant(),
    getTranslations("barbers"),
  ]);

  const allLocations = await listLocations(tenant.id);
  const activeLocations = allLocations.filter((l) => l.status === "active");
  const selectedLocation = locationId ? activeLocations.find((l) => l.id === locationId) ?? null : null;

  // No location chosen yet (or the remembered one is no longer valid) — show
  // the one-time picker instead of the entry form.
  if (!selectedLocation) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-10">
        <div>
          <h1 className="text-2xl font-semibold text-black dark:text-white">{t("log.title")}</h1>
          <p className="mt-1 text-sm text-zinc-500">{t("log.chooseLocationSubtitle")}</p>
        </div>
        <LocationGate locations={activeLocations} />
      </div>
    );
  }

  const today = todayUtcDateString();

  const [barbersAtLocation, allServices, roster, todaysActivities, priceRows] = await Promise.all([
    listBarbersAtLocation(tenant.id, selectedLocation.id),
    listServices(tenant.id),
    listRoster(tenant.id, selectedLocation.id, today),
    listActivities(tenant.id, {
      locationId: selectedLocation.id,
      dateFrom: startOfDayUtc(today),
      dateTo: endOfDayUtc(today),
    }),
    db.select().from(locationServices).where(eq(locationServices.tenantId, tenant.id)),
  ]);

  const activeServices = allServices.filter((s) => s.status === "active");
  const checkedInIds = new Set(roster.map((r) => r.barberId));
  const checkedInBarbers = barbersAtLocation.filter((b) => checkedInIds.has(b.id));

  const priceMap = priceRows
    .filter((p) => p.locationId === selectedLocation.id)
    .map((p) => ({ serviceId: p.serviceId, price: parseFloat(p.price) }));

  // Prefetch effective rates for DISPLAY ONLY, resolved server-side with the same
  // canonical rule logActivity uses — the form never submits these values.
  const rateMaps = await Promise.all(
    checkedInBarbers.map((b) => resolveEffectiveCommissionRates(tenant.id, b.id, activeServices))
  );
  const effectiveRateMap = checkedInBarbers.flatMap((b, i) =>
    Array.from(rateMaps[i].values()).map((r) => ({
      barberId: b.id,
      serviceId: r.serviceId,
      commissionRate: r.rate,
    }))
  );

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-black dark:text-white">{t("log.title")}</h1>
          <p className="mt-1 text-sm text-zinc-500">{t("log.subtitle")}</p>
        </div>
        <LocationGate locations={activeLocations} current={selectedLocation} compact />
      </div>

      <RosterChecklist
        locationId={selectedLocation.id}
        workDate={today}
        barbersAtLocation={barbersAtLocation}
        checkedInIds={Array.from(checkedInIds)}
      />

      <ActivityEntryForm
        locationId={selectedLocation.id}
        barbers={checkedInBarbers}
        services={activeServices}
        priceMap={priceMap}
        effectiveRateMap={effectiveRateMap}
        initialActivities={todaysActivities}
      />
    </div>
  );
}

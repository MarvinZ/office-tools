"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { logActivityAction } from "../actions";
import RecentActivityList from "./recent-activity-list";
import type { BarberRow } from "@/services/barbers/barbers";
import type { ServiceRow } from "@/services/barbers/catalog";
import type { ActivityListItem } from "@/services/barbers/activities";

type PriceEntry = { serviceId: string; price: number };
/**
 * Pre-resolved effective rates, computed server-side by the page using the same
 * canonical resolver as logActivity (resolveEffectiveCommissionRates). This
 * component does NOT re-implement "override else default" — it only displays
 * what the server resolved, and the value is never submitted: the server
 * resolves its own authoritative rate when the activity is logged.
 */
type EffectiveRateEntry = { barberId: string; serviceId: string; commissionRate: number };

function nowLocalDatetime(): string {
  const d = new Date();
  d.setSeconds(0, 0);
  const tzOffsetMs = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffsetMs).toISOString().slice(0, 16);
}

export default function ActivityEntryForm({
  locationId,
  barbers,
  services,
  priceMap,
  effectiveRateMap,
  initialActivities,
}: {
  locationId: string;
  barbers: BarberRow[];
  services: ServiceRow[];
  priceMap: PriceEntry[];
  effectiveRateMap: EffectiveRateEntry[];
  initialActivities: ActivityListItem[];
}) {
  const t = useTranslations("barbers");
  const tc = useTranslations("common");
  const [pending, startTransition] = useTransition();
  const [activities, setActivities] = useState(initialActivities);
  const [error, setError] = useState<string | null>(null);

  const [barberId, setBarberId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [priceCharged, setPriceCharged] = useState("");
  const [performedAt, setPerformedAt] = useState(nowLocalDatetime());

  const priceLookup = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of priceMap) map.set(p.serviceId, p.price);
    return map;
  }, [priceMap]);

  const effectiveRateLookup = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of effectiveRateMap) map.set(`${r.barberId}:${r.serviceId}`, r.commissionRate);
    return map;
  }, [effectiveRateMap]);

  // Display-only preview of the rate the server will apply. It is never sent to
  // the server action — the server resolves the authoritative rate from the DB.
  const previewRate = useMemo(() => {
    if (!barberId || !serviceId) return null;
    return effectiveRateLookup.get(`${barberId}:${serviceId}`) ?? null;
  }, [barberId, serviceId, effectiveRateLookup]);

  function applyPriceAutoFill(nextServiceId: string) {
    if (nextServiceId) {
      const price = priceLookup.get(nextServiceId);
      if (price != null) setPriceCharged(String(price));
    }
  }

  function handleBarberChange(value: string) {
    setBarberId(value);
  }

  function handleServiceChange(value: string) {
    setServiceId(value);
    applyPriceAutoFill(value);
  }

  function resetForm() {
    setBarberId("");
    setServiceId("");
    setCustomerName("");
    setPriceCharged("");
    setPerformedAt(nowLocalDatetime());
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const price = parseFloat(priceCharged);
    if (!barberId || !serviceId) {
      setError(t("log.errorMissingFields"));
      return;
    }
    if (Number.isNaN(price)) {
      setError(t("log.errorInvalidNumbers"));
      return;
    }

    startTransition(async () => {
      try {
        const row = await logActivityAction({
          barberId,
          locationId,
          serviceId,
          customerName: customerName || undefined,
          priceCharged: price,
          // No commissionRate: the server resolves the authoritative rate itself.
          performedAt: performedAt ? new Date(performedAt).toISOString() : undefined,
        });

        const barber = barbers.find((b) => b.id === barberId);
        const service = services.find((s) => s.id === serviceId);

        setActivities((prev) => [
          {
            id: row.id,
            tenantId: row.tenantId,
            barberId: row.barberId,
            barberName: barber ? `${barber.firstName} ${barber.lastName}` : "",
            locationId: row.locationId,
            locationName: "",
            serviceId: row.serviceId,
            serviceName: service?.name ?? "",
            customerName: row.customerName,
            priceCharged: parseFloat(row.priceCharged),
            commissionRate: parseFloat(row.commissionRate),
            commissionAmount: parseFloat(row.commissionAmount),
            performedAt: row.performedAt,
            createdBy: row.createdBy,
            createdAt: row.createdAt,
          },
          ...prev,
        ]);

        resetForm();
      } catch {
        setError(t("log.errorSubmitFailed"));
      }
    });
  }

  const inputCls = "w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:focus:ring-white";
  const labelCls = "block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1";

  return (
    <div className="flex flex-col gap-8">
      <form onSubmit={handleSubmit} className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        {barbers.length === 0 && (
          <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
            {t("log.noOneCheckedIn")}
          </p>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className={labelCls}>{t("log.fieldBarber")} *</label>
            <select required disabled={barbers.length === 0} value={barberId} onChange={(e) => handleBarberChange(e.target.value)} className={inputCls}>
              <option value="">{t("log.selectPlaceholder")}</option>
              {barbers.map((b) => <option key={b.id} value={b.id}>{b.firstName} {b.lastName}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>{t("log.fieldService")} *</label>
            <select required value={serviceId} onChange={(e) => handleServiceChange(e.target.value)} className={inputCls}>
              <option value="">{t("log.selectPlaceholder")}</option>
              {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>{t("log.fieldCustomerName")}</label>
            <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder={t("log.fieldCustomerNamePlaceholder")} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>{t("log.fieldPrice")} *</label>
            <input required type="number" min="0" step="0.01" value={priceCharged} onChange={(e) => setPriceCharged(e.target.value)} placeholder="0.00" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>{t("log.fieldCommissionRate")}</label>
            <p
              aria-live="polite"
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400"
            >
              {previewRate != null ? `${(previewRate * 100).toFixed(2)}%` : "—"}
            </p>
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>{t("log.fieldPerformedAt")}</label>
            <input type="datetime-local" value={performedAt} onChange={(e) => setPerformedAt(e.target.value)} className={inputCls} />
          </div>
        </div>

        {error && <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="mt-6 flex justify-end">
          <button
            type="submit"
            disabled={pending || barbers.length === 0}
            className="rounded-lg bg-black px-5 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
          >
            {pending ? tc("saving") : t("log.submitButton")}
          </button>
        </div>
      </form>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-black dark:text-white">{t("log.todaySectionTitle")}</h2>
        <RecentActivityList activities={activities} />
      </div>
    </div>
  );
}

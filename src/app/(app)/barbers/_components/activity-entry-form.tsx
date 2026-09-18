"use client";

import { useMemo, useState, useTransition } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { logActivityBatchAction } from "../actions";
import { fmtColones } from "@/lib/barbers/currency";
import RecentActivityList from "./recent-activity-list";
import ServiceCombobox from "./service-combobox";
import FavoriteServiceButtons from "./favorite-service-buttons";
import type { BarberRow } from "@/services/barbers/barbers";
import type { ServiceRow } from "@/services/barbers/catalog";
import type { PaymentMethodRow } from "@/services/barbers/payment-methods";
import type { ActivityListItem } from "@/services/barbers/activities";

type PriceEntry = { serviceId: string; price: number };
/**
 * Pre-resolved effective rates, computed server-side by the page using the same
 * canonical resolver as logActivityBatch (resolveEffectiveCommissionRates). This
 * component does NOT re-implement "override else default" — it only displays
 * what the server resolved, and the values are never submitted: the server
 * resolves its own authoritative rates when the activities are logged.
 */
type EffectiveRateEntry = { barberId: string; serviceId: string; commissionRate: number };

/**
 * One line in the local draft cart. `clientId` is a browser-only React key —
 * it is never sent to the server, which mints its own row ids.
 */
type CartLine = {
  clientId: string;
  serviceId: string;
  serviceName: string;
  priceCharged: string;
};

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
  paymentMethods,
  favoriteServices,
  priceMap,
  effectiveRateMap,
  initialActivities,
}: {
  locationId: string;
  barbers: BarberRow[];
  services: ServiceRow[];
  paymentMethods: PaymentMethodRow[];
  favoriteServices: ServiceRow[];
  priceMap: PriceEntry[];
  effectiveRateMap: EffectiveRateEntry[];
  initialActivities: ActivityListItem[];
}) {
  const t = useTranslations("barbers");
  const tc = useTranslations("common");
  const [pending, startTransition] = useTransition();
  const [activities, setActivities] = useState(initialActivities);
  const [error, setError] = useState<string | null>(null);

  // Header fields — picked once per submission, shared by every cart line.
  const [barberId, setBarberId] = useState("");
  const [paymentMethodId, setPaymentMethodId] = useState(paymentMethods[0]?.id ?? "");
  const [customerName, setCustomerName] = useState("");
  const [performedAt, setPerformedAt] = useState(nowLocalDatetime());

  const [lines, setLines] = useState<CartLine[]>([]);

  const priceLookup = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of priceMap) map.set(p.serviceId, p.price);
    return map;
  }, [priceMap]);

  const serviceById = useMemo(() => {
    const map = new Map<string, ServiceRow>();
    for (const s of services) map.set(s.id, s);
    return map;
  }, [services]);

  const effectiveRateLookup = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of effectiveRateMap) map.set(`${r.barberId}:${r.serviceId}`, r.commissionRate);
    return map;
  }, [effectiveRateMap]);

  const feeRateById = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of paymentMethods) map.set(m.id, parseFloat(m.feeRate));
    return map;
  }, [paymentMethods]);

  const cartTotal = useMemo(
    () => lines.reduce((sum, l) => sum + (parseFloat(l.priceCharged) || 0), 0),
    [lines]
  );

  /**
   * Display-only preview of the commission the server will compute, using the
   * same three-factor formula (price x effective rate x (1 - payment fee)).
   * None of this is submitted — the server resolves its own authoritative rates.
   */
  const previewCommission = useMemo(() => {
    if (!barberId || !paymentMethodId) return null;
    const feeRate = feeRateById.get(paymentMethodId);
    if (feeRate == null) return null;
    let total = 0;
    for (const l of lines) {
      const rate = effectiveRateLookup.get(`${barberId}:${l.serviceId}`);
      const price = parseFloat(l.priceCharged);
      if (rate == null || Number.isNaN(price)) return null;
      total += Math.round(price * rate * (1 - feeRate) * 100) / 100;
    }
    return Math.round(total * 100) / 100;
  }, [barberId, paymentMethodId, lines, effectiveRateLookup, feeRateById]);

  function addService(serviceId: string) {
    const service = serviceById.get(serviceId);
    if (!service) return;
    const price = priceLookup.get(serviceId);
    setLines((prev) => [
      ...prev,
      {
        clientId: crypto.randomUUID(),
        serviceId,
        serviceName: service.name,
        priceCharged: price != null ? String(price) : "",
      },
    ]);
    setError(null);
  }

  function updateLinePrice(clientId: string, value: string) {
    setLines((prev) => prev.map((l) => (l.clientId === clientId ? { ...l, priceCharged: value } : l)));
  }

  function removeLine(clientId: string) {
    setLines((prev) => prev.filter((l) => l.clientId !== clientId));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!barberId || !paymentMethodId) {
      setError(t("log.errorMissingFields"));
      return;
    }
    if (lines.length === 0) {
      setError(t("log.errorEmptyCart"));
      return;
    }

    const parsed = lines.map((l) => ({ serviceId: l.serviceId, priceCharged: parseFloat(l.priceCharged) }));
    if (parsed.some((l) => Number.isNaN(l.priceCharged))) {
      setError(t("log.errorInvalidNumbers"));
      return;
    }

    startTransition(async () => {
      try {
        const rows = await logActivityBatchAction({
          barberId,
          locationId,
          paymentMethodId,
          customerName: customerName || undefined,
          // No commissionRate / feeRate: the server resolves both itself.
          performedAt: performedAt ? new Date(performedAt).toISOString() : undefined,
          lines: parsed,
        });

        const barber = barbers.find((b) => b.id === barberId);
        const paymentMethod = paymentMethods.find((m) => m.id === paymentMethodId);

        setActivities((prev) => [
          ...rows.map((row) => ({
            id: row.id,
            tenantId: row.tenantId,
            barberId: row.barberId,
            barberName: barber ? `${barber.firstName} ${barber.lastName}` : "",
            locationId: row.locationId,
            locationName: "",
            serviceId: row.serviceId,
            serviceName: serviceById.get(row.serviceId)?.name ?? "",
            paymentMethodId: row.paymentMethodId,
            paymentMethodName: paymentMethod?.name ?? "",
            paymentMethodFeeRate: parseFloat(row.paymentMethodFeeRate),
            customerName: row.customerName,
            priceCharged: parseFloat(row.priceCharged),
            commissionRate: parseFloat(row.commissionRate),
            commissionAmount: parseFloat(row.commissionAmount),
            performedAt: row.performedAt,
            createdBy: row.createdBy,
            createdAt: row.createdAt,
          })),
          ...prev,
        ]);

        // Keep barber + payment method: the front desk usually logs several
        // rounds for the same barber and tender in a row.
        setLines([]);
        setCustomerName("");
        setPerformedAt(nowLocalDatetime());
      } catch {
        // Nothing was written (the batch is a single atomic statement), so the
        // cart is deliberately left intact for a safe retry.
        setError(t("log.errorSubmitFailed"));
      }
    });
  }

  const inputCls = "w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:focus:ring-white";
  const labelCls = "block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1";

  return (
    <div className="flex flex-col gap-8">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950 sm:p-6">
        {barbers.length === 0 && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
            {t("log.noOneCheckedIn")}
          </p>
        )}
        {paymentMethods.length === 0 && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
            {t("log.noPaymentMethods")}
          </p>
        )}

        {/* Header: chosen once for the whole cart */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls}>{t("log.fieldBarber")} *</label>
            <select required disabled={barbers.length === 0} value={barberId} onChange={(e) => setBarberId(e.target.value)} className={inputCls}>
              <option value="">{t("log.selectPlaceholder")}</option>
              {barbers.map((b) => <option key={b.id} value={b.id}>{b.firstName} {b.lastName}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>{t("log.fieldPaymentMethod")} *</label>
            <select required disabled={paymentMethods.length === 0} value={paymentMethodId} onChange={(e) => setPaymentMethodId(e.target.value)} className={inputCls}>
              <option value="">{t("log.selectPlaceholder")}</option>
              {paymentMethods.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                  {parseFloat(m.feeRate) > 0 ? ` (${(parseFloat(m.feeRate) * 100).toFixed(2)}%)` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>{t("log.fieldCustomerName")}</label>
            <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder={t("log.fieldCustomerNamePlaceholder")} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>{t("log.fieldPerformedAt")}</label>
            <input type="datetime-local" value={performedAt} onChange={(e) => setPerformedAt(e.target.value)} className={inputCls} />
          </div>
        </div>

        {/* Service picker: favorites first, then typeahead */}
        <div className="flex flex-col gap-3 border-t border-zinc-200 pt-5 dark:border-zinc-800">
          <FavoriteServiceButtons services={favoriteServices} onSelect={addService} />
          <div>
            <label className={labelCls}>{t("log.fieldService")}</label>
            <ServiceCombobox services={services} onSelect={addService} placeholder={t("log.serviceSearchPlaceholder")} />
          </div>
        </div>

        {/* Cart — stacked vertically so it stays readable at ~375px */}
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{t("log.cartTitle")}</p>
          {lines.length === 0 ? (
            <p className="rounded-lg border border-dashed border-zinc-200 px-3 py-6 text-center text-sm text-zinc-400 dark:border-zinc-800">
              {t("log.cartEmpty")}
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {lines.map((line) => (
                <li
                  key={line.clientId}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2.5 dark:border-zinc-800"
                >
                  <span className="min-w-0 flex-1 truncate text-sm text-black dark:text-white">{line.serviceName}</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    aria-label={t("log.fieldPrice")}
                    value={line.priceCharged}
                    onChange={(e) => updateLinePrice(line.clientId, e.target.value)}
                    placeholder="0.00"
                    className="w-28 shrink-0 rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:focus:ring-white"
                  />
                  <button
                    type="button"
                    onClick={() => removeLine(line.clientId)}
                    aria-label={t("log.removeLine")}
                    className="shrink-0 rounded-lg p-1.5 text-zinc-400 hover:text-red-600 dark:hover:text-red-400"
                  >
                    <X size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {lines.length > 0 && (
          <div className="flex flex-col gap-1 border-t border-zinc-200 pt-4 text-sm dark:border-zinc-800">
            <div className="flex items-center justify-between">
              <span className="text-zinc-500">{t("log.cartTotal")}</span>
              <span className="font-semibold text-black dark:text-white">{fmtColones(cartTotal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-500">{t("log.cartEstimatedCommission")}</span>
              <span aria-live="polite" className="text-zinc-700 dark:text-zinc-300">
                {previewCommission != null ? fmtColones(previewCommission) : "—"}
              </span>
            </div>
          </div>
        )}

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={pending || barbers.length === 0 || paymentMethods.length === 0 || lines.length === 0}
            className="w-full rounded-lg bg-black px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200 sm:w-auto"
          >
            {pending ? tc("saving") : t("log.submitAllButton", { count: lines.length })}
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

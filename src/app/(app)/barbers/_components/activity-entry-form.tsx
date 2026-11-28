"use client";

import { useMemo, useState, useTransition } from "react";
import { Package, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { logTicketAction } from "../actions";
import { productSaleFigures } from "@/lib/barbers/product-commissions";
import { fmtColones } from "@/lib/barbers/currency";
import RecentActivityList from "./recent-activity-list";
import ServiceCombobox from "./service-combobox";
import FavoriteServiceButtons from "./favorite-service-buttons";
import type { BarberRow } from "@/services/barbers/barbers";
import type { ServiceRow } from "@/services/barbers/catalog";
import type { PaymentMethodRow } from "@/services/barbers/payment-methods";
import type { ActivityListItem } from "@/services/barbers/activities";
import Decimal from "decimal.js";
import { lineCommission } from "@/lib/barbers/settlement";
import { unwrap } from "@/lib/barbers/errors";
import ClientPicker, { type PickedClient } from "./client-picker";
import SplitPayment, { remainingOf, type PaymentRow } from "./split-payment";

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

type ProductOption = { id: string; name: string; price: number; commissionAmount: number; chargesIva: boolean };

/**
 * A product on the same ticket. Its commission goes to the ticket's barber by
 * default ("ticket"), to another collaborator, or to nobody ("none").
 */
type ProductLine = {
  clientId: string;
  productId: string;
  quantity: string;
  earner: string; // "ticket" | "none" | barberId
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
  ivaRate,
  products,
}: {
  locationId: string;
  barbers: BarberRow[];
  services: ServiceRow[];
  paymentMethods: PaymentMethodRow[];
  favoriteServices: ServiceRow[];
  priceMap: PriceEntry[];
  effectiveRateMap: EffectiveRateEntry[];
  initialActivities: ActivityListItem[];
  ivaRate: number;
  products: ProductOption[];
}) {
  const t = useTranslations("barbers");
  const tc = useTranslations("common");
  const [pending, startTransition] = useTransition();
  const [activities, setActivities] = useState(initialActivities);
  // Take the server's list whenever it changes (after a void/courtesy/warranty
  // refresh). The optimistic rows added below are replaced by real ones then.
  const [syncedFrom, setSyncedFrom] = useState(initialActivities);
  if (initialActivities !== syncedFrom) {
    setSyncedFrom(initialActivities);
    setActivities(initialActivities);
  }
  const [error, setError] = useState<string | null>(null);

  // Header fields — picked once per submission, shared by every cart line.
  const [barberId, setBarberId] = useState("");
  const [paymentMethodId, setPaymentMethodId] = useState(paymentMethods[0]?.id ?? "");
  const [client, setClient] = useState<PickedClient>({ id: null, name: "" });
  // Split payment: off = everything with paymentMethodId.
  const [splitRows, setSplitRows] = useState<PaymentRow[] | null>(null);
  const [performedAt, setPerformedAt] = useState(nowLocalDatetime());

  const [lines, setLines] = useState<CartLine[]>([]);
  const [productLines, setProductLines] = useState<ProductLine[]>([]);
  const [savedNote, setSavedNote] = useState<string | null>(null);

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  /** Price, IVA, total and commission per product line, as the server will compute them. */
  const productFigures = useMemo(
    () =>
      productLines.map((l) => {
        const p = productById.get(l.productId);
        const qty = Math.floor(Number(l.quantity));
        if (!p || !(qty >= 1)) return null;
        return productSaleFigures({
          unitPrice: p.price,
          quantity: qty,
          chargesIva: p.chargesIva,
          ivaRate,
          commissionPerUnit: l.earner === "none" ? 0 : p.commissionAmount,
        });
      }),
    [productLines, productById, ivaRate]
  );
  const productsTotal = productFigures.reduce((n, f) => n + (f?.total ?? 0), 0);
  const productsIva = productFigures.reduce((n, f) => n + (f?.ivaAmount ?? 0), 0);
  const productsCommission = productFigures.reduce((n, f) => n + (f?.commissionTotal ?? 0), 0);
  const lineCount = lines.length + productLines.length;

  function addProduct(productId: string) {
    if (!productById.has(productId)) return;
    setProductLines((prev) => [...prev, { clientId: crypto.randomUUID(), productId, quantity: "1", earner: "ticket" }]);
    setError(null);
  }

  function updateProductLine(clientId: string, patch: Partial<ProductLine>) {
    setProductLines((prev) => prev.map((l) => (l.clientId === clientId ? { ...l, ...patch } : l)));
  }

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

  const cartTotal = useMemo(
    () => lines.reduce((sum, l) => sum + (parseFloat(l.priceCharged) || 0), 0),
    [lines]
  );
  // What the customer pays for the whole ticket (exact, for split payments).
  const ticketTotal = new Decimal(cartTotal).plus(productsTotal).toDecimalPlaces(2).toNumber();

  /**
   * Display-only preview of the commission the server will store: commission on
   * the IVA-free base (lineCommission), before settlement deductions such as
   * the card fee. Nothing here is submitted — the server resolves its own
   * authoritative rates.
   */
  const previewCommission = useMemo(() => {
    if (!barberId) return null;
    let total = new Decimal(0);
    for (const l of lines) {
      const rate = effectiveRateLookup.get(`${barberId}:${l.serviceId}`);
      const price = parseFloat(l.priceCharged);
      if (rate == null || Number.isNaN(price)) return null;
      total = total.plus(lineCommission(price, rate, ivaRate));
    }
    return total.toDecimalPlaces(2).toNumber();
  }, [barberId, lines, effectiveRateLookup, ivaRate]);

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
    if (lineCount === 0) {
      setError(t("log.errorEmptyCart"));
      return;
    }
    if (productFigures.some((f) => f == null)) {
      setError(t("log.errorInvalidNumbers"));
      return;
    }

    const parsed = lines.map((l) => ({ serviceId: l.serviceId, priceCharged: parseFloat(l.priceCharged) }));
    if (parsed.some((l) => Number.isNaN(l.priceCharged))) {
      setError(t("log.errorInvalidNumbers"));
      return;
    }
    if (splitRows && remainingOf(ticketTotal, splitRows) !== 0) {
      setError(t("splitPayment.mustAddUp"));
      return;
    }

    startTransition(async () => {
      try {
        // One ticket: services and products are saved together or not at all.
        const { activities: rows, salesCount } = await unwrap(logTicketAction({
          barberId,
          locationId,
          paymentMethodId,
          payments: splitRows?.map((r) => ({ paymentMethodId: r.paymentMethodId, amount: Number(r.amount) })),
          clientId: client.id,
          customerName: client.name.trim() || undefined,
          // No commissionRate / feeRate / prices of products: the server resolves them.
          performedAt: performedAt ? new Date(performedAt).toISOString() : undefined,
          services: parsed,
          products: productLines.map((l) => ({
            productId: l.productId,
            quantity: Math.floor(Number(l.quantity)),
            barberId: l.earner === "none" ? null : l.earner === "ticket" ? barberId : l.earner,
          })),
        }));

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
            serviceName: (row.serviceId && serviceById.get(row.serviceId)?.name) || row.description || "",
            paymentMethodId: row.paymentMethodId,
            paymentMethodName: paymentMethod?.name ?? "",
            paymentMethodFeeRate: parseFloat(row.paymentMethodFeeRate),
            customerName: row.customerName,
            priceCharged: parseFloat(row.priceCharged),
            commissionRate: parseFloat(row.commissionRate),
            commissionAmount: parseFloat(row.commissionAmount),
            performedAt: row.performedAt,
            status: row.status,
            statusReason: row.statusReason,
            warrantyOfActivityId: row.warrantyOfActivityId,
            createdBy: row.createdBy,
            createdAt: row.createdAt,
          })),
          ...prev,
        ]);

        // Keep barber + payment method: the front desk usually logs several
        // rounds for the same barber and tender in a row.
        setLines([]);
        setProductLines([]);
        setSavedNote(t("log.ticketSaved", { services: rows.length, products: salesCount }));
        setClient({ id: null, name: "" });
        setSplitRows(null);
        setPerformedAt(nowLocalDatetime());
      } catch (e) {
        // Nothing was written (the ticket is one atomic batch), so the cart is
        // deliberately left intact for a safe retry.
        setError(e instanceof Error ? e.message : t("log.errorSubmitFailed"));
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
            <ClientPicker value={client} onChange={setClient} />
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
          {lineCount === 0 ? (
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

        {/* Products on the same ticket */}
        {products.length > 0 && (
          <div className="flex flex-col gap-2 border-t border-zinc-200 pt-5 dark:border-zinc-800">
            <label htmlFor="addProduct" className={labelCls}>
              <span className="inline-flex items-center gap-1.5"><Package size={13} /> {t("log.productsTitle")}</span>
            </label>
            <select
              id="addProduct"
              value=""
              onChange={(e) => addProduct(e.target.value)}
              className={inputCls}
            >
              <option value="">{t("log.addProduct")}</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {fmtColones(p.price)}
                  {p.chargesIva ? ` + ${t("log.iva")}` : ""}
                </option>
              ))}
            </select>
            {productLines.length > 0 && (
              <ul className="flex flex-col gap-2">
                {productLines.map((line, i) => {
                  const product = productById.get(line.productId);
                  const fig = productFigures[i];
                  return (
                    <li
                      key={line.clientId}
                      className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2.5 dark:border-zinc-800"
                    >
                      <span className="min-w-0 flex-1 truncate text-sm text-black dark:text-white">{product?.name}</span>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        aria-label={t("log.quantity")}
                        value={line.quantity}
                        onChange={(e) => updateProductLine(line.clientId, { quantity: e.target.value })}
                        className="w-16 shrink-0 rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:focus:ring-white"
                      />
                      <select
                        aria-label={t("log.commissionTo")}
                        value={line.earner}
                        onChange={(e) => updateProductLine(line.clientId, { earner: e.target.value })}
                        className="w-44 shrink-0 rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                      >
                        <option value="ticket">{t("log.commissionToTicketBarber")}</option>
                        {barbers.map((b) => (
                          <option key={b.id} value={b.id}>{b.firstName} {b.lastName}</option>
                        ))}
                        <option value="none">{t("log.noCommission")}</option>
                      </select>
                      <span className="w-24 shrink-0 text-right text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
                        {fig ? fmtColones(fig.total) : "—"}
                      </span>
                      <button
                        type="button"
                        onClick={() => setProductLines((prev) => prev.filter((l) => l.clientId !== line.clientId))}
                        aria-label={t("log.removeLine")}
                        className="shrink-0 rounded-lg p-1.5 text-zinc-400 hover:text-red-600 dark:hover:text-red-400"
                      >
                        <X size={16} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        {lineCount > 0 && (
          <div className="flex flex-col gap-1 border-t border-zinc-200 pt-4 text-sm dark:border-zinc-800">
            {lines.length > 0 && productLines.length > 0 && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">{t("log.servicesSubtotal")}</span>
                  <span className="tabular-nums text-zinc-700 dark:text-zinc-300">{fmtColones(cartTotal)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">{t("log.productsSubtotal")}</span>
                  <span className="tabular-nums text-zinc-700 dark:text-zinc-300">{fmtColones(productsTotal)}</span>
                </div>
              </>
            )}
            {productsIva > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">{t("log.productsIvaIncluded")}</span>
                <span className="tabular-nums text-zinc-700 dark:text-zinc-300">{fmtColones(productsIva)}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-zinc-500">{t("log.totalToCharge")}</span>
              <span className="text-base font-semibold tabular-nums text-black dark:text-white">{fmtColones(ticketTotal)}</span>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() =>
                  setSplitRows((rows) =>
                    rows
                      ? null
                      : [
                          { key: crypto.randomUUID(), paymentMethodId, amount: String(ticketTotal) },
                          { key: crypto.randomUUID(), paymentMethodId: paymentMethods.find((m) => m.id !== paymentMethodId)?.id ?? paymentMethodId, amount: "" },
                        ]
                  )
                }
                className="text-xs text-zinc-600 underline decoration-dotted hover:text-black dark:text-zinc-300 dark:hover:text-white"
              >
                {splitRows ? t("splitPayment.cancel") : t("splitPayment.open")}
              </button>
            </div>
            {splitRows && (
              <SplitPayment
                total={ticketTotal}
                rows={splitRows}
                onChange={setSplitRows}
                methods={paymentMethods.map((m) => ({ id: m.id, name: m.name }))}
              />
            )}
            {lines.length > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">{t("log.cartEstimatedCommission")}</span>
                <span aria-live="polite" className="tabular-nums text-zinc-700 dark:text-zinc-300">
                  {previewCommission != null ? fmtColones(previewCommission) : "—"}
                </span>
              </div>
            )}
            {productsCommission > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">{t("log.productCommission")}</span>
                <span className="tabular-nums text-zinc-700 dark:text-zinc-300">{fmtColones(productsCommission)}</span>
              </div>
            )}
          </div>
        )}

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        {savedNote && !error && lineCount === 0 && (
          <p className="text-sm text-green-700 dark:text-green-400">{savedNote}</p>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={pending || barbers.length === 0 || paymentMethods.length === 0 || lineCount === 0}
            className="w-full rounded-lg bg-black px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200 sm:w-auto"
          >
            {pending ? tc("saving") : t("log.submitTicketButton", { count: lineCount })}
          </button>
        </div>
      </form>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-black dark:text-white">{t("log.todaySectionTitle")}</h2>
        <RecentActivityList
          activities={activities}
          barbers={barbers.map((b) => ({ id: b.id, name: `${b.firstName} ${b.lastName}` }))}
        />
      </div>
    </div>
  );
}

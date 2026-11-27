"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createCustomerSaleAction } from "../actions";
import { productSaleFigures } from "@/lib/barbers/product-commissions";
import { fmtColones } from "@/lib/barbers/currency";
import { unwrap } from "@/lib/barbers/errors";

type ProductOption = { id: string; name: string; price: number; commissionAmount: number; chargesIva: boolean };

/** Record a product sold to a customer; shows price, IVA, total and commission live. */
export default function CustomerSaleForm({
  products,
  barbers,
  paymentMethods,
  ivaRate,
  today,
  locations,
  locationRequired,
}: {
  products: ProductOption[];
  barbers: { id: string; name: string }[];
  paymentMethods: { id: string; name: string }[];
  ivaRate: number;
  today: string;
  /** Where it can be sold (only this person's allowed locations). */
  locations: { id: string; name: string }[];
  /** The person is limited to some locations, so "no location" isn't offered. */
  locationRequired: boolean;
}) {
  const t = useTranslations("barbers.productClosing");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [quantity, setQuantity] = useState("1");
  const [barberId, setBarberId] = useState("");
  const [paymentMethodId, setPaymentMethodId] = useState(paymentMethods[0]?.id ?? "");
  const [saleDate, setSaleDate] = useState(today);
  const [locationId, setLocationId] = useState(locationRequired ? (locations[0]?.id ?? "") : "");

  // Default to the location chosen at the front desk (Registro remembers it).
  useEffect(() => {
    try {
      const remembered = localStorage.getItem("barbers.selectedLocationId");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (remembered && locations.some((l) => l.id === remembered)) setLocationId(remembered);
    } catch {
      // localStorage unavailable: keep the default.
    }
  }, [locations]);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const product = products.find((p) => p.id === productId);
  const qty = Math.max(0, Math.floor(Number(quantity) || 0));
  const figures = useMemo(
    () =>
      product && qty > 0
        ? productSaleFigures({
            unitPrice: product.price,
            quantity: qty,
            chargesIva: product.chargesIva,
            ivaRate,
            commissionPerUnit: barberId ? product.commissionAmount : 0,
          })
        : null,
    [product, qty, ivaRate, barberId]
  );

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    if (!product || qty < 1) {
      setError(t("errorQuantity"));
      return;
    }
    startTransition(async () => {
      try {
        await unwrap(createCustomerSaleAction({
          productId,
          quantity: qty,
          barberId: barberId || null,
          paymentMethodId: paymentMethodId || null,
          saleDate,
          locationId: locationId || null,
        }));
        setSaved(true);
        setQuantity("1");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : t("errorGeneric"));
      }
    });
  }

  if (products.length === 0) {
    return <p className="rounded-xl border border-zinc-200 p-4 text-sm text-zinc-500 dark:border-zinc-800">{t("noProducts")}</p>;
  }

  const input =
    "w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-black outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white";
  const label = "flex flex-col gap-1 text-xs text-zinc-500";

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <label className={`${label} lg:col-span-2`}>
          {t("product")}
          <select id="saleProduct" value={productId} onChange={(e) => setProductId(e.target.value)} className={input}>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {fmtColones(p.price)}
                {p.chargesIva ? ` + ${t("iva")}` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className={label}>
          {t("quantity")}
          <input id="saleQty" type="number" min="1" step="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} className={input} />
        </label>
        <label className={label}>
          {t("collaborator")}
          <select id="saleBarber" value={barberId} onChange={(e) => setBarberId(e.target.value)} className={input}>
            <option value="">{t("noCommission")}</option>
            {barbers.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </label>
        <label className={label}>
          {t("paymentMethod")}
          <select id="saleMethod" value={paymentMethodId} onChange={(e) => setPaymentMethodId(e.target.value)} className={input}>
            {paymentMethods.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </label>
        <label className={label}>
          {t("location")}
          <select id="saleLocation" value={locationId} onChange={(e) => setLocationId(e.target.value)} className={input}>
            {!locationRequired && <option value="">{t("noLocation")}</option>}
            {locations.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </label>
        <label className={label}>
          {t("date")}
          <input id="saleDate" type="date" required value={saleDate} onChange={(e) => setSaleDate(e.target.value)} className={input} />
        </label>
      </div>

      {figures && (
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1 rounded-xl bg-zinc-50 p-3 text-sm dark:bg-zinc-900 sm:grid-cols-4">
          <div><dt className="text-xs text-zinc-500">{t("price")}</dt><dd className="tabular-nums">{fmtColones(figures.subtotal)}</dd></div>
          <div><dt className="text-xs text-zinc-500">{t("iva")}</dt><dd className="tabular-nums">{fmtColones(figures.ivaAmount)}</dd></div>
          <div><dt className="text-xs text-zinc-500">{t("customerPays")}</dt><dd className="font-semibold tabular-nums">{fmtColones(figures.total)}</dd></div>
          <div><dt className="text-xs text-zinc-500">{t("commission")}</dt><dd className="tabular-nums">{fmtColones(figures.commissionTotal)}</dd></div>
        </dl>
      )}

      <div className="flex items-center justify-end gap-3">
        {saved && <span className="text-sm text-green-700 dark:text-green-400">{t("saved")}</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          {t("record")}
        </button>
      </div>
    </form>
  );
}

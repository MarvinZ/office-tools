"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { createProductSaleAction } from "../actions";
import ProductSaleList from "./product-sale-list";
import { fmtColones } from "@/lib/barbers/currency";
import type { BarberRow } from "@/services/barbers/barbers";
import type { ProductRow } from "@/services/barbers/products";
import type { ProductSaleWithDetails } from "@/services/barbers/product-sales";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * "Today" as a UTC calendar day, matching the day-boundary convention used
 * everywhere else in this module (see startOfDayUtc/endOfDayUtc in
 * payout-report.ts) so a date means the same thing across tabs.
 */
function todayUtcDateString(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${pad2(now.getUTCMonth() + 1)}-${pad2(now.getUTCDate())}`;
}

export default function ProductSaleForm({
  barbers,
  products,
  initialSales,
}: {
  barbers: BarberRow[];
  products: ProductRow[];
  initialSales: ProductSaleWithDetails[];
}) {
  const t = useTranslations("barbers");
  const tc = useTranslations("common");
  const [pending, startTransition] = useTransition();
  const [sales, setSales] = useState(initialSales);
  const [error, setError] = useState<string | null>(null);

  const [barberId, setBarberId] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [saleDate, setSaleDate] = useState(todayUtcDateString());
  const [note, setNote] = useState("");

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === productId) ?? null,
    [products, productId]
  );

  /**
   * Display only. The server independently re-reads the product's price and
   * recomputes the authoritative total it stores — this preview is never sent
   * and never trusted, exactly like the commission preview on the activity
   * entry form.
   */
  const previewTotal = useMemo(() => {
    if (!selectedProduct) return null;
    const qty = parseInt(quantity, 10);
    if (!Number.isInteger(qty) || qty <= 0) return null;
    return Math.round(qty * parseFloat(selectedProduct.price) * 100) / 100;
  }, [selectedProduct, quantity]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!barberId) {
      setError(t("productSales.errorMissingBarber"));
      return;
    }
    if (!productId) {
      setError(t("productSales.errorMissingProduct"));
      return;
    }
    const parsedQuantity = parseInt(quantity, 10);
    if (!Number.isInteger(parsedQuantity) || parsedQuantity <= 0) {
      setError(t("productSales.errorInvalidQuantity"));
      return;
    }
    if (!saleDate) {
      setError(t("productSales.errorMissingDate"));
      return;
    }

    startTransition(async () => {
      try {
        const row = await createProductSaleAction({
          barberId,
          productId,
          quantity: parsedQuantity,
          saleDate,
          note: note.trim() || undefined,
        });

        const barber = barbers.find((b) => b.id === row.barberId);
        const product = products.find((p) => p.id === row.productId);
        setSales((prev) => [
          {
            ...row,
            barberName: barber ? `${barber.firstName} ${barber.lastName}` : "",
            productName: product?.name ?? "",
          },
          ...prev,
        ]);

        // The barber stays selected: the front desk usually logs several sales
        // for the same person in a row. Everything else resets.
        setProductId("");
        setQuantity("1");
        setSaleDate(todayUtcDateString());
        setNote("");
      } catch {
        setError(t("productSales.errorSubmitFailed"));
      }
    });
  }

  function handleDeleted(id: string) {
    setSales((prev) => prev.filter((s) => s.id !== id));
  }

  const inputCls = "w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:focus:ring-white";
  const labelCls = "block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1";
  const canSubmit = barbers.length > 0 && products.length > 0;

  return (
    <div className="flex flex-col gap-8">
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-5 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950 sm:p-6"
      >
        {barbers.length === 0 && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
            {t("productSales.noBarbers")}
          </p>
        )}
        {products.length === 0 && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
            {t("productSales.noProducts")}
          </p>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls}>{t("productSales.fieldBarber")} *</label>
            <select
              required
              disabled={barbers.length === 0}
              value={barberId}
              onChange={(e) => setBarberId(e.target.value)}
              className={inputCls}
            >
              <option value="">{t("productSales.selectPlaceholder")}</option>
              {barbers.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.firstName} {b.lastName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>{t("productSales.fieldProduct")} *</label>
            <select
              required
              disabled={products.length === 0}
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className={inputCls}
            >
              <option value="">{t("productSales.selectPlaceholder")}</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {fmtColones(parseFloat(p.price))}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>{t("productSales.fieldQuantity")} *</label>
            <input
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              required
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>{t("productSales.fieldSaleDate")} *</label>
            <input
              type="date"
              required
              value={saleDate}
              onChange={(e) => setSaleDate(e.target.value)}
              className={inputCls}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>{t("productSales.fieldNote")}</label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("productSales.fieldNotePlaceholder")}
              className={inputCls}
            />
          </div>
        </div>

        {previewTotal !== null && (
          <p className="text-sm text-zinc-500">
            {t("productSales.totalPreview")}{" "}
            <span className="font-semibold text-black dark:text-white">{fmtColones(previewTotal)}</span>
          </p>
        )}

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={pending || !canSubmit}
            className="w-full rounded-lg bg-black px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200 sm:w-auto"
          >
            {pending ? tc("saving") : t("productSales.submitButton")}
          </button>
        </div>
      </form>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-black dark:text-white">{t("productSales.listTitle")}</h2>
        <ProductSaleList sales={sales} barbers={barbers} onDeleted={handleDeleted} />
      </div>
    </div>
  );
}

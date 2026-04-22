"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Trash2 } from "lucide-react";
import type { QuoteUI, QuoteInput } from "@/services/quotes/quotes";

type LineItemDraft = {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
};

const CURRENCIES = ["USD", "CRC", "EUR"];
const TAX_RATES = [0, 0.04, 0.13];

function newItem(): LineItemDraft {
  return { id: `li_${Date.now()}`, description: "", quantity: 1, unitPrice: 0 };
}

function fmt(n: number) {
  return n.toFixed(2);
}

type ClientOption = { id: string; name: string; billingEmail: string };

export default function QuoteForm({
  initial,
  clients = [],
  onCancel,
  onSubmit,
}: {
  initial?: Partial<QuoteUI>;
  clients?: ClientOption[];
  onCancel: () => void;
  onSubmit: (data: QuoteInput) => void;
}) {
  const t = useTranslations("quotes");

  const [clientId, setClientId] = useState<string>(initial?.clientId ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [clientName, setClientName] = useState(initial?.clientName ?? "");
  const [clientEmail, setClientEmail] = useState(initial?.clientEmail ?? "");
  const [issueDate, setIssueDate] = useState(initial?.issueDate ?? new Date().toISOString().slice(0, 10));
  const [expiryDate, setExpiryDate] = useState(initial?.expiryDate ?? "");
  const [currency, setCurrency] = useState(initial?.currency ?? "USD");
  const [taxRate, setTaxRate] = useState(initial?.taxRate ?? 0.13);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [items, setItems] = useState<LineItemDraft[]>(
    initial?.lineItems?.map(({ id, description, quantity, unitPrice }) => ({ id, description, quantity, unitPrice })) ?? [newItem()]
  );

  function handleClientSelect(id: string) {
    setClientId(id);
    if (id) {
      const c = clients.find((c) => c.id === id);
      if (c) {
        setClientName(c.name);
        setClientEmail(c.billingEmail);
      }
    }
  }

  const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const taxAmount = Math.round(subtotal * taxRate * 100) / 100;
  const total = subtotal + taxAmount;

  function updateItem(id: string, field: keyof LineItemDraft, value: string | number) {
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, [field]: value } : i));
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      clientId: clientId || null,
      title,
      clientName,
      clientEmail,
      issueDate,
      expiryDate,
      currency,
      taxRate,
      subtotal,
      taxAmount,
      total,
      notes,
      lineItems: items.map((i) => ({
        description: i.description,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        subtotal: i.quantity * i.unitPrice,
      })),
    });
  }

  const inputCls = "w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:focus:ring-white";
  const labelCls = "block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 px-6 py-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {clients.length > 0 && (
          <div className="sm:col-span-2">
            <label className={labelCls}>{t("form.fieldClient")}</label>
            <select value={clientId} onChange={(e) => handleClientSelect(e.target.value)} className={inputCls}>
              <option value="">{t("form.fieldClientPlaceholder")}</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}
        <div className="sm:col-span-2">
          <label className={labelCls}>{t("form.fieldTitle")} *</label>
          <input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("form.fieldTitlePlaceholder")} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>{t("form.fieldClientName")} *</label>
          <input required value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder={t("form.fieldClientNamePlaceholder")} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>{t("form.fieldClientEmail")} *</label>
          <input required type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} placeholder="client@company.com" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>{t("form.fieldIssueDate")} *</label>
          <input required type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>{t("form.fieldExpiryDate")} *</label>
          <input required type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>{t("form.fieldCurrency")}</label>
          <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={inputCls}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>{t("form.fieldTaxRate")}</label>
          <select value={taxRate} onChange={(e) => setTaxRate(parseFloat(e.target.value))} className={inputCls}>
            {TAX_RATES.map((r) => <option key={r} value={r}>{r * 100}%</option>)}
          </select>
        </div>
      </div>

      {/* Line Items */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-black dark:text-white">{t("form.lineItemsTitle")}</p>
          <button type="button" onClick={() => setItems((p) => [...p, newItem()])} className="flex items-center gap-1 text-xs text-zinc-500 hover:text-black dark:hover:text-white">
            <Plus size={13} />
            {t("form.addLine")}
          </button>
        </div>

        <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
          <div className="grid grid-cols-[1fr_80px_100px_100px_32px] gap-2 border-b border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900">
            {[t("form.colDescription"), t("form.colQty"), t("form.colUnitPrice"), t("form.colSubtotal"), ""].map((h, i) => (
              <p key={i} className={`text-xs font-semibold uppercase tracking-wide text-zinc-500 ${i > 0 && i < 4 ? "text-right" : ""}`}>{h}</p>
            ))}
          </div>

          {items.map((item) => (
            <div key={item.id} className="grid grid-cols-[1fr_80px_100px_100px_32px] gap-2 border-b border-zinc-100 px-3 py-2 last:border-0 dark:border-zinc-800">
              <input
                value={item.description}
                onChange={(e) => updateItem(item.id, "description", e.target.value)}
                placeholder={t("form.descriptionPlaceholder")}
                className="rounded-md border border-transparent bg-transparent px-1 py-1 text-sm text-zinc-700 outline-none focus:border-zinc-300 focus:bg-white dark:text-zinc-300 dark:focus:bg-zinc-900"
              />
              <input
                type="number" min="1"
                value={item.quantity}
                onChange={(e) => updateItem(item.id, "quantity", parseInt(e.target.value) || 1)}
                className="rounded-md border border-transparent bg-transparent px-1 py-1 text-right text-sm tabular-nums text-zinc-700 outline-none focus:border-zinc-300 focus:bg-white dark:text-zinc-300 dark:focus:bg-zinc-900"
              />
              <input
                type="number" min="0" step="0.01"
                value={item.unitPrice}
                onChange={(e) => updateItem(item.id, "unitPrice", parseFloat(e.target.value) || 0)}
                className="rounded-md border border-transparent bg-transparent px-1 py-1 text-right text-sm tabular-nums text-zinc-700 outline-none focus:border-zinc-300 focus:bg-white dark:text-zinc-300 dark:focus:bg-zinc-900"
              />
              <p className="py-1 text-right text-sm tabular-nums text-zinc-500">{fmt(item.quantity * item.unitPrice)}</p>
              <button type="button" onClick={() => removeItem(item.id)} className="flex items-center justify-center text-zinc-300 hover:text-red-500 dark:text-zinc-700">
                <Trash2 size={14} />
              </button>
            </div>
          ))}

          <div className="border-t border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="ml-auto max-w-[250px] space-y-1">
              <div className="flex justify-between text-xs text-zinc-500">
                <span>{t("detail.subtotal")}</span>
                <span className="tabular-nums">{currency} {fmt(subtotal)}</span>
              </div>
              <div className="flex justify-between text-xs text-zinc-500">
                <span>{t("detail.tax", { rate: taxRate * 100 })}</span>
                <span className="tabular-nums">{currency} {fmt(taxAmount)}</span>
              </div>
              <div className="flex justify-between border-t border-zinc-200 pt-1 text-sm font-semibold text-black dark:border-zinc-700 dark:text-white">
                <span>{t("detail.total")}</span>
                <span className="tabular-nums">{currency} {fmt(total)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div>
        <label className={labelCls}>{t("form.fieldNotes")}</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder={t("form.fieldNotesPlaceholder")} className={inputCls} />
      </div>

      <div className="flex justify-end gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <button type="button" onClick={onCancel} className="rounded-lg border border-zinc-200 px-4 py-2 text-sm text-zinc-600 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-400">
          {t("form.cancel")}
        </button>
        <button type="submit" className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200">
          {initial?.id ? t("form.saveChanges") : t("form.createQuote")}
        </button>
      </div>
    </form>
  );
}

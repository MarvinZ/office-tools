"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { ClientInput } from "@/services/clients/clients";
import type { ClientStatus, PaymentTerms } from "../_mock/data";
import { INDUSTRIES, PAYMENT_TERMS_OPTIONS } from "../_mock/data";

const CURRENCIES = ["USD", "CRC", "EUR"];
const STATUSES: ClientStatus[] = ["active", "inactive", "prospect", "blocked"];

const today = () => new Date().toISOString().slice(0, 10);

export default function ClientForm({
  initial,
  onCancel,
  onSubmit,
}: {
  initial?: Partial<ClientInput> & { id?: string };
  onCancel: () => void;
  onSubmit: (data: ClientInput) => void | Promise<void>;
}) {
  const t = useTranslations("clients");

  const [name, setName] = useState(initial?.name ?? "");
  const [legalName, setLegalName] = useState(initial?.legalName ?? "");
  const [taxId, setTaxId] = useState(initial?.taxId ?? "");
  const [industry, setIndustry] = useState(initial?.industry ?? INDUSTRIES[0]);
  const [status, setStatus] = useState<ClientStatus>((initial?.status as ClientStatus) ?? "prospect");
  const [website, setWebsite] = useState(initial?.website ?? "");
  const [paymentTerms, setPaymentTerms] = useState<PaymentTerms>((initial?.paymentTerms as PaymentTerms) ?? "net_30");
  const [currency, setCurrency] = useState(initial?.currency ?? "USD");
  const [creditLimit, setCreditLimit] = useState(initial?.creditLimit?.toString() ?? "");
  const [billingEmail, setBillingEmail] = useState(initial?.billingEmail ?? "");
  const [clientSince, setClientSince] = useState(initial?.clientSince ?? today());
  const [addressStreet, setAddressStreet] = useState(initial?.addressStreet ?? "");
  const [addressCity, setAddressCity] = useState(initial?.addressCity ?? "");
  const [addressState, setAddressState] = useState(initial?.addressState ?? "");
  const [addressZip, setAddressZip] = useState(initial?.addressZip ?? "");
  const [addressCountry, setAddressCountry] = useState(initial?.addressCountry ?? "");
  const [tagsRaw, setTagsRaw] = useState(initial?.tags?.join(", ") ?? "");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      name, legalName, taxId, industry, status, website: website || undefined,
      paymentTerms, currency, creditLimit: creditLimit ? parseFloat(creditLimit) : undefined,
      billingEmail, clientSince,
      addressStreet: addressStreet || undefined,
      addressCity: addressCity || undefined,
      addressState: addressState || undefined,
      addressZip: addressZip || undefined,
      addressCountry: addressCountry || undefined,
      tags: tagsRaw.split(",").map((t) => t.trim()).filter(Boolean),
    });
  }

  const inputCls = "w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:focus:ring-white";
  const labelCls = "block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1";
  const sectionCls = "text-xs font-semibold uppercase tracking-wide text-zinc-400 pt-2";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 overflow-y-auto px-6 py-5" style={{ maxHeight: "75vh" }}>

      {/* Company */}
      <p className={sectionCls}>{t("form.sectionCompany")}</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={labelCls}>{t("form.fieldName")} *</label>
          <input required value={name} onChange={(e) => setName(e.target.value)} placeholder={t("form.fieldNamePlaceholder")} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>{t("form.fieldLegalName")} *</label>
          <input required value={legalName} onChange={(e) => setLegalName(e.target.value)} placeholder={t("form.fieldLegalNamePlaceholder")} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>{t("form.fieldTaxId")} *</label>
          <input required value={taxId} onChange={(e) => setTaxId(e.target.value)} placeholder={t("form.fieldTaxIdPlaceholder")} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>{t("form.fieldIndustry")}</label>
          <select value={industry} onChange={(e) => setIndustry(e.target.value)} className={inputCls}>
            {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>{t("form.fieldStatus")}</label>
          <select value={status} onChange={(e) => setStatus(e.target.value as ClientStatus)} className={inputCls}>
            {STATUSES.map((s) => <option key={s} value={s}>{t(`status.${s}`)}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>{t("form.fieldClientSince")}</label>
          <input type="date" value={clientSince} onChange={(e) => setClientSince(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>{t("form.fieldWebsite")}</label>
          <input type="url" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://company.com" className={inputCls} />
        </div>
      </div>

      {/* Financial */}
      <p className={sectionCls}>{t("form.sectionFinancial")}</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls}>{t("form.fieldPaymentTerms")}</label>
          <select value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value as PaymentTerms)} className={inputCls}>
            {PAYMENT_TERMS_OPTIONS.map((p) => <option key={p} value={p}>{t(`paymentTerms.${p}`)}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>{t("form.fieldCurrency")}</label>
          <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={inputCls}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>{t("form.fieldCreditLimit")}</label>
          <input type="number" min="0" step="100" value={creditLimit} onChange={(e) => setCreditLimit(e.target.value)} placeholder="0" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>{t("form.fieldBillingEmail")} *</label>
          <input required type="email" value={billingEmail} onChange={(e) => setBillingEmail(e.target.value)} placeholder="billing@company.com" className={inputCls} />
        </div>
      </div>

      {/* Address */}
      <p className={sectionCls}>{t("form.sectionAddress")}</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={labelCls}>{t("form.fieldStreet")}</label>
          <input value={addressStreet} onChange={(e) => setAddressStreet(e.target.value)} placeholder={t("form.fieldStreetPlaceholder")} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>{t("form.fieldCity")}</label>
          <input value={addressCity} onChange={(e) => setAddressCity(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>{t("form.fieldState")}</label>
          <input value={addressState} onChange={(e) => setAddressState(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>{t("form.fieldZip")}</label>
          <input value={addressZip} onChange={(e) => setAddressZip(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>{t("form.fieldCountry")}</label>
          <input value={addressCountry} onChange={(e) => setAddressCountry(e.target.value)} className={inputCls} />
        </div>
      </div>

      {/* Tags */}
      <div>
        <label className={labelCls}>{t("form.fieldTags")}</label>
        <input value={tagsRaw} onChange={(e) => setTagsRaw(e.target.value)} placeholder={t("form.fieldTagsPlaceholder")} className={inputCls} />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <button type="button" onClick={onCancel} className="rounded-lg border border-zinc-200 px-4 py-2 text-sm text-zinc-600 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-400">
          {t("form.cancel")}
        </button>
        <button type="submit" className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200">
          {initial?.id ? t("form.saveChanges") : t("form.createClient")}
        </button>
      </div>
    </form>
  );
}

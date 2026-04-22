"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { ProviderInput } from "@/services/providers/providers";
import type { ProviderStatus, PaymentTerms } from "../_mock/data";
import { PROVIDER_CATEGORIES, PAYMENT_TERMS_OPTIONS } from "../_mock/data";

const CURRENCIES = ["USD", "CRC", "EUR"];
const STATUSES: ProviderStatus[] = ["active", "inactive", "blocked"];

const today = () => new Date().toISOString().slice(0, 10);

export default function ProviderForm({
  initial,
  onCancel,
  onSubmit,
}: {
  initial?: Partial<ProviderInput> & { id?: string };
  onCancel: () => void;
  onSubmit: (data: ProviderInput) => void | Promise<void>;
}) {
  const t = useTranslations("providers");

  const [name, setName] = useState(initial?.name ?? "");
  const [legalName, setLegalName] = useState(initial?.legalName ?? "");
  const [taxId, setTaxId] = useState(initial?.taxId ?? "");
  const [category, setCategory] = useState(initial?.category ?? PROVIDER_CATEGORIES[0]);
  const [status, setStatus] = useState<ProviderStatus>((initial?.status as ProviderStatus) ?? "active");
  const [website, setWebsite] = useState(initial?.website ?? "");
  const [rating, setRating] = useState(initial?.rating ?? 3);
  const [paymentTerms, setPaymentTerms] = useState<PaymentTerms>((initial?.paymentTerms as PaymentTerms) ?? "net_30");
  const [currency, setCurrency] = useState(initial?.currency ?? "USD");
  const [bankName, setBankName] = useState(initial?.bankName ?? "");
  const [bankAccount, setBankAccount] = useState(initial?.bankAccount ?? "");
  const [bankIban, setBankIban] = useState(initial?.bankIban ?? "");
  const [bankSwift, setBankSwift] = useState(initial?.bankSwift ?? "");
  const [productsServices, setProductsServices] = useState(initial?.productsServices ?? "");
  const [leadTimeDays, setLeadTimeDays] = useState(initial?.leadTimeDays?.toString() ?? "");
  const [minimumOrderAmount, setMinimumOrderAmount] = useState(initial?.minimumOrderAmount?.toString() ?? "");
  const [contractExpiry, setContractExpiry] = useState(initial?.contractExpiry ?? "");
  const [partnerSince, setPartnerSince] = useState(initial?.partnerSince ?? today());
  const [addressStreet, setAddressStreet] = useState(initial?.addressStreet ?? "");
  const [addressCity, setAddressCity] = useState(initial?.addressCity ?? "");
  const [addressState, setAddressState] = useState(initial?.addressState ?? "");
  const [addressZip, setAddressZip] = useState(initial?.addressZip ?? "");
  const [addressCountry, setAddressCountry] = useState(initial?.addressCountry ?? "");
  const [tagsRaw, setTagsRaw] = useState(initial?.tags?.join(", ") ?? "");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      name, legalName, taxId: taxId || undefined, category, status,
      website: website || undefined, rating,
      paymentTerms, currency,
      bankName: bankName || undefined, bankAccount: bankAccount || undefined,
      bankIban: bankIban || undefined, bankSwift: bankSwift || undefined,
      productsServices,
      leadTimeDays: leadTimeDays ? parseInt(leadTimeDays) : undefined,
      minimumOrderAmount: minimumOrderAmount ? parseFloat(minimumOrderAmount) : undefined,
      contractExpiry: contractExpiry || undefined,
      partnerSince,
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
          <label className={labelCls}>{t("form.fieldTaxId")}</label>
          <input value={taxId} onChange={(e) => setTaxId(e.target.value)} placeholder={t("form.fieldTaxIdPlaceholder")} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>{t("form.fieldCategory")}</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
            {PROVIDER_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>{t("form.fieldStatus")}</label>
          <select value={status} onChange={(e) => setStatus(e.target.value as ProviderStatus)} className={inputCls}>
            {STATUSES.map((s) => <option key={s} value={s}>{t(`status.${s}`)}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>{t("form.fieldPartnerSince")}</label>
          <input type="date" value={partnerSince} onChange={(e) => setPartnerSince(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>{t("form.fieldWebsite")}</label>
          <input type="url" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://company.com" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>{t("form.fieldRating")}</label>
          <div className="flex items-center gap-2 py-1">
            {[1,2,3,4,5].map((i) => (
              <button key={i} type="button" onClick={() => setRating(i)} className={`text-2xl transition-colors ${i <= rating ? "text-amber-400" : "text-zinc-200 hover:text-amber-200 dark:text-zinc-700"}`}>★</button>
            ))}
            <span className="ml-1 text-sm text-zinc-400">{rating}/5</span>
          </div>
        </div>
      </div>

      {/* Supply */}
      <p className={sectionCls}>{t("form.sectionSupply")}</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={labelCls}>{t("form.fieldProducts")} *</label>
          <textarea required rows={2} value={productsServices} onChange={(e) => setProductsServices(e.target.value)} placeholder={t("form.fieldProductsPlaceholder")} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>{t("form.fieldLeadTime")}</label>
          <input type="number" min="0" value={leadTimeDays} onChange={(e) => setLeadTimeDays(e.target.value)} placeholder="0" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>{t("form.fieldMinOrder")}</label>
          <input type="number" min="0" step="10" value={minimumOrderAmount} onChange={(e) => setMinimumOrderAmount(e.target.value)} placeholder="0" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>{t("form.fieldContractExpiry")}</label>
          <input type="date" value={contractExpiry} onChange={(e) => setContractExpiry(e.target.value)} className={inputCls} />
        </div>
      </div>

      {/* Payment */}
      <p className={sectionCls}>{t("form.sectionPayment")}</p>
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
          <label className={labelCls}>{t("form.fieldBankName")}</label>
          <input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder={t("form.fieldBankNamePlaceholder")} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>{t("form.fieldBankAccount")}</label>
          <input value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>{t("form.fieldBankIban")}</label>
          <input value={bankIban} onChange={(e) => setBankIban(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>{t("form.fieldBankSwift")}</label>
          <input value={bankSwift} onChange={(e) => setBankSwift(e.target.value)} className={inputCls} />
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
          {initial?.id ? t("form.saveChanges") : t("form.createProvider")}
        </button>
      </div>
    </form>
  );
}

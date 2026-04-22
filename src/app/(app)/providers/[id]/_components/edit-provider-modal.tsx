"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Pencil } from "lucide-react";
import type { ProviderWithRelations, ProviderInput } from "@/services/providers/providers";
import ProviderForm from "../../_components/provider-form";
import { updateProviderAction } from "../actions";

export default function EditProviderModal({ provider }: { provider: ProviderWithRelations }) {
  const t = useTranslations("providers");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();

  const initialData: Partial<ProviderInput> & { id: string } = {
    id: provider.id,
    name: provider.name,
    legalName: provider.legalName,
    taxId: provider.taxId ?? undefined,
    category: provider.category,
    status: provider.status,
    website: provider.website ?? undefined,
    rating: provider.rating,
    paymentTerms: provider.paymentTerms,
    currency: provider.currency,
    bankName: provider.bankName ?? undefined,
    bankAccount: provider.bankAccount ?? undefined,
    bankIban: provider.bankIban ?? undefined,
    bankSwift: provider.bankSwift ?? undefined,
    productsServices: provider.productsServices,
    leadTimeDays: provider.leadTimeDays ?? undefined,
    minimumOrderAmount: provider.minimumOrderAmount ? parseFloat(provider.minimumOrderAmount) : undefined,
    contractExpiry: provider.contractExpiry
      ? (provider.contractExpiry instanceof Date ? provider.contractExpiry.toISOString().slice(0, 10) : provider.contractExpiry)
      : undefined,
    partnerSince: provider.partnerSince instanceof Date
      ? provider.partnerSince.toISOString().slice(0, 10)
      : provider.partnerSince,
    addressStreet: provider.addressStreet ?? undefined,
    addressCity: provider.addressCity ?? undefined,
    addressState: provider.addressState ?? undefined,
    addressZip: provider.addressZip ?? undefined,
    addressCountry: provider.addressCountry ?? undefined,
    tags: provider.tags,
  };

  function handleSubmit(data: ProviderInput) {
    startTransition(async () => {
      await updateProviderAction(provider.id, data);
      router.refresh();
      setOpen(false);
    });
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:border-zinc-400 hover:text-black dark:border-zinc-700 dark:text-zinc-400 dark:hover:text-white">
        <Pencil size={14} />
        {t("detail.edit")}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-10 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-950">
            <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
              <h2 className="text-lg font-semibold text-black dark:text-white">{t("form.editTitle")}</h2>
              <button onClick={() => setOpen(false)} className="text-zinc-400 hover:text-black dark:hover:text-white">✕</button>
            </div>
            <ProviderForm initial={initialData} onCancel={() => setOpen(false)} onSubmit={handleSubmit} />
          </div>
        </div>
      )}
    </>
  );
}

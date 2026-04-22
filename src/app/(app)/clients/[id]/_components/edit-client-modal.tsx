"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Pencil } from "lucide-react";
import type { ClientWithRelations, ClientInput } from "@/services/clients/clients";
import ClientForm from "../../_components/client-form";
import { updateClientAction } from "../actions";

export default function EditClientModal({ client }: { client: ClientWithRelations }) {
  const t = useTranslations("clients");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();

  const initialData: Partial<ClientInput> & { id: string } = {
    id: client.id,
    name: client.name,
    legalName: client.legalName,
    taxId: client.taxId,
    industry: client.industry,
    status: client.status,
    website: client.website ?? undefined,
    paymentTerms: client.paymentTerms,
    currency: client.currency,
    creditLimit: client.creditLimit ? parseFloat(client.creditLimit) : undefined,
    billingEmail: client.billingEmail,
    clientSince: client.clientSince instanceof Date
      ? client.clientSince.toISOString().slice(0, 10)
      : client.clientSince,
    addressStreet: client.addressStreet ?? undefined,
    addressCity: client.addressCity ?? undefined,
    addressState: client.addressState ?? undefined,
    addressZip: client.addressZip ?? undefined,
    addressCountry: client.addressCountry ?? undefined,
    tags: client.tags,
  };

  function handleSubmit(data: ClientInput) {
    startTransition(async () => {
      await updateClientAction(client.id, data);
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
            <ClientForm initial={initialData} onCancel={() => setOpen(false)} onSubmit={handleSubmit} />
          </div>
        </div>
      )}
    </>
  );
}

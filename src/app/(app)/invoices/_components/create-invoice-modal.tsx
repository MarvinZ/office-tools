"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { createInvoiceAction } from "../actions";
import InvoiceForm from "./invoice-form";
import type { InvoiceInput } from "@/services/invoices/invoices";

type ClientOption = { id: string; name: string; billingEmail: string };

export default function CreateInvoiceModal({ clients = [] }: { clients?: ClientOption[] }) {
  const t = useTranslations("invoices");
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(data: InvoiceInput) {
    startTransition(async () => {
      await createInvoiceAction(data);
      // redirect happens inside the action
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
      >
        {t("page.addButton")}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-10 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-950">
            <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
              <h2 className="text-lg font-semibold text-black dark:text-white">{t("form.addTitle")}</h2>
              <button onClick={() => setOpen(false)} disabled={isPending} className="text-zinc-400 hover:text-black dark:hover:text-white disabled:opacity-50">✕</button>
            </div>
            <InvoiceForm
              clients={clients}
              onCancel={() => setOpen(false)}
              onSubmit={handleSubmit}
            />
            {isPending && (
              <div className="flex items-center justify-center py-4">
                <p className="text-sm text-zinc-400">Saving...</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

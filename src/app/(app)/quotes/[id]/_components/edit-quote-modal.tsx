"use client";

import { useTranslations } from "next-intl";
import type { QuoteUI, QuoteInput } from "@/services/quotes/quotes";
import QuoteForm from "../../_components/quote-form";

type ClientOption = { id: string; name: string; billingEmail: string };

export default function EditQuoteModal({
  quote,
  clients = [],
  isPending,
  onClose,
  onSave,
}: {
  quote: QuoteUI;
  clients?: ClientOption[];
  isPending: boolean;
  onClose: () => void;
  onSave: (data: QuoteInput) => void;
}) {
  const t = useTranslations("quotes");

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-10 backdrop-blur-sm">
      <div className="w-full max-w-3xl rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-950">
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <h2 className="text-lg font-semibold text-black dark:text-white">{t("form.editTitle")}</h2>
          <button onClick={onClose} disabled={isPending} className="text-zinc-400 hover:text-black dark:hover:text-white disabled:opacity-50">✕</button>
        </div>
        <QuoteForm
          initial={quote}
          clients={clients}
          onCancel={onClose}
          onSubmit={onSave}
        />
      </div>
    </div>
  );
}

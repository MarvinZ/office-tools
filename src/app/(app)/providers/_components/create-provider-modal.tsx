"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import ProviderForm from "./provider-form";
import { createProviderAction } from "../actions";
import type { ProviderInput } from "@/services/providers/providers";

export default function CreateProviderModal() {
  const t = useTranslations("providers");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();

  function handleSubmit(data: ProviderInput) {
    startTransition(async () => {
      await createProviderAction(data);
      router.refresh();
      setOpen(false);
    });
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200">
        {t("page.addButton")}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-10 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-950">
            <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
              <h2 className="text-lg font-semibold text-black dark:text-white">{t("form.addTitle")}</h2>
              <button onClick={() => setOpen(false)} className="text-zinc-400 hover:text-black dark:hover:text-white">✕</button>
            </div>
            <ProviderForm onCancel={() => setOpen(false)} onSubmit={handleSubmit} />
          </div>
        </div>
      )}
    </>
  );
}

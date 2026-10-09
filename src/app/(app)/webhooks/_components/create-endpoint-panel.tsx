"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createWebhookEndpointAction } from "../actions";

export default function CreateEndpointPanel() {
  const t = useTranslations("webhooks");
  const router = useRouter();
  const [name, setName] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleCreate() {
    if (!name.trim()) return;
    startTransition(async () => {
      await createWebhookEndpointAction(name.trim());
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
      <div>
        <h2 className="text-lg font-semibold text-black dark:text-white">{t("create.title")}</h2>
        <p className="mt-1 text-sm text-zinc-500">{t("create.subtitle")}</p>
      </div>
      <div className="flex gap-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("create.namePlaceholder")}
          className="flex-1 rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm text-black dark:border-zinc-700 dark:text-white"
        />
        <button
          onClick={handleCreate}
          disabled={isPending || !name.trim()}
          className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          {t("create.button")}
        </button>
      </div>
    </div>
  );
}

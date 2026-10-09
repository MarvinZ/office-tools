"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { deleteWebhookEventDetailAction } from "../actions";

export default function DeleteEventButton({ id }: { id: string }) {
  const t = useTranslations("webhooks");
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm(t("detail.deleteConfirm"))) return;
    startTransition(() => {
      deleteWebhookEventDetailAction(id);
    });
  }

  return (
    <button
      onClick={handleDelete}
      disabled={isPending}
      className="shrink-0 rounded-lg border border-red-300 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
    >
      {t("detail.delete")}
    </button>
  );
}

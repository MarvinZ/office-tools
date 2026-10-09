"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  regenerateWebhookSecretAction,
  renameWebhookEndpointAction,
  setWebhookEndpointActiveAction,
} from "../actions";
import type { WebhookEndpointRow } from "@/services/webhooks/webhooks";

export default function EndpointPanel({ endpoint }: { endpoint: WebhookEndpointRow }) {
  const t = useTranslations("webhooks");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(endpoint.name);
  const [showSecret, setShowSecret] = useState(false);
  const [copied, setCopied] = useState<"url" | "secret" | null>(null);

  const ingestUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/api/webhooks/ingest/${endpoint.id}`;

  function copy(value: string, which: "url" | "secret") {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(which);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  function saveName() {
    if (!name.trim() || name === endpoint.name) {
      setEditingName(false);
      return;
    }
    startTransition(async () => {
      await renameWebhookEndpointAction(endpoint.id, name.trim());
      router.refresh();
      setEditingName(false);
    });
  }

  function regenerate() {
    if (!confirm(t("endpoint.regenerateConfirm"))) return;
    startTransition(async () => {
      await regenerateWebhookSecretAction(endpoint.id);
      router.refresh();
    });
  }

  function toggleActive() {
    startTransition(async () => {
      await setWebhookEndpointActiveAction(endpoint.id, !endpoint.isActive);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          {editingName ? (
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={saveName}
              onKeyDown={(e) => e.key === "Enter" && saveName()}
              className="rounded-lg border border-zinc-300 bg-transparent px-2 py-1 text-lg font-semibold text-black dark:border-zinc-700 dark:text-white"
            />
          ) : (
            <h2
              onClick={() => setEditingName(true)}
              className="cursor-pointer text-lg font-semibold text-black hover:underline dark:text-white"
            >
              {endpoint.name}
            </h2>
          )}
          <span
            className={`h-2 w-2 rounded-full ${endpoint.isActive ? "bg-emerald-500" : "bg-zinc-400"}`}
            title={endpoint.isActive ? t("endpoint.active") : t("endpoint.inactive")}
          />
        </div>
        <button
          onClick={toggleActive}
          disabled={isPending}
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          {endpoint.isActive ? t("endpoint.deactivate") : t("endpoint.activate")}
        </button>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-zinc-500">{t("endpoint.urlLabel")}</label>
        <div className="flex gap-2">
          <code className="flex-1 overflow-x-auto rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-xs text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-white">
            {ingestUrl}
          </code>
          <button
            onClick={() => copy(ingestUrl, "url")}
            className="shrink-0 rounded-lg border border-zinc-300 px-3 py-2 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            {copied === "url" ? t("endpoint.copied") : t("endpoint.copy")}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-zinc-500">{t("endpoint.secretLabel")}</label>
        <div className="flex gap-2">
          <code className="flex-1 overflow-x-auto rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-xs text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-white">
            {showSecret ? endpoint.signingSecret : "•".repeat(32)}
          </code>
          <button
            onClick={() => setShowSecret((s) => !s)}
            className="shrink-0 rounded-lg border border-zinc-300 px-3 py-2 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            {showSecret ? t("endpoint.hide") : t("endpoint.reveal")}
          </button>
          <button
            onClick={() => copy(endpoint.signingSecret, "secret")}
            className="shrink-0 rounded-lg border border-zinc-300 px-3 py-2 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            {copied === "secret" ? t("endpoint.copied") : t("endpoint.copy")}
          </button>
          <button
            onClick={regenerate}
            disabled={isPending}
            className="shrink-0 rounded-lg border border-red-300 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
          >
            {t("endpoint.regenerate")}
          </button>
        </div>
      </div>

      <p className="text-xs text-zinc-500">{t("endpoint.hmacHint")}</p>
    </div>
  );
}

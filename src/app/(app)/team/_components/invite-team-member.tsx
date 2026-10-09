"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { inviteTeamMemberAction } from "../actions";

export default function InviteTeamMember() {
  const t = useTranslations("team");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleInvite() {
    setError(null);
    startTransition(async () => {
      const result = await inviteTeamMemberAction(email);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setEmail("");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="text-sm font-semibold text-black dark:text-white">{t("invite.title")}</h2>
      <div className="flex gap-2">
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleInvite()}
          type="email"
          placeholder={t("invite.placeholder")}
          className="flex-1 rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm text-black dark:border-zinc-700 dark:text-white"
        />
        <button
          onClick={handleInvite}
          disabled={isPending || !email.trim()}
          className="shrink-0 rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          {t("invite.button")}
        </button>
      </div>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

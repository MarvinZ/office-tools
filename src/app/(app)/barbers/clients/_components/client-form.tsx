"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { unwrap } from "@/lib/barbers/errors";
import type { ClientInput } from "@/lib/barbers/clients";
import { createClientAction, updateClientAction } from "../actions";

/** Create a client record, or edit one. Missing phone / birth date are highlighted (§13). */
export default function ClientForm({
  initial,
  missing = [],
  today,
}: {
  initial?: ClientInput & { id: string };
  missing?: ("phone" | "birthDate")[];
  today: string;
}) {
  const t = useTranslations("barbers.clients");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [v, setV] = useState({
    fullName: initial?.fullName ?? "",
    phone: initial?.phone ?? "",
    email: initial?.email ?? "",
    birthDate: initial?.birthDate ?? "",
    notes: initial?.notes ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const input: ClientInput = { ...v, birthDate: v.birthDate || null };
    startTransition(async () => {
      try {
        if (initial) await unwrap(updateClientAction(initial.id, input));
        else {
          const row = await unwrap(createClientAction(input));
          setV({ fullName: "", phone: "", email: "", birthDate: "", notes: "" });
          router.push(`/barbers/clients/${row.id}`);
          return;
        }
        setSaved(true);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  const input =
    "w-full rounded-lg border bg-white px-3 py-2 text-sm text-black outline-none focus:ring-2 focus:ring-black dark:bg-zinc-900 dark:text-white dark:focus:ring-white";
  const border = (field: "phone" | "birthDate" | null) =>
    field && missing.includes(field) ? "border-amber-400 dark:border-amber-600" : "border-zinc-200 dark:border-zinc-700";
  const label = "flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400";

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className={label}>
          {t("fullName")} *
          <input required value={v.fullName} onChange={(e) => setV({ ...v, fullName: e.target.value })} className={`${input} ${border(null)}`} />
        </label>
        <label className={label}>
          {t("phone")}
          <input type="tel" value={v.phone ?? ""} onChange={(e) => setV({ ...v, phone: e.target.value })} className={`${input} ${border("phone")}`} />
        </label>
        <label className={label}>
          {t("birthDate")}
          <input type="date" max={today} value={v.birthDate ?? ""} onChange={(e) => setV({ ...v, birthDate: e.target.value })} className={`${input} ${border("birthDate")}`} />
        </label>
        <label className={label}>
          {t("email")}
          <input type="email" value={v.email ?? ""} onChange={(e) => setV({ ...v, email: e.target.value })} className={`${input} ${border(null)}`} />
        </label>
        <label className={`${label} sm:col-span-2 lg:col-span-4`}>
          {t("notes")}
          <input value={v.notes ?? ""} onChange={(e) => setV({ ...v, notes: e.target.value })} className={`${input} ${border(null)}`} />
        </label>
      </div>
      <div className="flex items-center justify-end gap-3">
        {saved && <span className="text-sm text-green-700 dark:text-green-400">{t("saved")}</span>}
        {error && <span className="text-sm text-red-600 dark:text-red-400">{error}</span>}
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          {initial ? t("saveChanges") : t("create")}
        </button>
      </div>
    </form>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { setMemberRoleAction } from "../actions";
import type { BarbersMember } from "@/services/barbers/roles";
import type { BarbersRole } from "@/lib/barbers/permissions";
import { unwrap } from "@/lib/barbers/errors";

const ROLES: BarbersRole[] = ["admin", "cashier", "accountant"];

/** Admins give each person in the organization a Barbers role. */
export default function MemberRoles({ members, me }: { members: BarbersMember[]; me: string }) {
  const t = useTranslations("barbers.roles");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function change(userId: string, role: BarbersRole) {
    setError(null);
    startTransition(async () => {
      try {
        await unwrap(setMemberRoleAction(userId, role));
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : t("errorGeneric"));
      }
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950 sm:p-6">
      <div>
        <h2 className="text-sm font-semibold text-black dark:text-white">{t("title")}</h2>
        <p className="mt-1 text-xs text-zinc-500">{t("subtitle")}</p>
      </div>
      <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {members.map((m) => (
          <li key={m.userId} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-black dark:text-white">{m.name}</p>
              <p className="truncate text-xs text-zinc-500">{m.email}</p>
            </div>
            {m.userId === me ? (
              <span className="text-xs text-zinc-500">{t(`role.${m.role}`)} · {t("you")}</span>
            ) : (
              <select
                aria-label={t("roleFor", { name: m.name })}
                value={m.role}
                disabled={pending}
                onChange={(e) => change(m.userId, e.target.value as BarbersRole)}
                className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>{t(`role.${r}`)}</option>
                ))}
              </select>
            )}
          </li>
        ))}
      </ul>
      <dl className="grid gap-1 text-xs text-zinc-500 sm:grid-cols-3">
        {ROLES.map((r) => (
          <div key={r}>
            <dt className="font-medium text-zinc-700 dark:text-zinc-300">{t(`role.${r}`)}</dt>
            <dd>{t(`describe.${r}`)}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-zinc-500">
        {t("inviteHint")}{" "}
        <a href="/team" className="underline hover:text-black dark:hover:text-white">{t("teamLink")}</a>
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

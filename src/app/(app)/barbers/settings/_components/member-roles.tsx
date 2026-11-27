"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { setMemberLocationsAction, setMemberRoleAction } from "../actions";
import type { BarbersMember } from "@/services/barbers/roles";
import type { BarbersRole } from "@/lib/barbers/permissions";
import { unwrap } from "@/lib/barbers/errors";

const ROLES: BarbersRole[] = ["admin", "cashier", "accountant"];

/**
 * Admins give each person in the organization a Barbers role and, optionally,
 * the locations they may work at (none ticked = every location).
 */
export default function MemberRoles({
  members,
  me,
  locations,
}: {
  members: BarbersMember[];
  me: string;
  locations: { id: string; name: string }[];
}) {
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

  function toggleLocation(m: BarbersMember, locationId: string) {
    const next = m.locationIds.includes(locationId)
      ? m.locationIds.filter((id) => id !== locationId)
      : [...m.locationIds, locationId];
    setError(null);
    startTransition(async () => {
      try {
        await unwrap(setMemberLocationsAction(m.userId, next));
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
              {locations.length > 1 && (
                <div role="group" aria-label={t("locationsFor", { name: m.name })} className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-zinc-500">{t("locations")}:</span>
                  {locations.map((l) => {
                    const on = m.locationIds.includes(l.id);
                    return (
                      <button
                        key={l.id}
                        type="button"
                        aria-pressed={on}
                        disabled={pending}
                        onClick={() => toggleLocation(m, l.id)}
                        className={`rounded-full border px-2 py-0.5 text-xs disabled:opacity-50 ${
                          on
                            ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                            : "border-zinc-200 text-zinc-600 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-300"
                        }`}
                      >
                        {l.name}
                      </button>
                    );
                  })}
                  {m.locationIds.length === 0 && <span className="text-xs text-zinc-400">({t("allLocations")})</span>}
                </div>
              )}
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
      {locations.length > 1 && <p className="text-xs text-zinc-500">{t("locationsHint")}</p>}
      <p className="text-xs text-zinc-500">
        {t("inviteHint")}{" "}
        <a href="/team" className="underline hover:text-black dark:hover:text-white">{t("teamLink")}</a>
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

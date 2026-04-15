"use client";

import { useState, useTransition } from "react";
import { toggleTenantStatusAction } from "../actions";

export default function StatusToggle({
  tenantId,
  isActive,
}: {
  tenantId: string;
  isActive: boolean;
}) {
  const [active, setActive] = useState(isActive);
  const [isPending, startTransition] = useTransition();

  function toggle() {
    const next = !active;
    setActive(next);
    startTransition(async () => {
      await toggleTenantStatusAction(tenantId, next);
    });
  }

  return (
    <div className="flex items-center gap-3">
      <span className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${
        active
          ? "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400"
          : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800"
      }`}>
        {active ? "Active" : "Inactive"}
      </span>
      <button
        onClick={toggle}
        disabled={isPending}
        className="rounded-full border border-zinc-200 px-4 py-1.5 text-sm text-zinc-600 hover:border-zinc-400 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-400"
      >
        {active ? "Deactivate" : "Activate"}
      </button>
    </div>
  );
}

"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { seedDemoAction, resetDemoAction } from "../actions";

type Props = {
  tenantId: string;
  demoClients: number;
  demoProviders: number;
  demoEmployees: number;
  demoQuotes: number;
};

export default function DemoSeedPanel({ tenantId, demoClients, demoProviders, demoEmployees, demoQuotes }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const hasDemo = demoClients > 0 || demoProviders > 0 || demoEmployees > 0 || demoQuotes > 0;

  function handleSeed() {
    startTransition(async () => {
      await seedDemoAction(tenantId);
      router.refresh();
    });
  }

  function handleReset() {
    startTransition(async () => {
      await resetDemoAction(tenantId);
      router.refresh();
    });
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Demo Data</h2>

      <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-5 py-4 dark:border-zinc-800 dark:bg-zinc-900">
        {hasDemo ? (
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium text-black dark:text-white">Demo data loaded</p>
              <p className="text-xs text-zinc-500">
                {demoClients} client{demoClients !== 1 ? "s" : ""} · {demoProviders} provider{demoProviders !== 1 ? "s" : ""} · {demoEmployees} employee{demoEmployees !== 1 ? "s" : ""} · {demoQuotes} quote{demoQuotes !== 1 ? "s" : ""}
              </p>
            </div>
            <button
              onClick={handleReset}
              disabled={pending}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 hover:border-zinc-500 hover:text-black disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:text-white"
            >
              {pending ? "Resetting…" : "Reset demo"}
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium text-black dark:text-white">No demo data</p>
              <p className="text-xs text-zinc-500">Seeds 5 clients, 5 providers, 5 employees, and 4 quotes.</p>
            </div>
            <button
              onClick={handleSeed}
              disabled={pending}
              className="rounded-lg bg-black px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
            >
              {pending ? "Seeding…" : "Seed demo data"}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, ChevronDown } from "lucide-react";
import type { TradeWithCount } from "@/services/coverage/coverage";

function groupByCategory(trades: TradeWithCount[]): [string, TradeWithCount[]][] {
  const map = new Map<string, TradeWithCount[]>();
  for (const t of trades) {
    if (!map.has(t.category)) map.set(t.category, []);
    map.get(t.category)!.push(t);
  }
  return Array.from(map.entries());
}

export default function AddTradeButton({ trades }: { trades: TradeWithCount[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  if (trades.length === 0) return null;

  const grouped = groupByCategory(trades);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
      >
        <Plus size={15} />
        Add trade
        <ChevronDown size={13} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          <div className="max-h-80 overflow-y-auto">
            {grouped.map(([category, categoryTrades]) => (
              <div key={category}>
                <p className="sticky top-0 bg-zinc-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:bg-zinc-800">
                  {category}
                </p>
                {categoryTrades.map((trade) => (
                  <button
                    key={trade.id}
                    onClick={() => {
                      setOpen(false);
                      router.push(`/coverage/${trade.id}`);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    {trade.name}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

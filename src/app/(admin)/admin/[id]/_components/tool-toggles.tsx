"use client";

import { useState, useTransition } from "react";
import { toggleToolAction } from "../actions";

type Tool = { id: string; name: string; slug: string; description: string | null };

export default function ToolToggles({
  tenantId,
  tools,
  enabledSlugs,
}: {
  tenantId: string;
  tools: Tool[];
  enabledSlugs: string[];
}) {
  const [enabled, setEnabled] = useState<Set<string>>(new Set(enabledSlugs));
  const [isPending, startTransition] = useTransition();

  function toggle(tool: Tool) {
    const next = new Set(enabled);
    const willEnable = !next.has(tool.slug);

    if (willEnable) {
      next.add(tool.slug);
    } else {
      next.delete(tool.slug);
    }
    setEnabled(next);

    startTransition(async () => {
      await toggleToolAction(tenantId, tool.id, willEnable);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {tools.map((tool) => {
        const isOn = enabled.has(tool.slug);
        return (
          <div key={tool.id} className="flex items-center justify-between rounded-xl border border-zinc-200 px-5 py-4 dark:border-zinc-800">
            <div>
              <p className="text-sm font-medium text-black dark:text-white">{tool.name}</p>
              {tool.description && <p className="text-xs text-zinc-500 mt-0.5">{tool.description}</p>}
            </div>
            <button
              onClick={() => toggle(tool)}
              disabled={isPending}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none disabled:opacity-50 ${
                isOn ? "bg-black dark:bg-white" : "bg-zinc-200 dark:bg-zinc-700"
              }`}
              role="switch"
              aria-checked={isOn}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full shadow-lg transition-transform ${
                  isOn
                    ? "translate-x-5 bg-white dark:bg-black"
                    : "translate-x-0 bg-white dark:bg-zinc-400"
                }`}
              />
            </button>
          </div>
        );
      })}
    </div>
  );
}

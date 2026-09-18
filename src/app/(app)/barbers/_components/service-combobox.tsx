"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import type { ServiceRow } from "@/services/barbers/catalog";

/** The shop runs ~200 services; rendering them all would dump 200 DOM nodes on
 *  an empty query. Cap what's rendered — typing narrows it down fast. */
const MAX_RESULTS = 50;

/**
 * Hand-rolled typeahead, matching this codebase's zero-headless-library style.
 *
 * This is a PICKER, not a controlled value: selecting a service calls onSelect
 * and clears the input, so the user can immediately search for the next service
 * to add to the cart.
 */
export default function ServiceCombobox({
  services,
  onSelect,
  placeholder,
}: {
  services: ServiceRow[];
  onSelect: (serviceId: string) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [rawHighlighted, setHighlighted] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? services.filter((s) => s.name.toLowerCase().includes(q))
      : services;
    return filtered.slice(0, MAX_RESULTS);
  }, [services, query]);

  // Clamp at render instead of syncing via an effect, so the highlight can never
  // point past the end if the result set shrinks.
  const highlighted = Math.min(rawHighlighted, Math.max(matches.length - 1, 0));

  // Close when tapping outside — on a phone this is the main way to dismiss.
  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  function choose(serviceId: string) {
    onSelect(serviceId);
    setQuery("");
    setOpen(false);
    setHighlighted(0);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      setHighlighted((i) => (matches.length === 0 ? 0 : Math.min(i + 1, matches.length - 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      if (open && matches[highlighted]) {
        e.preventDefault();
        choose(matches[highlighted].id);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
      <input
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        autoComplete="off"
        value={query}
        placeholder={placeholder}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          // Reset the highlight here rather than in an effect: the result set
          // changes only as a direct consequence of this edit.
          setHighlighted(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        className="w-full rounded-lg border border-zinc-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:focus:ring-white"
      />

      {open && (
        <div
          id={listboxId}
          role="listbox"
          className="absolute left-0 right-0 z-20 mt-1 max-h-[50vh] overflow-y-auto rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        >
          {matches.length === 0 ? (
            <p className="px-3 py-3 text-sm text-zinc-400">—</p>
          ) : (
            matches.map((s, i) => (
              <button
                key={s.id}
                type="button"
                role="option"
                aria-selected={i === highlighted}
                onMouseEnter={() => setHighlighted(i)}
                onClick={() => choose(s.id)}
                className={`block w-full px-3 py-2.5 text-left text-sm ${
                  i === highlighted
                    ? "bg-zinc-100 text-black dark:bg-zinc-800 dark:text-white"
                    : "text-zinc-700 dark:text-zinc-300"
                }`}
              >
                <span className="block truncate">{s.name}</span>
                {s.category && (
                  <span className="block truncate text-xs text-zinc-400">{s.category}</span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

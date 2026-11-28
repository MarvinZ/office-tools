"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { UserPlus, X } from "lucide-react";
import { unwrap } from "@/lib/barbers/errors";
import { createClientAction, searchClientsAction } from "../clients/actions";

export type PickedClient = { id: string | null; name: string };

type Option = { id: string; fullName: string; phone: string | null };

/**
 * Who the customer is: search a client record by name or phone, create one
 * on the spot, or just type a name (no record) as before. Keeps the front
 * desk fast: nothing here is required.
 */
export default function ClientPicker({ value, onChange }: { value: PickedClient; onChange: (v: PickedClient) => void }) {
  const t = useTranslations("barbers.clientPicker");
  const [results, setResults] = useState<Option[]>([]);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [phone, setPhone] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const seq = useRef(0);

  // Search as they type (debounced); only while no record is picked.
  useEffect(() => {
    if (value.id || value.name.trim().length < 2) return;
    const mine = ++seq.current;
    const timer = setTimeout(async () => {
      try {
        const found = await unwrap(searchClientsAction(value.name));
        if (mine === seq.current) setResults(found);
      } catch {
        if (mine === seq.current) setResults([]);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [value]);

  function pick(o: Option) {
    onChange({ id: o.id, name: o.fullName });
    setOpen(false);
    setCreating(false);
  }

  function create() {
    setError(null);
    startTransition(async () => {
      try {
        const row = await unwrap(createClientAction({ fullName: value.name, phone, birthDate: birthDate || null }));
        setPhone("");
        setBirthDate("");
        pick(row);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  const inputCls =
    "w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:focus:ring-white";

  if (value.id) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900">
        <span className="flex-1 font-medium text-black dark:text-white">{value.name}</span>
        <span className="text-xs text-zinc-500">{t("record")}</span>
        <button type="button" aria-label={t("clear")} onClick={() => onChange({ id: null, name: "" })} className="text-zinc-400 hover:text-black dark:hover:text-white">
          <X size={14} />
        </button>
      </div>
    );
  }

  const showList = open && value.name.trim().length >= 2;
  return (
    <div className="relative">
      <input
        value={value.name}
        onChange={(e) => {
          onChange({ id: null, name: e.target.value });
          setOpen(true);
          if (e.target.value.trim().length < 2) setResults([]);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={t("placeholder")}
        aria-label={t("label")}
        aria-autocomplete="list"
        className={inputCls}
      />
      {showList && !creating && (
        <ul role="listbox" className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          {results.map((o) => (
            <li key={o.id} role="option" aria-selected={false}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(o)} className="flex w-full justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
                <span className="text-black dark:text-white">{o.fullName}</span>
                <span className="text-xs text-zinc-500">{o.phone ?? ""}</span>
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setCreating(true)}
              className="flex w-full items-center gap-2 border-t border-zinc-100 px-3 py-2 text-left text-sm text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <UserPlus size={14} /> {t("create", { name: value.name.trim() })}
            </button>
          </li>
        </ul>
      )}
      {creating && (
        <div className="mt-2 flex flex-col gap-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
          <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">{t("newTitle", { name: value.name.trim() })}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t("phone")} aria-label={t("phone")} className={inputCls} />
            <label className="flex flex-col gap-0.5 text-xs text-zinc-500">
              {t("birthDate")}
              <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className={inputCls} />
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setCreating(false)} className="rounded-lg px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800">
              {t("cancel")}
            </button>
            <button type="button" disabled={pending} onClick={create} className="rounded-lg bg-black px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black">
              {t("save")}
            </button>
          </div>
          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createLocationAction } from "../actions";

export default function CreateLocationModal() {
  const t = useTranslations("barbers");
  const tc = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState("");
  const [addressStreet, setAddressStreet] = useState("");
  const [addressCity, setAddressCity] = useState("");
  const [addressState, setAddressState] = useState("");
  const [addressZip, setAddressZip] = useState("");
  const [addressCountry, setAddressCountry] = useState("");
  const [phone, setPhone] = useState("");

  function resetAndClose() {
    setName("");
    setAddressStreet("");
    setAddressCity("");
    setAddressState("");
    setAddressZip("");
    setAddressCountry("");
    setPhone("");
    setOpen(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      await createLocationAction({
        name,
        addressStreet: addressStreet || undefined,
        addressCity: addressCity || undefined,
        addressState: addressState || undefined,
        addressZip: addressZip || undefined,
        addressCountry: addressCountry || undefined,
        phone: phone || undefined,
        status: "active",
      });
      router.refresh();
      resetAndClose();
    });
  }

  const inputCls = "w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:focus:ring-white";
  const labelCls = "block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1";

  return (
    <>
      <button onClick={() => setOpen(true)} className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200">
        {t("locationsPage.addButton")}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-10 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-950">
            <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
              <h2 className="text-lg font-semibold text-black dark:text-white">{t("locationForm.addTitle")}</h2>
              <button onClick={() => setOpen(false)} className="text-zinc-400 hover:text-black dark:hover:text-white">✕</button>
            </div>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-6 py-5">
              <div>
                <label className={labelCls}>{t("locationForm.fieldName")} *</label>
                <input required value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className={labelCls}>{t("locationForm.fieldStreet")}</label>
                  <input value={addressStreet} onChange={(e) => setAddressStreet(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>{t("locationForm.fieldCity")}</label>
                  <input value={addressCity} onChange={(e) => setAddressCity(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>{t("locationForm.fieldState")}</label>
                  <input value={addressState} onChange={(e) => setAddressState(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>{t("locationForm.fieldZip")}</label>
                  <input value={addressZip} onChange={(e) => setAddressZip(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>{t("locationForm.fieldCountry")}</label>
                  <input value={addressCountry} onChange={(e) => setAddressCountry(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>{t("locationForm.fieldPhone")}</label>
                  <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} />
                </div>
              </div>
              <div className="flex justify-end gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
                <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-zinc-200 px-4 py-2 text-sm text-zinc-600 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-400">
                  {tc("cancel")}
                </button>
                <button type="submit" disabled={pending} className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200">
                  {pending ? tc("saving") : t("locationForm.createLocation")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

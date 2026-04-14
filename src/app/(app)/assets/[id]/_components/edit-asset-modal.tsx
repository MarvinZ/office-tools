"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { editAssetAction } from "../actions";
import { ASSET_CATEGORIES } from "../../_mock/data";
import type { AssetRow } from "@/services/assets/assets";
import type { EmployeeRow } from "@/services/employees/employees";
import { fullName } from "@/lib/employee-utils";

export default function EditAssetModal({ asset, employees }: { asset: AssetRow; employees: EmployeeRow[] }) {
  const t = useTranslations("assets");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const data = new FormData(e.currentTarget);
    const result = await editAssetAction(asset.id, data);
    if (result && "error" in result) {
      setError(result.error ?? "Save failed.");
      setPending(false);
    } else {
      setOpen(false);
      setPending(false);
    }
  }

  const purchaseDate = new Date(asset.purchaseDate).toISOString().split("T")[0];
  const warrantyExpiry = new Date(asset.warrantyExpiry).toISOString().split("T")[0];

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-full border border-zinc-200 px-4 py-1.5 text-sm text-zinc-600 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-400"
      >
        {tc("edit")}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 px-4 py-10">
          <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl dark:bg-zinc-950">
            <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
              <h2 className="text-base font-semibold text-black dark:text-white">{t("form.editTitle")}</h2>
              <button onClick={() => setOpen(false)} className="text-zinc-400 hover:text-black dark:hover:text-white">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-5 px-6 py-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label={t("form.fieldName")} name="name" required defaultValue={asset.name} />
                <SelectField label={t("form.fieldCategory")} name="category" required options={ASSET_CATEGORIES} defaultValue={asset.category} />
                <Field label={t("form.fieldBrand")} name="brand" required defaultValue={asset.brand} />
                <Field label={t("form.fieldModel")} name="model" required defaultValue={asset.model} />
                <Field label={t("form.fieldSerial")} name="serialNumber" required defaultValue={asset.serialNumber} mono />
                <Field label={t("form.fieldBarcode")} name="barcode" required defaultValue={asset.barcode} mono />
                <Field label={t("form.fieldLocation")} name="location" required defaultValue={asset.location} />

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-zinc-500">{t("form.fieldAssignedTo")}</label>
                  <select name="assignedToId" defaultValue={asset.assignedToId ?? ""} className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-white">
                    <option value="">{t("form.fieldUnassigned")}</option>
                    {employees.filter((e) => e.status === "active").map((e) => (
                      <option key={e.id} value={e.id}>{fullName(e)}</option>
                    ))}
                  </select>
                </div>

                <Field label={t("form.fieldSupplier")} name="supplier" required defaultValue={asset.supplier} />
                <Field label={t("form.fieldPrice")} name="purchasePrice" required type="number" defaultValue={String(asset.purchasePrice)} />
                <Field label={t("form.fieldPurchaseDate")} name="purchaseDate" required type="date" defaultValue={purchaseDate} />
                <Field label={t("form.fieldWarrantyExpiry")} name="warrantyExpiry" required type="date" defaultValue={warrantyExpiry} />
              </div>

              <Field label={t("form.fieldBuyUrl")} name="buyUrl" type="url" defaultValue={asset.buyUrl ?? ""} />
              <Field label={t("form.fieldNotes")} name="notes" defaultValue={asset.notes ?? ""} />
              <Field label={t("form.fieldTags")} name="tags" defaultValue={(asset.tags ?? []).join(", ")} />

              {error && <p className="text-sm text-red-500">{error}</p>}

              <div className="flex justify-end gap-3 border-t border-zinc-100 pt-4 dark:border-zinc-800">
                <button type="button" onClick={() => setOpen(false)} className="rounded-full border border-zinc-200 px-5 py-2 text-sm text-zinc-600 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-400">
                  {tc("cancel")}
                </button>
                <button type="submit" disabled={pending} className="rounded-full bg-black px-5 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black">
                  {pending ? tc("saving") : t("form.saveChanges")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function Field({ label, name, required, defaultValue, type = "text", mono }: {
  label: string; name: string; required?: boolean; defaultValue?: string; type?: string; mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-zinc-500">{label}</label>
      <input name={name} type={type} required={required} defaultValue={defaultValue}
        className={`rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:focus:ring-white ${mono ? "font-mono" : ""}`}
      />
    </div>
  );
}

function SelectField({ label, name, required, options, defaultValue }: {
  label: string; name: string; required?: boolean; options: readonly string[]; defaultValue?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-zinc-500">{label}</label>
      <select name={name} required={required} defaultValue={defaultValue} className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-white">
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

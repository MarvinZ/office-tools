"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { createAssetAction } from "../actions";
import { ASSET_CATEGORIES } from "../_mock/data";
import type { EmployeeRow } from "@/services/employees/employees";
import { fullName } from "@/lib/employee-utils";

export default function AddAssetModal({ employees }: { employees: EmployeeRow[] }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    await createAssetAction(new FormData(e.currentTarget));
    setPending(false);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-full bg-black px-5 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
      >
        + Add asset
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 px-4 py-10">
          <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl dark:bg-zinc-950">
            <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
              <h2 className="text-base font-semibold text-black dark:text-white">Add asset</h2>
              <button onClick={() => setOpen(false)} className="text-zinc-400 hover:text-black dark:hover:text-white">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-5 px-6 py-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Asset name *" name="name" required placeholder="MacBook Pro 14" />
                <SelectField label="Category *" name="category" required options={ASSET_CATEGORIES} />
                <Field label="Brand *" name="brand" required placeholder="Apple" />
                <Field label="Model *" name="model" required placeholder="MK183LL/A" />
                <Field label="Serial number *" name="serialNumber" required placeholder="C02XL0YNJHD2" mono />
                <Field label="Barcode *" name="barcode" required placeholder="1234567890" mono />
                <Field label="Location *" name="location" required placeholder="Main Office" />

                {/* Employee dropdown */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-zinc-500">Assigned to</label>
                  <select name="assignedToId" className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-white">
                    <option value="">Unassigned</option>
                    {employees.filter((e) => e.status === "active").map((e) => (
                      <option key={e.id} value={e.id}>{fullName(e)}</option>
                    ))}
                  </select>
                </div>

                <Field label="Supplier *" name="supplier" required placeholder="Apple Store" />
                <Field label="Purchase price *" name="purchasePrice" required placeholder="1999" type="number" />
                <Field label="Purchase date *" name="purchaseDate" required type="date" />
                <Field label="Warranty expiry *" name="warrantyExpiry" required type="date" />
              </div>

              <Field label="Where to buy URL" name="buyUrl" placeholder="https://apple.com/..." type="url" />
              <Field label="Notes" name="notes" placeholder="Any extra info..." />
              <Field label="Tags (comma-separated)" name="tags" placeholder="office, laptop, dev" />

              <div className="flex justify-end gap-3 border-t border-zinc-100 pt-4 dark:border-zinc-800">
                <button type="button" onClick={() => setOpen(false)} className="rounded-full border border-zinc-200 px-5 py-2 text-sm text-zinc-600 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-400">
                  Cancel
                </button>
                <button type="submit" disabled={pending} className="rounded-full bg-black px-5 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black">
                  {pending ? "Saving..." : "Save asset"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function Field({ label, name, required, placeholder, type = "text", mono }: {
  label: string; name: string; required?: boolean; placeholder?: string; type?: string; mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-zinc-500">{label}</label>
      <input name={name} type={type} required={required} placeholder={placeholder}
        className={`rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:focus:ring-white ${mono ? "font-mono" : ""}`}
      />
    </div>
  );
}

function SelectField({ label, name, required, options }: {
  label: string; name: string; required?: boolean; options: readonly string[];
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-zinc-500">{label}</label>
      <select name={name} required={required} className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-white">
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

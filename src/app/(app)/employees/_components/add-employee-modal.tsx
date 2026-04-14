"use client";

import { useState } from "react";
import { X, UserCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { createEmployeeAction } from "../actions";
import type { DepartmentRow } from "@/services/employees/departments";

export default function AddEmployeeModal({ departments }: { departments: DepartmentRow[] }) {
  const t = useTranslations("employees");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    await createEmployeeAction(new FormData(e.currentTarget));
    setPending(false);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-full bg-black px-5 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
      >
        {t("page.addButton")}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 px-4 py-10">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl dark:bg-zinc-950">
            <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
              <h2 className="text-base font-semibold text-black dark:text-white">{t("form.addTitle")}</h2>
              <button onClick={() => setOpen(false)} className="text-zinc-400 hover:text-black dark:hover:text-white">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-6 px-6 py-5">

              {/* Avatar */}
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                  {avatarPreview ? (
                    <img src={avatarPreview} className="h-full w-full object-cover" alt="Preview" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-zinc-400">
                      <UserCircle size={32} />
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-zinc-500">{t("form.profilePhoto")}</label>
                  <input
                    name="avatar"
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) setAvatarPreview(URL.createObjectURL(f));
                    }}
                    className="text-sm text-zinc-500 file:mr-3 file:rounded-full file:border-0 file:bg-zinc-100 file:px-3 file:py-1 file:text-sm file:font-medium file:text-zinc-700 dark:file:bg-zinc-800 dark:file:text-zinc-300"
                  />
                </div>
              </div>

              {/* Identity */}
              <Section title={t("form.sectionIdentity")}>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label={t("form.fieldFirstName")} name="firstName" required />
                  <Field label={t("form.fieldLastName")} name="lastName" required />
                </div>
              </Section>

              {/* Contact */}
              <Section title={t("form.sectionContact")}>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label={t("form.fieldCompanyEmail")} name="companyEmail" type="email" required />
                  <Field label={t("form.fieldPersonalEmail")} name="personalEmail" type="email" />
                  <Field label={t("form.fieldPhone")} name="phone" type="tel" />
                </div>
              </Section>

              {/* Role */}
              <Section title={t("form.sectionRole")}>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label={t("form.fieldPosition")} name="position" required />
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-zinc-500">{t("form.fieldDepartment")}</label>
                    <select
                      name="departmentId"
                      className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                    >
                      <option value="">{tc("noDepartment")}</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                  <Field label={t("form.fieldHireDate")} name="hireDate" type="date" required />
                </div>
              </Section>

              {/* Compensation */}
              <Section title={t("form.sectionCompensation")}>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label={t("form.fieldCompAmount")} name="compensationAmount" type="number" placeholder={t("form.fieldCompAmountPlaceholder")} />
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-zinc-500">{t("form.fieldCompType")}</label>
                    <select
                      name="compensationType"
                      className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                    >
                      <option value="">{tc("notApplicable")}</option>
                      <option value="hourly">{t("form.compHourly")}</option>
                      <option value="monthly">{t("form.compMonthly")}</option>
                      <option value="annual">{t("form.compAnnual")}</option>
                    </select>
                  </div>
                </div>
              </Section>

              {/* Address */}
              <Section title={t("form.sectionAddress")}>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Field label={t("form.fieldStreet")} name="addressStreet" />
                  </div>
                  <Field label={t("form.fieldCity")} name="addressCity" />
                  <Field label={t("form.fieldState")} name="addressState" />
                  <Field label={t("form.fieldZip")} name="addressZip" />
                  <Field label={t("form.fieldCountry")} name="addressCountry" />
                </div>
              </Section>

              {/* Emergency contact */}
              <Section title={t("form.sectionEmergency")}>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label={t("form.fieldEmergencyName")} name="emergencyContactName" />
                  <Field label={t("form.fieldEmergencyPhone")} name="emergencyContactPhone" type="tel" />
                  <Field label={t("form.fieldEmergencyRelation")} name="emergencyContactRelation" placeholder={t("form.fieldEmergencyRelationPlaceholder")} />
                </div>
              </Section>

              {/* Notes */}
              <Section title={t("form.sectionNotes")}>
                <Field label="" name="notes" placeholder={t("form.fieldNotesPlaceholder")} />
              </Section>

              <div className="flex justify-end gap-3 border-t border-zinc-100 pt-4 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-full border border-zinc-200 px-5 py-2 text-sm text-zinc-600 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-400"
                >
                  {tc("cancel")}
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-full bg-black px-5 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black"
                >
                  {pending ? tc("saving") : t("form.saveEmployee")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{title}</p>
      {children}
    </div>
  );
}

function Field({
  label, name, required, placeholder, type = "text",
}: {
  label: string; name: string; required?: boolean; placeholder?: string; type?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs font-medium text-zinc-500">{label}</label>}
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:focus:ring-white"
      />
    </div>
  );
}

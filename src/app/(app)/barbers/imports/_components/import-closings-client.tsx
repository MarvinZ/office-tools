"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, HelpCircle, Upload } from "lucide-react";
import { importClosingsAction, previewClosingsAction, type PreviewResponse } from "../actions";
import type { ClosingDecisions, ClosingPreview, ImportResult } from "@/services/barbers/closing-imports";
import type { ImportWarning } from "@/lib/barbers/closing-import/plan-import";
import { fmtColones } from "@/lib/barbers/currency";
import { fmtDay } from "@/lib/barbers/dates";
import { unwrap } from "@/lib/barbers/errors";

type Choice = { id: string; name: string; active: boolean };

const STATUS_STYLE: Record<string, string> = {
  new: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  replace: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  unchanged: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  blocked: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
};

const pct = (n: number | string) => `${Math.round(Number(n) * 10000) / 100}%`;

/**
 * Upload → preview → answer questions → import. Files stay in the browser
 * between steps and are re-sent with each preview, so nothing is written until
 * the admin presses Import.
 */
export default function ImportClosingsClient({
  locations,
  barbers,
  canImport,
}: {
  locations: { id: string; name: string }[];
  barbers: Choice[];
  canImport: boolean;
}) {
  const t = useTranslations("barbers.imports");
  const tErrors = useTranslations("barbers.errors");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [locationId, setLocationId] = useState(locations[0]?.id ?? "");
  const [files, setFiles] = useState<File[]>([]);
  const [decisions, setDecisions] = useState<ClosingDecisions>({});
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [results, setResults] = useState<ImportResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const nameOf = useMemo(() => {
    const map = new Map(barbers.map((b) => [b.id, b.name]));
    // Professionals that will be created on import show under their written name.
    for (const p of preview?.previews ?? []) {
      for (const b of p.byBarber) if (b.barberId.startsWith("new:")) map.set(b.barberId, `${b.barberId.slice(4)} (${t("new")})`);
    }
    return map;
  }, [barbers, preview, t]);

  function formData(fs: File[], ds: ClosingDecisions) {
    const fd = new FormData();
    for (const f of fs) fd.append("files", f);
    fd.set("locationId", locationId);
    fd.set("decisions", JSON.stringify(ds));
    return fd;
  }

  function runPreview(fs: File[], ds: ClosingDecisions) {
    setError(null);
    setResults(null);
    if (fs.length === 0) {
      setPreview(null);
      return;
    }
    startTransition(async () => {
      try {
        setPreview(await unwrap(previewClosingsAction(formData(fs, ds))));
      } catch (e) {
        setError(e instanceof Error ? e.message : t("errorGeneric"));
      }
    });
  }

  function onFiles(list: FileList | null) {
    const fs = Array.from(list ?? []).sort((a, b) => a.name.localeCompare(b.name));
    setFiles(fs);
    const kept = { reimport: decisions.reimport };
    setDecisions(kept);
    runPreview(fs, kept);
  }

  function decideName(key: string, value: string) {
    const next = { ...decisions, names: { ...decisions.names } };
    if (value) next.names![key] = value;
    else delete next.names![key];
    setDecisions(next);
    runPreview(files, next);
  }

  function decideOutflow(fileName: string, row: number, value: string) {
    const perFile = { ...(decisions.outflows?.[fileName] ?? {}) };
    if (value) perFile[String(row)] = value;
    else delete perFile[String(row)];
    const next = { ...decisions, outflows: { ...decisions.outflows, [fileName]: perFile } };
    setDecisions(next);
    runPreview(files, next);
  }

  function runImport() {
    setError(null);
    startTransition(async () => {
      try {
        const r = await unwrap(importClosingsAction(formData(files, decisions)));
        setResults(r);
        setPreview(null);
        setFiles([]);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : t("errorGeneric"));
      }
    });
  }

  // Questions across all files: each unknown name once.
  const unknownNames = useMemo(() => {
    const map = new Map<string, { key: string; written: string; files: string[] }>();
    for (const p of preview?.previews ?? []) {
      for (const n of p.plan.unknownNames) {
        const e = map.get(n.key) ?? { key: n.key, written: n.written, files: [] };
        e.files.push(p.plan.businessDate ? fmtDay(p.plan.businessDate) : p.fileName);
        map.set(n.key, e);
      }
    }
    return [...map.values()];
  }, [preview]);

  const counts = useMemo(() => {
    const c = { new: 0, replace: 0, unchanged: 0, blocked: 0 };
    for (const p of preview?.previews ?? []) c[p.status]++;
    return c;
  }, [preview]);
  const importable = counts.new + counts.replace;

  const select =
    "rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-sm text-black outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800 sm:flex-row sm:items-end">
        {locations.length > 1 && (
          <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
            {t("location")}
            <select id="location" value={locationId} onChange={(e) => setLocationId(e.target.value)} className={select}>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </label>
        )}
        <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 sm:order-last">
          <input
            id="reimport"
            type="checkbox"
            checked={!!decisions.reimport}
            onChange={(e) => {
              const next = { ...decisions, reimport: e.target.checked };
              setDecisions(next);
              runPreview(files, next);
            }}
          />
          <span>
            {t("reimport")}
            <span className="block text-xs text-zinc-400">{t("reimportHint")}</span>
          </span>
        </label>
        <label className="flex flex-1 cursor-pointer flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
          {t("chooseFiles")}
          <span className="flex items-center gap-2 rounded-lg border border-dashed border-zinc-300 px-3 py-2.5 text-zinc-500 hover:border-zinc-500 dark:border-zinc-700">
            <Upload size={16} />
            {files.length ? t("filesChosen", { count: files.length }) : t("chooseHint")}
          </span>
          <input
            id="closingFiles"
            type="file"
            accept=".xlsx"
            multiple
            className="sr-only"
            onChange={(e) => onFiles(e.target.files)}
          />
        </label>
      </div>

      {pending && <p className="text-sm text-zinc-500">{t("working")}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {results && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300">
          <p className="font-medium">{t("doneTitle")}</p>
          <ul className="mt-1 list-disc pl-5">
            {results.map((r) => (
              <li key={r.fileName}>
                {r.fileName}: {r.error ? tErrors(r.error) : t(`status.${r.status}`)}
                {r.version && r.version > 1 ? ` (v${r.version})` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      {preview && (
        <>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {(["new", "replace", "unchanged", "blocked"] as const).map((s) =>
              counts[s] ? (
                <span key={s} className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[s]}`}>
                  {t(`summary.${s}`, { count: counts[s] })}
                </span>
              ) : null
            )}
            {preview.missingMethodCodes.length > 0 && (
              <span className="text-xs text-zinc-500">{t("willCreateMethods", { methods: preview.missingMethodCodes.join(", ") })}</span>
            )}
            <div className="ml-auto">
              {canImport ? (
                <button
                  onClick={runImport}
                  disabled={pending || importable === 0}
                  className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
                >
                  {t("importButton", { count: importable })}
                </button>
              ) : (
                <span className="text-xs text-zinc-500">{t("adminOnly")}</span>
              )}
            </div>
          </div>

          {unknownNames.length > 0 && (
            <section className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold text-amber-800 dark:text-amber-300">
                <HelpCircle size={16} />
                {t("namesTitle")}
              </h2>
              <p className="text-xs text-amber-800/80 dark:text-amber-300/80">{t("namesHint")}</p>
              {unknownNames.map((n) => (
                <div key={n.key} className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="min-w-32 font-medium text-black dark:text-white">“{n.written}”</span>
                  <span className="text-xs text-zinc-500">{n.files.join(", ")}</span>
                  <select
                    aria-label={t("namesTitle")}
                    value={decisions.names?.[n.key] ?? ""}
                    onChange={(e) => decideName(n.key, e.target.value)}
                    className={`${select} ml-auto`}
                  >
                    <option value="">{t("chooseWho")}</option>
                    {barbers.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}{b.active ? "" : ` (${t("inactive")})`}</option>
                    ))}
                    <option value="new">{t("createProfessional", { name: n.written })}</option>
                    <option value="ignore">{t("notAProfessional")}</option>
                  </select>
                </div>
              ))}
            </section>
          )}

          <div className="flex flex-col gap-4">
            {preview.previews.map((p) => (
              <FileCard
                key={p.fileName}
                preview={p}
                nameOf={nameOf}
                barbers={barbers}
                outflowDecisions={decisions.outflows?.[p.fileName] ?? {}}
                onOutflow={(row, v) => decideOutflow(p.fileName, row, v)}
                selectCls={select}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function FileCard({
  preview: p,
  nameOf,
  barbers,
  outflowDecisions,
  onOutflow,
  selectCls,
}: {
  preview: ClosingPreview;
  nameOf: Map<string, string>;
  barbers: Choice[];
  outflowDecisions: Record<string, string>;
  onOutflow: (row: number, value: string) => void;
  selectCls: string;
}) {
  const t = useTranslations("barbers.imports");
  const { plan } = p;
  const warnings = groupWarnings(plan.warnings);

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
      <header className="flex flex-wrap items-center gap-2">
        <FileSpreadsheet size={16} className="text-zinc-400" />
        <span className="font-medium text-black dark:text-white">
          {plan.businessDate ? fmtDay(plan.businessDate) : "—"}
        </span>
        <span className="text-sm text-zinc-500">{p.fileName}</span>
        <span className={`ml-auto rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[p.status]}`}>
          {t(`status.${p.status}`)}
          {p.status === "replace" && p.replacesVersion ? ` v${p.replacesVersion}` : ""}
        </span>
      </header>

      {p.blockedReason && <p className="text-sm text-amber-700 dark:text-amber-400">{t(`blocked.${p.blockedReason}`)}</p>}
      {plan.errors.map((e) => (
        <p key={e.code + (e.values?.sheet ?? "")} className="text-sm text-red-600">
          {t(`planError.${e.code}`, e.values ?? {})}
        </p>
      ))}

      <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-zinc-600 dark:text-zinc-300">
        <div><dt className="inline text-zinc-400">{t("billed")}: </dt><dd className="inline tabular-nums">{fmtColones(plan.totals.billed)}</dd></div>
        <div><dt className="inline text-zinc-400">{t("servicesTotal")}: </dt><dd className="inline tabular-nums">{fmtColones(plan.totals.services)}</dd></div>
        <div><dt className="inline text-zinc-400">{t("supplier")}: </dt><dd className="inline tabular-nums">{fmtColones(plan.totals.supplier)}</dd></div>
        {(plan.cashiers.shift1 || plan.cashiers.shift2) && (
          <div><dt className="inline text-zinc-400">{t("cashiers")}: </dt><dd className="inline">{[plan.cashiers.shift1, plan.cashiers.shift2].filter(Boolean).join(" / ")}</dd></div>
        )}
      </dl>

      {p.byBarber.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-zinc-400">
                <th className="py-1 pr-4 font-medium">{t("colBarber")}</th>
                <th className="py-1 pr-4 text-right font-medium">{t("colServices")}</th>
                <th className="py-1 pr-4 text-right font-medium">{t("colBilled")}</th>
                <th className="py-1 pr-4 text-right font-medium">{t("colDeductions")}</th>
                <th className="py-1 text-right font-medium">{t("colProducts")}</th>
              </tr>
            </thead>
            <tbody className="text-zinc-600 dark:text-zinc-300">
              {p.byBarber.map((b) => (
                <tr key={b.barberId} className="border-t border-zinc-100 dark:border-zinc-800">
                  <td className="py-1 pr-4 text-black dark:text-white">{nameOf.get(b.barberId) ?? b.barberId}</td>
                  <td className="py-1 pr-4 text-right tabular-nums">{b.services}</td>
                  <td className="py-1 pr-4 text-right tabular-nums">{fmtColones(b.billed)}</td>
                  <td className="py-1 pr-4 text-right tabular-nums">{b.deductions ? fmtColones(b.deductions) : "—"}</td>
                  <td className="py-1 text-right tabular-nums">{b.products ? fmtColones(b.products) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {plan.openOutflows.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
          <p className="text-xs font-medium text-zinc-500">{t("outflowsTitle")}</p>
          {plan.openOutflows.map((o) => (
            <div key={o.sourceRow} className="flex flex-wrap items-center gap-3 text-sm">
              <span className="text-black dark:text-white">{[o.who, o.concept].filter(Boolean).join(" · ")}</span>
              <span className="tabular-nums text-zinc-500">{fmtColones(o.amount)}</span>
              <select
                aria-label={t("outflowsTitle")}
                value={outflowDecisions[String(o.sourceRow)] ?? ""}
                onChange={(e) => onOutflow(o.sourceRow, e.target.value)}
                className={`${selectCls} ml-auto`}
              >
                <option value="">
                  {t("salonExpense")}
                  {o.suggestedBarberId ? ` — ${t("maybe", { name: nameOf.get(o.suggestedBarberId) ?? "" })}` : ""}
                </option>
                {barbers.map((b) => (
                  <option key={b.id} value={b.id}>{t("chargeTo", { name: b.name })}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}

      {warnings.length > 0 && (
        <ul className="flex flex-col gap-1 border-t border-zinc-100 pt-3 text-xs text-amber-700 dark:border-zinc-800 dark:text-amber-400">
          {warnings.map((w) => (
            <li key={w.key} className="flex items-start gap-1.5">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              {t(`warning.${w.code}`, { ...w.values, name: w.barberId ? (nameOf.get(w.barberId) ?? "") : "", count: w.count, rows: w.rows })}
            </li>
          ))}
        </ul>
      )}

      {p.status !== "blocked" && plan.warnings.length === 0 && plan.openOutflows.length === 0 && (
        <p className="flex items-center gap-1.5 text-xs text-green-700 dark:text-green-400">
          <CheckCircle2 size={13} /> {t("clean")}
        </p>
      )}
    </section>
  );
}

type GroupedWarning = {
  key: string;
  code: ImportWarning["code"];
  barberId?: string;
  count: number;
  rows: string;
  values: Record<string, string | number>;
};

/** One line per kind of warning (and per barber/rate), with the source rows. */
function groupWarnings(warnings: ImportWarning[]): GroupedWarning[] {
  const map = new Map<string, GroupedWarning>();
  for (const w of warnings) {
    const values = { ...(w.values ?? {}) };
    if (w.code === "rate_differs") {
      values.written = pct(values.written);
      values.applied = pct(values.applied);
    }
    if (w.code === "date_from_internal" || w.code === "internal_date_mismatch") {
      for (const k of ["date", "fileDate", "internalDate"]) if (values[k]) values[k] = fmtDay(String(values[k]));
    }
    if (w.code === "total_mismatch") {
      values.parsed = fmtColones(Number(values.parsed));
      values.sheet = fmtColones(Number(values.sheet));
    }
    if (w.code === "service_received_by_non_professional" || w.code === "cash_difference") values.amount = fmtColones(Number(values.amount));
    const groupable = ["rate_differs", "missing_rate", "pending_method", "missing_amount"].includes(w.code);
    const key = groupable ? `${w.code}|${w.barberId ?? ""}|${values.written ?? ""}|${values.applied ?? ""}` : `${w.code}|${w.sourceRow ?? ""}`;
    const g = map.get(key) ?? { key, code: w.code, barberId: w.barberId, count: 0, rows: "", values };
    g.count++;
    if (w.sourceRow) g.rows = g.rows ? `${g.rows}, ${w.sourceRow}` : String(w.sourceRow);
    map.set(key, g);
  }
  return [...map.values()];
}

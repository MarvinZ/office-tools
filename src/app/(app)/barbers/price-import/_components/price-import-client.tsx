"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AlertTriangle, CheckCircle2, Download, Upload } from "lucide-react";
import { applyPriceImportAction, previewPriceImportAction } from "../actions";
import { unwrap } from "@/lib/barbers/errors";
import type { PricePreview } from "@/services/barbers/price-import";
import { fmtColones } from "@/lib/barbers/currency";

const pct = (n: number) => `${Math.round(n * 10000) / 100}%`;

/** Download the template → fill it → upload → review → apply. */
export default function PriceImportClient() {
  const t = useTranslations("barbers.priceImport");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PricePreview | null>(null);
  const [done, setDone] = useState<{ created: number; updated: number; skipped: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function form(f: File) {
    const fd = new FormData();
    fd.set("file", f);
    return fd;
  }

  function choose(f: File | null) {
    setFile(f);
    setPreview(null);
    setDone(null);
    setError(null);
    if (!f) return;
    startTransition(async () => {
      try {
        setPreview(await unwrap(previewPriceImportAction(form(f))));
      } catch (e) {
        setError(e instanceof Error ? e.message : t("errorGeneric"));
      }
    });
  }

  function apply() {
    if (!file) return;
    setError(null);
    startTransition(async () => {
      try {
        setDone(await unwrap(applyPriceImportAction(form(file))));
        setPreview(null);
        setFile(null);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : t("errorGeneric"));
      }
    });
  }

  const services = preview?.services.filter((s) => s.action !== "unchanged") ?? [];
  const products = preview?.products.filter((p) => p.action !== "unchanged") ?? [];
  const unchanged =
    (preview?.services.filter((s) => s.action === "unchanged").length ?? 0) +
    (preview?.products.filter((p) => p.action === "unchanged").length ?? 0);
  const locationName = new Map(preview?.locations.map((l) => [l.id, l.name]) ?? []);
  const changes = services.length + products.length;
  const badge = (a: string) =>
    a === "create"
      ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
      : "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300";
  const th = "px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500";

  return (
    <div className="flex flex-col gap-6">
      <ol className="grid gap-3 md:grid-cols-2">
        <li className="flex flex-col gap-2 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
          <span className="text-sm font-semibold text-black dark:text-white">{t("step1")}</span>
          <p className="text-sm text-zinc-500">{t("step1Hint")}</p>
          <a
            href="/barbers/price-import/template"
            className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-700 hover:text-black dark:border-zinc-700 dark:text-zinc-300 dark:hover:text-white"
          >
            <Download size={14} /> {t("download")}
          </a>
        </li>
        <li className="flex flex-col gap-2 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
          <span className="text-sm font-semibold text-black dark:text-white">{t("step2")}</span>
          <p className="text-sm text-zinc-500">{t("step2Hint")}</p>
          <label className="inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-lg bg-black px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200">
            <Upload size={14} /> {file ? file.name : t("upload")}
            <input
              id="priceFile"
              type="file"
              accept=".xlsx"
              className="sr-only"
              onChange={(e) => choose(e.target.files?.[0] ?? null)}
            />
          </label>
        </li>
      </ol>

      {pending && <p className="text-sm text-zinc-500">{t("working")}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {done && (
        <p className="flex items-center gap-1.5 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300">
          <CheckCircle2 size={16} /> {t("done", done)}
        </p>
      )}

      {preview && (
        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-zinc-600 dark:text-zinc-300">{t("summary", { changes, unchanged })}</p>
            <button
              onClick={apply}
              disabled={pending || changes === 0}
              className="ml-auto rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
            >
              {t("apply", { count: changes })}
            </button>
          </div>

          {preview.issues.length > 0 && (
            <ul className="flex flex-col gap-1 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
              {preview.issues.map((i, k) => (
                <li key={k} className="flex items-start gap-1.5">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                  {i.row ? `${t(`sheet.${i.sheet}`)} · ${t("row", { row: i.row })}: ` : ""}
                  {t(`issue.${i.code}`, i.values ?? {})}
                </li>
              ))}
            </ul>
          )}

          {services.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
                      <th className={th}>{t("services")}</th>
                      <th className={th}>{t("category")}</th>
                      <th className={th}>{t("commission")}</th>
                      <th className={th}>{t("prices")}</th>
                      <th className={th}></th>
                    </tr>
                  </thead>
                  <tbody className="text-zinc-600 dark:text-zinc-300">
                    {services.map((s) => (
                      <tr key={s.row} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
                        <td className="px-3 py-2 font-medium text-black dark:text-white">{s.name}</td>
                        <td className="px-3 py-2">{s.category ?? "—"}</td>
                        <td className="px-3 py-2 tabular-nums">{s.rate != null ? pct(s.rate) : "—"}</td>
                        <td className="px-3 py-2 tabular-nums">
                          {Object.entries(s.prices)
                            .map(([loc, price]) => `${locationName.get(loc)}: ${fmtColones(price)}`)
                            .join(" · ") || "—"}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge(s.action)}`}>{t(`action.${s.action}`)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {products.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
                      <th className={th}>{t("products")}</th>
                      <th className={th}>{t("price")}</th>
                      <th className={th}>{t("commission")}</th>
                      <th className={th}>{t("iva")}</th>
                      <th className={th}></th>
                    </tr>
                  </thead>
                  <tbody className="text-zinc-600 dark:text-zinc-300">
                    {products.map((p) => (
                      <tr key={p.row} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
                        <td className="px-3 py-2 font-medium text-black dark:text-white">{p.name}</td>
                        <td className="px-3 py-2 tabular-nums">{p.price != null ? fmtColones(p.price) : "—"}</td>
                        <td className="px-3 py-2 tabular-nums">{p.commission != null ? fmtColones(p.commission) : "—"}</td>
                        <td className="px-3 py-2">{p.chargesIva == null ? "—" : t(p.chargesIva ? "yes" : "no")}</td>
                        <td className="px-3 py-2 text-right">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge(p.action)}`}>{t(`action.${p.action}`)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

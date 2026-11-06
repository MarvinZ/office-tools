/**
 * Normalizers for values typed by cashiers into the daily closing workbook
 * ("CIERRE DD-MM-AAAA.xlsx"). Pure and tolerant: anything unrecognized comes
 * back as a clear "unknown" result for the import preview to flag — nothing is
 * guessed silently. The original text is always kept by the caller.
 */

export type ClosingPaymentMethod = "EFECTIVO" | "SINPE MOVIL" | "TARJETA" | "CREDITO" | "PENDIENTE";

/** Uppercase, accents stripped, punctuation → space, whitespace collapsed. */
export function normalizeText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

/**
 * Spec §4.3 col G. Anything unrecognized (blank, typo) is PENDIENTE, which the
 * spec allows to be imported but must stay visible as an alert.
 */
export function normalizePaymentMethod(value: unknown): ClosingPaymentMethod {
  const v = normalizeText(value);
  if (!v) return "PENDIENTE";
  if (v.startsWith("EFECT") || v === "CASH") return "EFECTIVO";
  if (v.includes("SINPE")) return "SINPE MOVIL";
  if (v.startsWith("TARJ") || v.includes("DATAFONO") || v === "CARD") return "TARJETA";
  if (v.startsWith("CRED")) return "CREDITO";
  return "PENDIENTE";
}

/**
 * Spec §4.3 col F: the written percentage. Cashiers write 50, 0.5 or "50%";
 * all mean 0.50. Returns null when it isn't a usable rate (0 < rate ≤ 1).
 */
export function normalizeRate(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : parseFloat(String(value).replace("%", "").replace(",", ".").trim());
  if (!Number.isFinite(n) || n <= 0) return null;
  const rate = n > 1 ? n / 100 : n;
  return rate > 0 && rate <= 1 ? rate : null;
}

/**
 * Money as typed: numbers pass through; strings like "₡11.300" or "11,300.50"
 * are parsed. Returns null when there's no usable amount.
 */
export function normalizeAmount(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (value == null) return null;
  let s = String(value).replace(/[₡\s]/g, "");
  if (!s) return null;
  // "11.300" / "11.300,50" (es-CR) vs "11,300.50" (en): the last separator
  // followed by exactly 1–2 digits is the decimal point; the rest are grouping.
  const m = /[.,](\d{1,2})$/.exec(s);
  if (m) {
    s = s.slice(0, m.index).replace(/[.,]/g, "") + "." + m[1];
  } else {
    s = s.replace(/[.,]/g, "");
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

/** Barber identity for alias matching. */
export type AliasCandidate = { id: string; names: string[] };

/**
 * Match a name as written ("Bryan", "Lesli ") to one barber by exact match on
 * normalized first name, full name or any alias. Returns null when there's no
 * match or the match is ambiguous — the preview then asks for an alias rather
 * than the importer guessing.
 */
export function matchPerson(written: unknown, candidates: AliasCandidate[]): string | null {
  const key = normalizeText(written);
  if (!key) return null;
  const hits = candidates.filter((c) => c.names.some((n) => normalizeText(n) === key));
  return hits.length === 1 ? hits[0].id : null;
}

/**
 * Spec §4.2: the file name's date is the primary import date.
 * "CIERRE 29-10-2026.xlsx" → "2026-10-29". Tolerates "-", "." or "/" separators
 * and extra spaces; returns null if no valid date is found.
 */
export function dateFromClosingFileName(fileName: string): string | null {
  const m = /(\d{1,2})[-./](\d{1,2})[-./](\d{4})/.exec(fileName);
  if (!m) return null;
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

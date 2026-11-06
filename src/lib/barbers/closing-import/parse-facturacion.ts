import * as XLSX from "xlsx";
import {
  normalizeAmount,
  normalizePaymentMethod,
  normalizeRate,
  normalizeText,
  type ClosingPaymentMethod,
} from "./normalize";

/**
 * Parser for the FACTURACION sheet of a daily closing workbook, per the NOURA
 * spec §4.3:
 *
 *   A ticket id · B time · C professional/supplier · D service/product
 *   E amount charged · F written % · G payment method
 *
 * Data starts at row 6. There is no fixed last row (the spec's 6–124 is only
 * the current template): every row with anything in C–E is read, blank rows
 * are skipped, and a "TOTAL…" row ends nothing — it's just skipped.
 *
 * Structural only: this doesn't know who the barbers are. Matching names to
 * barbers, and telling services from supplier (Meterasa) product lines, is the
 * import service's job. Every row keeps its original text and source row
 * number for traceability.
 */

export const FACTURACION_SHEET = "FACTURACION";
const FIRST_DATA_ROW = 6; // 1-based, as Excel shows it

export type FacturacionIssue = "missing_person" | "missing_amount" | "invalid_rate" | "pending_method";

export type FacturacionRow = {
  sourceRow: number; // 1-based Excel row
  ticketId: string | null;
  time: string | null; // HH:MM
  personRaw: string;
  description: string;
  amount: number | null;
  rateRaw: string;
  rate: number | null; // 0–1
  methodRaw: string;
  method: ClosingPaymentMethod;
  issues: FacturacionIssue[];
};

export type FacturacionParseResult =
  | { ok: true; rows: FacturacionRow[] }
  | { ok: false; error: "sheet_not_found"; sheetNames: string[] };

function cellText(value: unknown): string {
  return value == null ? "" : String(value).trim();
}

/** Excel stores times as a fraction of a day; cashiers may also type "14:30". */
function normalizeTime(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const minutes = Math.round((value % 1) * 24 * 60);
    return `${String(Math.floor(minutes / 60) % 24).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  }
  const m = /^(\d{1,2})[:.](\d{2})/.exec(cellText(value));
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : null;
}

function findSheet(workbook: XLSX.WorkBook): XLSX.WorkSheet | null {
  const name = workbook.SheetNames.find((n) => normalizeText(n) === FACTURACION_SHEET);
  return name ? workbook.Sheets[name] : null;
}

export function parseFacturacion(workbook: XLSX.WorkBook): FacturacionParseResult {
  const sheet = findSheet(workbook);
  if (!sheet) return { ok: false, error: "sheet_not_found", sheetNames: workbook.SheetNames };

  // header: "A" keys every row by column letter; raw keeps numbers as numbers.
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    header: "A",
    range: FIRST_DATA_ROW - 1,
    raw: true,
    blankrows: true,
    defval: null,
  });

  const rows: FacturacionRow[] = [];
  raw.forEach((r, i) => {
    const personRaw = cellText(r.C);
    const description = cellText(r.D);
    const amountCell = r.E;
    if (!personRaw && !description && (amountCell == null || amountCell === "")) return;
    if (normalizeText(personRaw).startsWith("TOTAL") || normalizeText(description).startsWith("TOTAL")) return;

    const amount = normalizeAmount(amountCell);
    const rateRaw = cellText(r.F);
    const rate = normalizeRate(r.F);
    const methodRaw = cellText(r.G);
    const method = normalizePaymentMethod(r.G);

    const issues: FacturacionIssue[] = [];
    if (!personRaw) issues.push("missing_person");
    if (amount == null) issues.push("missing_amount");
    if (rateRaw && rate == null) issues.push("invalid_rate");
    if (method === "PENDIENTE") issues.push("pending_method");

    rows.push({
      sourceRow: FIRST_DATA_ROW + i,
      ticketId: cellText(r.A) || null,
      time: normalizeTime(r.B),
      personRaw,
      description,
      amount,
      rateRaw,
      rate,
      methodRaw,
      method,
      issues,
    });
  });

  return { ok: true, rows };
}

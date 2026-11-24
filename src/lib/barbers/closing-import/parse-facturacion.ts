import * as XLSX from "xlsx";
import {
  normalizeAmount,
  normalizePaymentMethod,
  normalizeRate,
  normalizeText,
  excelSerialToDate,
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
  | {
      ok: true;
      rows: FacturacionRow[];
      /** The date the cashier typed in B3 (often yesterday's, when a file is copied). */
      internalDate: string | null;
      /** The sheet's own "TOTAL FACTURACION" figure, to check the parse against. */
      sheetTotal: number | null;
    }
  | { ok: false; error: "sheet_not_found"; sheetNames: string[] };

function cellText(value: unknown): string {
  return value == null ? "" : String(value).trim();
}

/**
 * The shop opens in the morning, so an hour before this is an afternoon time
 * typed on a 12-hour clock without "pm" (real files store 1:24 pm as 01:24).
 */
const FIRST_OPENING_HOUR = 7;

/** Excel stores times as a fraction of a day; cashiers may also type "14:30". */
function normalizeTime(value: unknown): string | null {
  let hours: number;
  let minutes: number;
  if (typeof value === "number" && Number.isFinite(value)) {
    const total = Math.round((value % 1) * 24 * 60);
    hours = Math.floor(total / 60) % 24;
    minutes = total % 60;
  } else {
    const m = /^(\d{1,2})[:.](\d{2})/.exec(cellText(value));
    if (!m) return null;
    hours = Number(m[1]);
    minutes = Number(m[2]);
  }
  if (hours < FIRST_OPENING_HOUR) hours += 12;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
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
  let sheetTotal: number | null = null;
  raw.forEach((r, i) => {
    const personRaw = cellText(r.C);
    const description = cellText(r.D);
    const amountCell = r.E;
    if (!personRaw && !description && (amountCell == null || amountCell === "")) return;
    if (normalizeText(personRaw).startsWith("TOTAL") || normalizeText(description).startsWith("TOTAL")) {
      if (sheetTotal == null) sheetTotal = normalizeAmount(amountCell);
      return;
    }

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

  return { ok: true, rows, internalDate: excelSerialToDate(sheet["B3"]?.v), sheetTotal };
}

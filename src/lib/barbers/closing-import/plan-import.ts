import * as XLSX from "xlsx";
import Decimal from "decimal.js";
import { dateFromClosingFileName, matchPerson, normalizeText, type AliasCandidate, type ClosingPaymentMethod } from "./normalize";
import { parseFacturacion } from "./parse-facturacion";
import { parseCierreGeneral } from "./parse-cierre-general";

/**
 * Turns one daily closing workbook into exactly what would be imported, plus
 * everything a person must see or decide first. Pure: no DB, no I/O — the
 * import service feeds it the tenant's barbers and payment methods and writes
 * the result. Rules come from the spec and from the real Nov 2026 files:
 *
 * - Names are matched exactly (normalized), against barbers' names and
 *   aliases. Unknown names are never guessed: they become a question
 *   ("who is this?"), answered with a barber or "not a professional".
 * - Supplier lines (Meterasa, with its typos) are not services; they're counted
 *   apart for the supplier settlement.
 * - Commission rate: the barber's fixed rate when set (Genesis 60%, Maicol
 *   100%…), else the % the cashier wrote. A difference is a warning (§6.1).
 * - Any cash outflow made out to a professional is deducted from them
 *   ("vale", shampoo, "VALE IMARA MINOXIDIL" once assigned…). Other outflows
 *   are salon expenses unless someone assigns them.
 * - A service on credit is deducted from the professional who received it
 *   (§8.2); the one who performed it is paid through the FACTURACION line.
 */

export type ImportBarber = AliasCandidate & { fixedCommissionRate: number | null };

export type ImportPaymentMethod = { id: string; code: ClosingPaymentMethod; feeRate: number };

export type ImportDecisions = {
  /** normalized written name → barber id, or "ignore" (not a professional). */
  names?: Record<string, string>;
  /** outflow source row → barber id, or "salon". */
  outflows?: Record<string, string>;
};

export type PlannedActivity = {
  barberId: string;
  sourceRow: number;
  ticketId: string | null;
  time: string | null; // HH:MM, 24h
  description: string;
  priceCharged: number;
  writtenRate: number | null;
  commissionRate: number;
  method: ClosingPaymentMethod;
  paymentMethodId: string;
  feeRate: number;
};

export type PlannedDeduction = {
  barberId: string;
  sourceRow: number;
  amount: number;
  note: string;
  category: "vale" | "service_received";
};

export type PlannedProductCredit = {
  barberId: string;
  sourceRow: number;
  description: string;
  quantity: number;
  amount: number;
};

export type ImportWarning = {
  code:
    | "internal_date_mismatch"
    | "date_from_internal"
    | "total_mismatch"
    | "rate_differs"
    | "missing_rate"
    | "pending_method"
    | "missing_amount"
    | "service_received_by_non_professional";
  sourceRow?: number;
  barberId?: string;
  values?: Record<string, string | number>;
};

export type UnknownName = { key: string; written: string; where: "services" | "products" | "credit"; rows: number[] };

export type OpenOutflow = { sourceRow: number; who: string; concept: string; amount: number; suggestedBarberId: string | null };

export type ClosingPlan = {
  fileName: string;
  businessDate: string | null; // from the file name (spec §4.2), else the internal date
  internalDate: string | null;
  activities: PlannedActivity[];
  deductions: PlannedDeduction[];
  productCredits: PlannedProductCredit[];
  /** Questions that block the import until answered. */
  unknownNames: UnknownName[];
  /** Outflows not made out to a known professional: salon expense unless assigned. */
  openOutflows: OpenOutflow[];
  warnings: ImportWarning[];
  /** Fatal problems: missing sheets, no date. */
  errors: string[];
  totals: {
    billed: number; // all FACTURACION lines, as the sheet totals them
    services: number; // lines imported as services
    supplier: number; // supplier (Meterasa) lines
    salonOutflows: number;
  };
  cashiers: { shift1: string; shift2: string };
};

const SUPPLIER_KEYS = new Set(["METERASA", "METERSA", "METERESA", "METERAZA"]);

function isSupplier(written: string): boolean {
  return SUPPLIER_KEYS.has(normalizeText(written));
}

export function planClosingImport(input: {
  workbook: XLSX.WorkBook;
  fileName: string;
  barbers: ImportBarber[];
  paymentMethods: ImportPaymentMethod[];
  decisions?: ImportDecisions;
}): ClosingPlan {
  const { workbook, fileName, barbers, paymentMethods } = input;
  const nameDecisions = input.decisions?.names ?? {};
  const outflowDecisions = input.decisions?.outflows ?? {};

  const plan: ClosingPlan = {
    fileName,
    businessDate: dateFromClosingFileName(fileName),
    internalDate: null,
    activities: [],
    deductions: [],
    productCredits: [],
    unknownNames: [],
    openOutflows: [],
    warnings: [],
    errors: [],
    totals: { billed: 0, services: 0, supplier: 0, salonOutflows: 0 },
    cashiers: { shift1: "", shift2: "" },
  };

  const fact = parseFacturacion(workbook);
  const general = parseCierreGeneral(workbook);
  if (!fact.ok) plan.errors.push(`Sheet FACTURACION not found (sheets: ${fact.sheetNames.join(", ")}).`);
  if (!general.ok) plan.errors.push(`Sheet CIERRE GENERAL not found (sheets: ${general.sheetNames.join(", ")}).`);
  if (!fact.ok || !general.ok) return plan;

  plan.internalDate = fact.internalDate;
  plan.cashiers = general.data.cashiers;
  if (!plan.businessDate) {
    if (plan.internalDate) {
      plan.businessDate = plan.internalDate;
      plan.warnings.push({ code: "date_from_internal", values: { date: plan.internalDate } });
    } else {
      plan.errors.push("No date in the file name or in the sheet.");
    }
  } else if (plan.internalDate && plan.internalDate !== plan.businessDate) {
    plan.warnings.push({ code: "internal_date_mismatch", values: { fileDate: plan.businessDate, internalDate: plan.internalDate } });
  }

  const fixedRate = new Map(barbers.map((b) => [b.id, b.fixedCommissionRate]));
  const methodByCode = new Map(paymentMethods.map((m) => [m.code, m]));
  const unknown = new Map<string, UnknownName>();

  /** barber id, null when unknown (recorded as a question), "ignore" when declared not a professional. */
  function resolvePerson(written: string, where: UnknownName["where"], row: number): string | null {
    const key = normalizeText(written);
    const decided = nameDecisions[key];
    if (decided) return decided;
    const id = matchPerson(written, barbers);
    if (id) return id;
    const entry = unknown.get(key) ?? { key, written, where, rows: [] };
    entry.rows.push(row);
    unknown.set(key, entry);
    return null;
  }

  // ── FACTURACION: services ──
  let billed = new Decimal(0);
  let services = new Decimal(0);
  let supplier = new Decimal(0);
  for (const r of fact.rows) {
    if (r.amount == null) {
      plan.warnings.push({ code: "missing_amount", sourceRow: r.sourceRow });
      continue;
    }
    billed = billed.plus(r.amount);
    if (isSupplier(r.personRaw)) {
      supplier = supplier.plus(r.amount);
      continue;
    }
    if (!r.personRaw) continue; // flagged by the parser as missing_person; nothing to attribute
    const barberId = resolvePerson(r.personRaw, "services", r.sourceRow);
    if (!barberId || barberId === "ignore") continue;

    const fixed = fixedRate.get(barberId) ?? null;
    let commissionRate = fixed ?? r.rate;
    if (fixed != null && r.rate != null && Math.abs(fixed - r.rate) > 1e-9) {
      plan.warnings.push({ code: "rate_differs", sourceRow: r.sourceRow, barberId, values: { written: r.rate, applied: fixed } });
    }
    if (commissionRate == null) {
      plan.warnings.push({ code: "missing_rate", sourceRow: r.sourceRow, barberId });
      commissionRate = 0;
    }
    if (r.method === "PENDIENTE") plan.warnings.push({ code: "pending_method", sourceRow: r.sourceRow, barberId });
    const method = methodByCode.get(r.method);
    services = services.plus(r.amount);
    plan.activities.push({
      barberId,
      sourceRow: r.sourceRow,
      ticketId: r.ticketId,
      time: r.time,
      description: r.description,
      priceCharged: r.amount,
      writtenRate: r.rate,
      commissionRate,
      method: r.method,
      paymentMethodId: method?.id ?? "",
      feeRate: method?.feeRate ?? 0,
    });
  }

  if (fact.sheetTotal != null && !billed.equals(fact.sheetTotal)) {
    plan.warnings.push({ code: "total_mismatch", values: { parsed: billed.toNumber(), sheet: fact.sheetTotal } });
  }

  // ── Cash outflows: deductions for professionals, salon expenses otherwise ──
  let salonOutflows = new Decimal(0);
  for (const o of general.data.outflows) {
    const decided = outflowDecisions[String(o.sourceRow)];
    // "VALE MAICOL", "MAICOL" → exact name; "VALE IMARA MINOXIDIL" → only a suggestion.
    const who = normalizeText(o.who).replace(/^VALE\s+/, "");
    const exact = matchPerson(who, barbers);
    const barberId = decided ? (decided === "salon" ? null : decided) : exact;
    if (barberId) {
      plan.deductions.push({
        barberId,
        sourceRow: o.sourceRow,
        amount: o.amount,
        note: [o.who, o.concept].filter(Boolean).join(" · "),
        category: "vale",
      });
    } else {
      salonOutflows = salonOutflows.plus(o.amount);
      const firstWord = who.split(" ")[0];
      plan.openOutflows.push({
        ...o,
        suggestedBarberId: decided ? null : matchPerson(firstWord, barbers),
      });
    }
  }

  // ── Services on credit: deducted from the professional who received them ──
  for (const s of general.data.servicesOnCredit) {
    const receiverKey = normalizeText(s.client);
    const decided = nameDecisions[receiverKey];
    const receiver = decided ?? matchPerson(s.client, barbers);
    if (receiver && receiver !== "ignore") {
      plan.deductions.push({
        barberId: receiver,
        sourceRow: s.sourceRow,
        amount: s.amount,
        note: [s.detail, s.performer].filter(Boolean).join(" · "),
        category: "service_received",
      });
    } else {
      // A cashier or a customer (e.g. "LESLIE"): not part of professionals' pay.
      plan.warnings.push({
        code: "service_received_by_non_professional",
        sourceRow: s.sourceRow,
        values: { client: s.client, amount: s.amount },
      });
    }
  }

  // ── Products on credit: deducted from the professional ──
  for (const p of general.data.productsOnCredit) {
    if (!p.person) continue;
    const barberId = resolvePerson(p.person, "products", p.sourceRow);
    if (!barberId || barberId === "ignore") continue;
    plan.productCredits.push({
      barberId,
      sourceRow: p.sourceRow,
      description: p.product,
      quantity: p.quantity && p.quantity > 0 ? Math.round(p.quantity) : 1,
      amount: p.amount,
    });
  }

  plan.unknownNames = [...unknown.values()];
  plan.totals = {
    billed: billed.toNumber(),
    services: services.toNumber(),
    supplier: supplier.toNumber(),
    salonOutflows: salonOutflows.toNumber(),
  };
  return plan;
}

/** A plan can be imported when it has a date, no fatal errors and no open name questions. */
export function isPlanReady(plan: ClosingPlan): boolean {
  return plan.errors.length === 0 && plan.businessDate != null && plan.unknownNames.length === 0;
}

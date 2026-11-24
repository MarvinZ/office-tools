/**
 * Golden test: the real NOURA closings for 1–15 Nov 2026, imported and settled
 * by our code, against the accountant's slips for the same fortnight.
 *
 * The client files contain personal and bank data, so they are NOT in git
 * (docs/files/ and fixtures/noura/ are gitignored). This test reads them at
 * run time and is skipped wherever they aren't present (e.g. CI).
 */
import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { existsSync, readdirSync, readFileSync } from "fs";
import path from "path";
import { planClosingImport, isPlanReady, type ImportBarber, type ImportPaymentMethod } from "./plan-import";
import { dateFromClosingFileName } from "./normalize";
import { computeBarberSettlement, type BarberSettlementInput, type SettlementLine } from "../settlement";

const ROOT = process.cwd();
const DIRS = ["docs/files", "fixtures/noura/2026-11-1/cierres", "fixtures/noura/2026-11-1/contador"].map((d) => path.join(ROOT, d));
const files = DIRS.filter(existsSync).flatMap((d) => readdirSync(d).map((f) => path.join(d, f)));
const slipsFile = files.find((f) => path.basename(f).startsWith("Comprobantes DEL 01 AL 15 DE NOVIEMBRE 2026"));
const closings = new Map<string, string>(); // date → file (first copy wins)
for (const f of files) {
  const name = path.basename(f);
  if (!/^CIERRE/i.test(name)) continue;
  const date = dateFromClosingFileName(name);
  if (date && !closings.has(date)) closings.set(date, f);
}
const available = slipsFile != null && closings.size === 15;

// NOURA's configuration, as decided in Nov 2026 (see docs/barbers-module-status.md).
const PEOPLE = ["BERNAL", "BRAYAN", "GENESIS", "IMARA", "JORGE", "JOSHUA", "MAICOL", "RAQUEL", "ZOE"];
const FIXED: Record<string, number> = { GENESIS: 0.6, BERNAL: 0.5, JOSHUA: 0.5, MAICOL: 1, BRAYAN: 1 };
const EXEMPT = new Set(["IMARA", "RAQUEL", "BRAYAN"]);
const PAID_WITHOUT_IVA = new Set(["JORGE", "RAQUEL", "ZOE"]);
const SLIP_NAME: Record<string, string> = { MAICOL: "MICHAEL", ZOE: "ZOILA", BRAYAN: "BRYAN" };

const barbers: ImportBarber[] = PEOPLE.map((p) => ({ id: p, names: [p], fixedCommissionRate: FIXED[p] ?? null }));
const methods: ImportPaymentMethod[] = [
  { id: "cash", code: "EFECTIVO", feeRate: 0 },
  { id: "card", code: "TARJETA", feeRate: 0.065 },
  { id: "sinpe", code: "SINPE MOVIL", feeRate: 0 },
  { id: "credit", code: "CREDITO", feeRate: 0 },
  { id: "pending", code: "PENDIENTE", feeRate: 0 },
];
// The one outflow a person has to assign by hand: "VALE IMARA MINOXIDIL" (1 Nov, row 20).
const DECISIONS: Record<string, { outflows: Record<string, string> }> = { "2026-11-01": { outflows: { "20": "IMARA" } } };

/** "Recibira Pago de Recursos por:" per slip, keyed by the slip's first name. */
function accountantTransfers(file: string): Map<string, number> {
  const wb = XLSX.read(readFileSync(file));
  const out = new Map<string, number>();
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const range = XLSX.utils.decode_range(ws["!ref"]!);
    for (let c = range.s.c; c <= range.e.c; c++) {
      let person: string | null = null;
      for (let r = range.s.r; r <= range.e.r; r++) {
        const v = ws[XLSX.utils.encode_cell({ r, c })]?.v;
        if (typeof v !== "string") continue;
        if (v.startsWith("Nombre Mini Empresa")) person = String(ws[XLSX.utils.encode_cell({ r, c: c + 1 })]?.v ?? "").split(" ")[0];
        if (person && v.startsWith("Recibira Pago")) {
          for (let k = 1; k <= 3; k++) {
            const n = ws[XLSX.utils.encode_cell({ r, c: c + k })]?.v;
            if (typeof n === "number") { out.set(person, n); break; }
          }
          person = null;
        }
      }
    }
  }
  return out;
}

describe.skipIf(!available)("NOURA 1–15 Nov 2026 vs the accountant (local client files)", () => {
  it("imports all 15 days and reproduces each payment, except known data gaps", () => {
    const inputs = new Map<string, Omit<BarberSettlementInput, "profile">>(
      PEOPLE.map((p) => [p, { lines: [], vales: [], productCredit: [], tips: [], servicesReceived: [] }])
    );
    for (const [date, file] of [...closings].sort()) {
      const plan = planClosingImport({
        workbook: XLSX.read(readFileSync(file)),
        fileName: path.basename(file),
        barbers,
        paymentMethods: methods,
        decisions: DECISIONS[date],
      });
      expect(isPlanReady(plan), `${date}: ${JSON.stringify(plan.unknownNames)}`).toBe(true);
      for (const a of plan.activities) {
        inputs.get(a.barberId)!.lines.push({
          date,
          priceCharged: a.priceCharged,
          commissionRate: a.commissionRate,
          paymentMethodFeeRate: a.feeRate,
        } satisfies SettlementLine);
      }
      for (const d of plan.deductions) {
        const input = inputs.get(d.barberId)!;
        (d.category === "service_received" ? input.servicesReceived! : input.vales).push(d.amount);
      }
      for (const p of plan.productCredits) inputs.get(p.barberId)!.productCredit.push(p.amount);
    }

    const expected = accountantTransfers(slipsFile!);
    const deltas: Record<string, number> = {};
    for (const p of PEOPLE) {
      const s = computeBarberSettlement(
        {
          ...inputs.get(p)!,
          profile: {
            appliesMaintenance: !EXEMPT.has(p),
            ivaBaseRate: p === "MAICOL" ? 0.5 : 1,
            ivaInformative: PAID_WITHOUT_IVA.has(p),
            fortnightlyAddition: 0,
            shortfallToSalary: p === "BRAYAN",
          },
        },
        { ivaRate: 0.13, maintenanceDailyFee: 1000, cardFeeOnGross: true }
      );
      const theirs = expected.get(SLIP_NAME[p] ?? p);
      expect(theirs, `no slip for ${p}`).toBeDefined();
      // The accountant's spreadsheet keeps sub-céntimo float values (e.g.
      // 281586.985); we round exact decimals to céntimos. ±₡0.01 is a match.
      const d = Math.round((s.transfer - theirs!) * 100) / 100;
      deltas[p] = Math.abs(d) <= 0.01 ? 0 : d;
    }

    // Exact matches, and three differences whose cause is known and outside our
    // control (the accountant added data that isn't in the daily closings, or
    // re-rated lines by category):
    //   MAICOL  +3,390.00  a ₡3,000 vale on 6 Nov isn't in that day's closing (+13% IVA)
    //   JOSHUA  +1,276.90  ₡1,130 of razors on 9 Nov aren't in that day's closing (+13% IVA)
    //   IMARA   −2,950.00  the accountant paid ₡29,500 of lines written at 50% at 60%
    expect(deltas).toEqual({
      BERNAL: 0,
      BRAYAN: 0,
      GENESIS: 0,
      IMARA: -2950,
      JORGE: 0,
      JOSHUA: 1276.9,
      MAICOL: 3390,
      RAQUEL: 0,
      ZOE: 0,
    });
  });
});

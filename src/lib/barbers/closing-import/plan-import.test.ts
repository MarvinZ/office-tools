import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { isPlanReady, planClosingImport, type ImportBarber, type ImportPaymentMethod } from "./plan-import";

// Synthetic closing in the real template's layout (no client data).
function closing(opts: {
  b3?: number; // Excel serial for FACTURACION!B3
  services: unknown[][]; // rows from row 6: A ticket, B time, C person, D service, E amount, F %, G method
  outflows?: [string, string, number][]; // G who, J concept, L amount (rows 17+)
  credit?: [string, string, string, number][]; // G performer, I detail, J client, L amount (rows 30+)
  products?: [string, number, string, string, number][]; // G product, H qty, I person, K vendor, L amount (rows 40+)
}): XLSX.WorkBook {
  const fact: unknown[][] = [["NOURA"], ["CONTROL FACTURACION DIARIA"], ["FECHA:", opts.b3 ?? null], [], ["#", "Hora", "Mini empresa", "Servicio", "Costo", "%", "Pago"], ...opts.services];
  const total = opts.services.reduce((n, r) => n + (typeof r[4] === "number" ? (r[4] as number) : 0), 0);
  fact.push([], [null, null, null, "TOTAL FACTURACION", total]);

  const gen = XLSX.utils.aoa_to_sheet([[]]);
  const set = (addr: string, v: unknown) => XLSX.utils.sheet_add_aoa(gen, [[v]], { origin: addr });
  set("I5", "KAREN");
  set("K5", "LESLY");
  set("C8", total);
  (opts.outflows ?? []).forEach(([who, concept, amount], i) => {
    set(`G${17 + i}`, who);
    set(`J${17 + i}`, concept);
    set(`L${17 + i}`, amount);
  });
  set("G25", "TOTAL");
  (opts.credit ?? []).forEach(([performer, detail, client, amount], i) => {
    set(`G${30 + i}`, performer);
    set(`I${30 + i}`, detail);
    set(`J${30 + i}`, client);
    set(`L${30 + i}`, amount);
  });
  set("G35", "TOTAL");
  (opts.products ?? []).forEach(([product, qty, person, vendor, amount], i) => {
    set(`G${40 + i}`, product);
    set(`H${40 + i}`, qty);
    set(`I${40 + i}`, person);
    set(`K${40 + i}`, vendor);
    set(`L${40 + i}`, amount);
  });
  set("G46", "TOTAL");

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, gen, "CIERRE GENERAL");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(fact), "FACTURACION");
  return wb;
}

const BARBERS: ImportBarber[] = [
  { id: "ana", names: ["Ana"], fixedCommissionRate: 0.6 },
  { id: "beto", names: ["Beto", "Alberto"], fixedCommissionRate: null },
];
const METHODS: ImportPaymentMethod[] = [
  { id: "cash", code: "EFECTIVO", feeRate: 0 },
  { id: "card", code: "TARJETA", feeRate: 0.065 },
  { id: "sinpe", code: "SINPE MOVIL", feeRate: 0 },
  { id: "credit", code: "CREDITO", feeRate: 0 },
];
const NOV_14 = 46340; // Excel serial for 2026-11-14

function plan(wb: XLSX.WorkBook, fileName = "CIERRE 14-11-2026.xlsx", decisions = {}) {
  return planClosingImport({ workbook: wb, fileName, barbers: BARBERS, paymentMethods: METHODS, decisions });
}

describe("planClosingImport", () => {
  it("imports services, applies a fixed rate and flags the written one", () => {
    const p = plan(
      closing({
        b3: NOV_14,
        services: [
          ["1.", 0.5, "ANA", "CORTE", 4000, 0.5, "TARJETA"],
          ["2.", 0.0583333, "alberto", "BLOWER", 9000, 0.6, "SINPE"],
          ["3.", null, "METERSA", "NAVAJAS", 1130, 1, "CREDITO"],
        ],
      })
    );
    expect(isPlanReady(p)).toBe(true);
    expect(p.businessDate).toBe("2026-11-14");
    expect(p.activities).toHaveLength(2);
    expect(p.activities[0]).toMatchObject({ barberId: "ana", commissionRate: 0.6, writtenRate: 0.5, paymentMethodId: "card", feeRate: 0.065 });
    expect(p.activities[1]).toMatchObject({ barberId: "beto", commissionRate: 0.6, time: "13:24" }); // 1:24 typed without pm
    expect(p.warnings).toContainEqual({ code: "rate_differs", sourceRow: 6, barberId: "ana", values: { written: 0.5, applied: 0.6 } });
    expect(p.totals).toMatchObject({ billed: 14130, services: 13000, supplier: 1130 });
  });

  it("blocks on unknown names until someone decides who they are", () => {
    const wb = closing({ services: [["1.", null, "LUIS", "CORTE", 4000, 0.5, "EFECTIVO"]] });
    const first = plan(wb);
    expect(isPlanReady(first)).toBe(false);
    expect(first.unknownNames).toEqual([{ key: "LUIS", written: "LUIS", where: "services", rows: [6] }]);
    expect(plan(wb, undefined, { names: { LUIS: "beto" } }).activities[0].barberId).toBe("beto");
    const ignored = plan(wb, undefined, { names: { LUIS: "ignore" } });
    expect(isPlanReady(ignored)).toBe(true);
    expect(ignored.activities).toHaveLength(0);
  });

  it("deducts outflows made out to a professional; others stay salon unless assigned", () => {
    const wb = closing({
      services: [],
      outflows: [
        ["VALE BETO", "VALE", 5000],
        ["ANA", "CHAMPU SALON", 1800],
        ["VALE ANA TINTE", "VALE", 17000],
        ["ANA JEFA", "VALE", 575],
        ["SALIDA SALON", "PASTA", 2365],
      ],
    });
    const p = plan(wb);
    expect(p.deductions.map((d) => [d.barberId, d.amount])).toEqual([["beto", 5000], ["ana", 1800]]);
    expect(p.openOutflows.map((o) => [o.who, o.suggestedBarberId])).toEqual([
      ["VALE ANA TINTE", "ana"],
      ["ANA JEFA", "ana"],
      ["SALIDA SALON", null],
    ]);
    expect(p.totals.salonOutflows).toBe(17000 + 575 + 2365);
    // Assigning the product vale to Ana (and leaving "ANA JEFA" as salon) moves it.
    const decided = plan(wb, undefined, { outflows: { "19": "ana" } });
    expect(decided.deductions.find((d) => d.sourceRow === 19)).toMatchObject({ barberId: "ana", amount: 17000 });
  });

  it("services on credit are deducted from the professional who received them", () => {
    const p = plan(
      closing({
        services: [],
        credit: [
          ["ANA", "CORTE", "BETO", 4500],
          ["BETO", "CORTE NIÑO", "LESLIE", 3500],
        ],
      })
    );
    expect(p.deductions).toEqual([
      { barberId: "beto", sourceRow: 30, amount: 4500, note: "CORTE · ANA", category: "service_received" },
    ]);
    expect(p.warnings).toContainEqual({
      code: "service_received_by_non_professional",
      sourceRow: 31,
      values: { client: "LESLIE", amount: 3500 },
    });
  });

  it("products on credit become deductions for the professional", () => {
    const p = plan(closing({ services: [], products: [["NAVAJAS", 2, "Ana", "METERASA", 1130]] }));
    expect(p.productCredits).toEqual([{ barberId: "ana", sourceRow: 40, description: "NAVAJAS", quantity: 2, amount: 1130 }]);
  });

  it("warns when the date inside the file isn't the file name's date", () => {
    const p = plan(closing({ b3: NOV_14 - 1, services: [] }), "CIERRE 14-11- 2026.xlsx");
    expect(p.businessDate).toBe("2026-11-14");
    expect(p.warnings).toContainEqual({
      code: "internal_date_mismatch",
      values: { fileDate: "2026-11-14", internalDate: "2026-11-13" },
    });
  });
});

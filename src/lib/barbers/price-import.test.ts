import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { buildPriceTemplate, planPriceImport, type TemplateLabels } from "./price-import";

const LABELS: TemplateLabels = {
  servicesSheet: "Servicios",
  productsSheet: "Productos",
  name: "Nombre",
  category: "Categoría",
  commissionPct: "Comisión %",
  priceAt: (l) => `Precio ${l}`,
  price: "Precio sin IVA",
  commissionAmount: "Comisión ₡",
  chargesIva: "Gravar con IVA",
  yes: "Sí",
  no: "No",
};
const LOCATIONS = [{ id: "conce", name: "Concepción" }];
const SERVICES = [{ id: "s1", name: "Corte", category: "Barbería", rate: 0.5, prices: { conce: 4000 } }];
const PRODUCTS = [{ id: "p1", name: "Minoxidil", price: 10000, commission: 1000, chargesIva: true }];

function workbook(services: unknown[][], products: unknown[][]) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(services), "Servicios");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(products), "Productos");
  return wb;
}
const plan = (wb: XLSX.WorkBook) => planPriceImport({ workbook: wb, locations: LOCATIONS, services: SERVICES, products: PRODUCTS });

describe("price import", () => {
  it("the downloaded template, unchanged, plans no changes", () => {
    const wb = buildPriceTemplate({ locations: LOCATIONS, services: SERVICES, products: PRODUCTS, labels: LABELS });
    const p = plan(XLSX.read(XLSX.write(wb, { type: "buffer", bookType: "xlsx" })));
    expect(p.issues).toEqual([]);
    expect(p.services.map((s) => s.action)).toEqual(["unchanged"]);
    expect(p.products.map((s) => s.action)).toEqual(["unchanged"]);
  });

  it("updates by name (ignoring case and accents) and creates new ones", () => {
    const p = plan(
      workbook(
        [["Nombre", "Categoría", "Comisión %", "Precio Concepción"], ["CORTE", "Barbería", 50, 4500], ["Barba", "Barbería", 50, "₡3.000"]],
        [["Nombre", "Precio sin IVA", "Comisión ₡", "Gravar con IVA"], ["minoxidil", 12000, 1000, "sí"], ["Navajas", 565, 0, "No"]]
      )
    );
    expect(p.services).toMatchObject([
      { name: "CORTE", existingId: "s1", action: "update", prices: { conce: 4500 } },
      { name: "Barba", existingId: null, action: "create", rate: 0.5, prices: { conce: 3000 } },
    ]);
    expect(p.products).toMatchObject([
      { existingId: "p1", action: "update", price: 12000, chargesIva: true },
      { existingId: null, action: "create", price: 565, commission: 0, chargesIva: false },
    ]);
  });

  it("accepts a 0% commission (courtesy services)", () => {
    const p = plan(workbook([["Nombre", "Comisión %", "Precio Concepción"], ["Retoque", 0, 0]], [["Nombre"]]));
    expect(p.issues).toEqual([]);
    expect(p.services[0]).toMatchObject({ action: "create", rate: 0, prices: { conce: 0 } });
  });

  it("empty cells leave values as they are", () => {
    const p = plan(workbook([["Nombre", "Comisión %", "Precio Concepción"], ["Corte", "", ""]], [["Name", "Price", "Commission"], ["Minoxidil", "", ""]]));
    expect(p.services[0]).toMatchObject({ action: "unchanged", rate: undefined, prices: {} });
    expect(p.products[0]).toMatchObject({ action: "unchanged" });
  });

  it("reports bad rows instead of guessing", () => {
    const p = plan(
      workbook(
        [["Nombre", "Comisión %", "Precio Concepción"], ["Tinte", "", 9000], ["Corte", 250, 4000], ["Corte", 50, 4000]],
        [["Nombre", "Precio sin IVA", "Comisión ₡"], ["Gel", "", 100], ["Cera", 1000, 2000]]
      )
    );
    expect(p.issues.map((i) => `${i.sheet}:${i.row}:${i.code}`)).toEqual([
      "services:2:missing_rate",
      "services:3:invalid_rate",
      "services:4:duplicate_name",
      "products:2:invalid_price",
      "products:3:invalid_commission",
    ]);
  });

  it("explains a file without the expected sheets", () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["x"]]), "Hoja1");
    expect(plan(wb).issues).toEqual([{ sheet: "file", code: "no_sheets", values: { sheets: "Hoja1" } }]);
  });
});

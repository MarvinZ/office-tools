import * as XLSX from "xlsx";
import { normalizeAmount, normalizeRate, normalizeText } from "./closing-import/normalize";

/**
 * Load service and product prices from a simple Excel template (Nov 2026).
 *
 *   Sheet 1 (services): Name · Category · Commission % · one price column per location
 *   Sheet 2 (products): Name · Price without IVA · Commission ₡ · Charge with IVA (yes/no)
 *
 * Rows are matched to the catalog by normalized name (case and accents
 * ignored): existing ones are updated, new ones created. Nothing is deleted.
 * An empty cell means "leave as is". Pure: the service applies the plan.
 * Headers are recognized in Spanish or English, so a template downloaded in
 * either language works.
 */

export type PriceLocation = { id: string; name: string };
export type ExistingService = { id: string; name: string; category: string | null; rate: number; prices: Record<string, number> };
export type ExistingProduct = { id: string; name: string; price: number; commission: number; chargesIva: boolean };

export type TemplateLabels = {
  servicesSheet: string;
  productsSheet: string;
  name: string;
  category: string;
  commissionPct: string;
  priceAt: (location: string) => string;
  price: string;
  commissionAmount: string;
  chargesIva: string;
  yes: string;
  no: string;
};

/** The template, pre-filled with the current catalog so it doubles as an export. */
export function buildPriceTemplate(input: {
  locations: PriceLocation[];
  services: ExistingService[];
  products: ExistingProduct[];
  labels: TemplateLabels;
}): XLSX.WorkBook {
  const { locations, services, products, labels: l } = input;
  const servicesAoa: (string | number)[][] = [
    [l.name, l.category, l.commissionPct, ...locations.map((loc) => l.priceAt(loc.name))],
    ...services.map((s) => [
      s.name,
      s.category ?? "",
      Math.round(s.rate * 10000) / 100,
      ...locations.map((loc) => s.prices[loc.id] ?? ""),
    ]),
  ];
  const productsAoa: (string | number)[][] = [
    [l.name, l.price, l.commissionAmount, l.chargesIva],
    ...products.map((p) => [p.name, p.price, p.commission, p.chargesIva ? l.yes : l.no]),
  ];
  const wb = XLSX.utils.book_new();
  const ws1 = XLSX.utils.aoa_to_sheet(servicesAoa);
  ws1["!cols"] = [{ wch: 32 }, { wch: 16 }, { wch: 13 }, ...locations.map(() => ({ wch: 18 }))];
  const ws2 = XLSX.utils.aoa_to_sheet(productsAoa);
  ws2["!cols"] = [{ wch: 32 }, { wch: 16 }, { wch: 14 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, ws1, l.servicesSheet);
  XLSX.utils.book_append_sheet(wb, ws2, l.productsSheet);
  return wb;
}

export type PriceIssue = {
  sheet: "services" | "products" | "file";
  row?: number; // 1-based Excel row
  code: "no_sheets" | "no_name_column" | "invalid_rate" | "invalid_price" | "invalid_commission" | "duplicate_name" | "missing_rate";
  values?: Record<string, string | number>;
};

export type ServicePlan = {
  row: number;
  name: string;
  existingId: string | null;
  category: string | null | undefined; // undefined = leave as is
  rate: number | undefined;
  prices: Record<string, number>; // locationId → new price (only changed/new cells)
  action: "create" | "update" | "unchanged";
};

export type ProductPlan = {
  row: number;
  name: string;
  existingId: string | null;
  price: number | undefined;
  commission: number | undefined;
  chargesIva: boolean | undefined;
  action: "create" | "update" | "unchanged";
};

export type PricePlan = { services: ServicePlan[]; products: ProductPlan[]; issues: PriceIssue[] };

const SERVICE_SHEET = /^(SERVICIOS?|SERVICES?)$/;
const PRODUCT_SHEET = /^(PRODUCTOS?|PRODUCTS?)$/;

function rowsOf(ws: XLSX.WorkSheet): unknown[][] {
  return XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: null, blankrows: true });
}

/** Column index whose header starts with any of `prefixes` (normalized). */
function col(header: unknown[], prefixes: string[], exclude: string[] = []): number {
  return header.findIndex((h) => {
    const v = normalizeText(h);
    return prefixes.some((p) => v.startsWith(p)) && !exclude.some((x) => v.includes(x));
  });
}

function yesNo(value: unknown): boolean | undefined {
  const v = normalizeText(value);
  if (!v) return undefined;
  if (["SI", "S", "YES", "Y", "X", "1", "TRUE", "VERDADERO"].includes(v)) return true;
  if (["NO", "N", "0", "FALSE", "FALSO"].includes(v)) return false;
  return undefined;
}

const same = (a: number | undefined, b: number) => a == null || Math.abs(a - b) < 0.005;

export function planPriceImport(input: {
  workbook: XLSX.WorkBook;
  locations: PriceLocation[];
  services: ExistingService[];
  products: ExistingProduct[];
}): PricePlan {
  const plan: PricePlan = { services: [], products: [], issues: [] };
  const serviceSheet = input.workbook.SheetNames.find((n) => SERVICE_SHEET.test(normalizeText(n)));
  const productSheet = input.workbook.SheetNames.find((n) => PRODUCT_SHEET.test(normalizeText(n)));
  if (!serviceSheet && !productSheet) {
    plan.issues.push({ sheet: "file", code: "no_sheets", values: { sheets: input.workbook.SheetNames.join(", ") } });
    return plan;
  }

  // ── Services ──
  if (serviceSheet) {
    const rows = rowsOf(input.workbook.Sheets[serviceSheet]);
    const header = rows[0] ?? [];
    const iName = col(header, ["NOMBRE", "NAME", "SERVICIO", "SERVICE"]);
    const iCat = col(header, ["CATEG"]);
    const iRate = col(header, ["COMISION", "COMMISSION", "PORCENTAJE", "RATE"]);
    // A price column per location: its header contains the location's name.
    const locCols = input.locations
      .map((loc) => ({ loc, i: header.findIndex((h) => normalizeText(h).includes(normalizeText(loc.name))) }))
      .filter((c) => c.i >= 0);
    const byName = new Map(input.services.map((s) => [normalizeText(s.name), s]));
    const seen = new Set<string>();
    if (iName < 0) plan.issues.push({ sheet: "services", code: "no_name_column" });
    else
      rows.slice(1).forEach((r, k) => {
        const row = k + 2;
        const name = String(r[iName] ?? "").trim();
        if (!name) return;
        const key = normalizeText(name);
        if (seen.has(key)) return plan.issues.push({ sheet: "services", row, code: "duplicate_name", values: { name } });
        seen.add(key);
        const existing = byName.get(key) ?? null;

        let rate: number | undefined;
        const rateCell = iRate >= 0 ? r[iRate] : null;
        if (rateCell != null && rateCell !== "") {
          // 0% is a valid catalog rate (e.g. a courtesy touch-up); normalizeRate
          // rejects it because a written rate of 0 in a closing is a typo.
          const isZero = normalizeText(rateCell).replace(/ /g, "") === "0" || rateCell === 0;
          const parsed = isZero ? 0 : normalizeRate(rateCell);
          if (parsed == null) return plan.issues.push({ sheet: "services", row, code: "invalid_rate", values: { name } });
          rate = parsed;
        }
        if (!existing && rate == null) return plan.issues.push({ sheet: "services", row, code: "missing_rate", values: { name } });

        const prices: Record<string, number> = {};
        for (const { loc, i } of locCols) {
          const cell = r[i];
          if (cell == null || cell === "") continue;
          const price = normalizeAmount(cell);
          if (price == null || price < 0) {
            plan.issues.push({ sheet: "services", row, code: "invalid_price", values: { name, location: loc.name } });
            continue;
          }
          if (!existing || !same(existing.prices[loc.id], price) || existing.prices[loc.id] == null) prices[loc.id] = price;
        }

        const categoryCell = iCat >= 0 ? String(r[iCat] ?? "").trim() : undefined;
        const category = categoryCell === undefined ? undefined : categoryCell || null;
        const changed =
          !existing ||
          (rate != null && !same(rate, existing.rate)) ||
          (category !== undefined && (category ?? "") !== (existing.category ?? "")) ||
          Object.keys(prices).length > 0;
        plan.services.push({
          row,
          name,
          existingId: existing?.id ?? null,
          category,
          rate,
          prices,
          action: !existing ? "create" : changed ? "update" : "unchanged",
        });
      });
  }

  // ── Products ──
  if (productSheet) {
    const rows = rowsOf(input.workbook.Sheets[productSheet]);
    const header = rows[0] ?? [];
    const iName = col(header, ["NOMBRE", "NAME", "PRODUCTO", "PRODUCT"]);
    const iPrice = col(header, ["PRECIO", "PRICE"]);
    const iCommission = col(header, ["COMISION", "COMMISSION"]);
    const iIva = col(header, ["GRAVAR", "IVA", "CHARGE"], ["SIN IVA", "WITHOUT IVA", "PRECIO", "PRICE"]);
    const byName = new Map(input.products.map((p) => [normalizeText(p.name), p]));
    const seen = new Set<string>();
    if (iName < 0) plan.issues.push({ sheet: "products", code: "no_name_column" });
    else
      rows.slice(1).forEach((r, k) => {
        const row = k + 2;
        const name = String(r[iName] ?? "").trim();
        if (!name) return;
        const key = normalizeText(name);
        if (seen.has(key)) return plan.issues.push({ sheet: "products", row, code: "duplicate_name", values: { name } });
        seen.add(key);
        const existing = byName.get(key) ?? null;

        const read = (i: number) => (i >= 0 && r[i] != null && r[i] !== "" ? normalizeAmount(r[i]) : undefined);
        const price = read(iPrice);
        const commission = read(iCommission);
        if (price === null || (price != null && price < 0)) return plan.issues.push({ sheet: "products", row, code: "invalid_price", values: { name } });
        if (commission === null || (commission != null && commission < 0)) {
          return plan.issues.push({ sheet: "products", row, code: "invalid_commission", values: { name } });
        }
        if (!existing && price == null) return plan.issues.push({ sheet: "products", row, code: "invalid_price", values: { name } });
        const finalPrice = price ?? existing?.price ?? 0;
        if ((commission ?? existing?.commission ?? 0) > finalPrice) {
          return plan.issues.push({ sheet: "products", row, code: "invalid_commission", values: { name } });
        }
        const chargesIva = iIva >= 0 ? yesNo(r[iIva]) : undefined;
        const changed =
          !existing ||
          (price != null && !same(price, existing.price)) ||
          (commission != null && !same(commission, existing.commission)) ||
          (chargesIva != null && chargesIva !== existing.chargesIva);
        plan.products.push({
          row,
          name,
          existingId: existing?.id ?? null,
          price: price ?? undefined,
          commission: commission ?? undefined,
          chargesIva,
          action: !existing ? "create" : changed ? "update" : "unchanged",
        });
      });
  }
  return plan;
}

import { eq } from "drizzle-orm";
import * as XLSX from "xlsx";
import { db } from "@/db";
import { locationServices } from "@/db/schema";
import { listServices, createService, updateService } from "./catalog";
import { listLocations, setLocationServicePrice } from "./locations";
import { listProducts, createProduct, updateProduct } from "./products";
import { auditBarbers } from "./audit";
import {
  buildPriceTemplate,
  planPriceImport,
  type ExistingProduct,
  type ExistingService,
  type PricePlan,
  type PriceLocation,
  type TemplateLabels,
} from "@/lib/barbers/price-import";

/** Load services and products prices from Excel (lib/barbers/price-import.ts). */

async function loadCatalog(tenantId: string): Promise<{
  locations: PriceLocation[];
  services: ExistingService[];
  products: ExistingProduct[];
}> {
  const [locations, services, products, prices] = await Promise.all([
    listLocations(tenantId),
    listServices(tenantId),
    listProducts(tenantId),
    db.select().from(locationServices).where(eq(locationServices.tenantId, tenantId)),
  ]);
  const pricesByService = new Map<string, Record<string, number>>();
  for (const p of prices) {
    const m = pricesByService.get(p.serviceId) ?? {};
    m[p.locationId] = Number(p.price);
    pricesByService.set(p.serviceId, m);
  }
  return {
    locations: locations.filter((l) => l.status === "active").map((l) => ({ id: l.id, name: l.name })),
    services: services
      .filter((s) => s.status === "active")
      .map((s) => ({
        id: s.id,
        name: s.name,
        category: s.category,
        rate: Number(s.defaultCommissionRate),
        prices: pricesByService.get(s.id) ?? {},
      })),
    products: products
      .filter((p) => p.status === "active")
      .map((p) => ({ id: p.id, name: p.name, price: Number(p.price), commission: Number(p.commissionAmount), chargesIva: p.chargesIva })),
  };
}

/** The template as .xlsx bytes, pre-filled with the current catalog. */
export async function priceTemplate(tenantId: string, labels: TemplateLabels): Promise<Buffer> {
  const catalog = await loadCatalog(tenantId);
  return XLSX.write(buildPriceTemplate({ ...catalog, labels }), { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export type PricePreview = PricePlan & { locations: PriceLocation[] };

export async function previewPriceImport(tenantId: string, bytes: ArrayBuffer): Promise<PricePreview> {
  const catalog = await loadCatalog(tenantId);
  return { ...planPriceImport({ workbook: XLSX.read(bytes), ...catalog }), locations: catalog.locations };
}

/**
 * Apply the rows that are new or changed. Rows with problems are skipped (they
 * were shown in the preview). Returns how many were created and updated.
 */
export async function applyPriceImport(
  tenantId: string,
  userId: string,
  bytes: ArrayBuffer
): Promise<{ created: number; updated: number; skipped: number }> {
  const { services, products, issues } = await previewPriceImport(tenantId, bytes);
  let created = 0;
  let updated = 0;

  for (const s of services) {
    if (s.action === "unchanged") continue;
    let id = s.existingId;
    if (!id) {
      const row = await createService(tenantId, userId, {
        name: s.name,
        category: s.category ?? undefined,
        defaultCommissionRate: s.rate!,
        status: "active",
      });
      id = row.id;
      created++;
    } else {
      if (s.rate != null || s.category !== undefined) {
        await updateService(tenantId, id, {
          ...(s.rate != null ? { defaultCommissionRate: s.rate } : {}),
          ...(s.category !== undefined ? { category: s.category ?? undefined } : {}),
        });
      }
      updated++;
    }
    for (const [locationId, price] of Object.entries(s.prices)) {
      await setLocationServicePrice(tenantId, locationId, id, price);
    }
  }

  for (const p of products) {
    if (p.action === "unchanged") continue;
    if (!p.existingId) {
      await createProduct(tenantId, userId, {
        name: p.name,
        price: p.price!,
        commissionAmount: p.commission ?? 0,
        chargesIva: p.chargesIva ?? false,
        status: "active",
      });
      created++;
    } else {
      await updateProduct(tenantId, p.existingId, {
        ...(p.price != null ? { price: p.price } : {}),
        ...(p.commission != null ? { commissionAmount: p.commission } : {}),
        ...(p.chargesIva != null ? { chargesIva: p.chargesIva } : {}),
      });
      updated++;
    }
  }

  const skipped = issues.filter((i) => i.row != null).length;
  await auditBarbers(tenantId, userId, "catalog.pricesImported", { summary: { created, updated, skipped } });
  return { created, updated, skipped };
}

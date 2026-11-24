import { and, desc, eq } from "drizzle-orm";
import { put } from "@vercel/blob";
import * as XLSX from "xlsx";
import { db } from "@/db";
import { barberActivities, barberClosingFiles, barbers, barberVouchers, locations, paymentMethods, productSales } from "@/db/schema";
import { computeCommissionAmount } from "./activities";
import { getBarberSettings } from "./settings";
import { isFortnightClosed } from "./settlements";
import { auditBarbers } from "./audit";
import { loadRateContexts } from "./rate-changes";
import { scopeRateOn } from "@/lib/barbers/rate-schedule";
import { fortnightOf } from "@/lib/barbers/settlement";
import { normalizeText, paymentMethodCodeOfName, type ClosingPaymentMethod } from "@/lib/barbers/closing-import/normalize";
import {
  isPlanReady,
  planClosingImport,
  type ClosingPlan,
  type ImportBarber,
  type ImportDecisions,
  type ImportPaymentMethod,
} from "@/lib/barbers/closing-import/plan-import";
import { BarbersError, type BarbersErrorCode } from "@/lib/barbers/errors";

/**
 * Daily-closing import (spec §4): preview, then import. All the decisions
 * about what a file means live in the pure planner (lib/barbers/closing-import/
 * plan-import.ts); this service only loads the tenant's context, checks what's
 * already imported, and writes.
 *
 * Re-importing a date replaces that date's previous import in ONE atomic
 * db.batch (the neon-http driver has no interactive transactions): the old
 * file record is marked "replaced" and its rows are deleted, then the new
 * file and its rows are inserted.
 */

export type ClosingUpload = { name: string; bytes: ArrayBuffer };

/** Per-file answers: names are shared across files, outflows are per file. */
export type ClosingDecisions = {
  /** written-name key → barber id, "ignore", or "new" (create a professional). */
  names?: Record<string, string>;
  outflows?: Record<string, Record<string, string>>; // fileName → (row → barberId | "salon")
  /** Re-import files already imported unchanged (e.g. after changing rates). */
  reimport?: boolean;
};

/** Placeholder id for a professional that will be created on import. */
export const NEW_BARBER_PREFIX = "new:";

export type FileStatus = "new" | "replace" | "unchanged" | "blocked";

export type ClosingPreview = {
  fileName: string;
  sha256: string;
  status: FileStatus;
  replacesVersion: number | null;
  blockedReason: "fortnight_closed" | "not_ready" | "duplicate_date" | null;
  plan: ClosingPlan;
  /** Per-barber totals for the preview table. */
  byBarber: { barberId: string; services: number; billed: number; deductions: number; products: number }[];
};

export type ImportContext = {
  barbers: ImportBarber[];
  barberNames: Record<string, string>;
  paymentMethods: ImportPaymentMethod[];
  missingMethodCodes: ClosingPaymentMethod[];
};

const ALL_CODES: ClosingPaymentMethod[] = ["EFECTIVO", "SINPE MOVIL", "TARJETA", "CREDITO", "PENDIENTE"];
const DEFAULT_METHOD: Record<ClosingPaymentMethod, { name: string; feeRate: number }> = {
  EFECTIVO: { name: "Efectivo", feeRate: 0 },
  "SINPE MOVIL": { name: "SINPE Móvil", feeRate: 0 },
  TARJETA: { name: "Tarjeta", feeRate: 0.065 },
  CREDITO: { name: "Crédito", feeRate: 0 },
  PENDIENTE: { name: "Pendiente", feeRate: 0 },
};

async function sha256(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function loadImportContext(tenantId: string): Promise<ImportContext> {
  const [barberRows, methodRows] = await Promise.all([
    db.select().from(barbers).where(eq(barbers.tenantId, tenantId)),
    db.select().from(paymentMethods).where(and(eq(paymentMethods.tenantId, tenantId), eq(paymentMethods.status, "active"))),
  ]);
  const rates = await loadRateContexts(tenantId, barberRows.map((b) => b.id));
  const methods: ImportPaymentMethod[] = [];
  for (const m of methodRows) {
    const code = paymentMethodCodeOfName(m.name);
    if (code && !methods.some((x) => x.code === code)) methods.push({ id: m.id, code, feeRate: Number(m.feeRate) });
  }
  return {
    barbers: barberRows.map((b) => ({
      id: b.id,
      // First name, full name and every alias are accepted spellings.
      names: [b.firstName, `${b.firstName} ${b.lastName}`, ...b.aliases],
      fixedCommissionRate: b.fixedCommissionRate != null ? Number(b.fixedCommissionRate) : null,
      fixedRateOn: (date: string) => {
        const ctx = rates.get(b.id);
        return ctx ? scopeRateOn(ctx.changes, null, date, ctx.baselines.fixed) : null;
      },
    })),
    barberNames: Object.fromEntries(barberRows.map((b) => [b.id, `${b.firstName} ${b.lastName}`])),
    paymentMethods: methods,
    missingMethodCodes: ALL_CODES.filter((c) => !methods.some((m) => m.code === c)),
  };
}

function summarize(plan: ClosingPlan): ClosingPreview["byBarber"] {
  const map = new Map<string, ClosingPreview["byBarber"][number]>();
  const row = (id: string) => {
    let r = map.get(id);
    if (!r) map.set(id, (r = { barberId: id, services: 0, billed: 0, deductions: 0, products: 0 }));
    return r;
  };
  for (const a of plan.activities) {
    row(a.barberId).services++;
    row(a.barberId).billed += a.priceCharged;
  }
  for (const d of plan.deductions) row(d.barberId).deductions += d.amount;
  for (const p of plan.productCredits) row(p.barberId).products += p.amount;
  return [...map.values()];
}

export async function previewClosings(
  tenantId: string,
  locationId: string,
  uploads: ClosingUpload[],
  decisions: ClosingDecisions,
  context?: ImportContext
): Promise<ClosingPreview[]> {
  const ctx = context ?? (await loadImportContext(tenantId));
  const current = await db
    .select({ businessDate: barberClosingFiles.businessDate, sha256: barberClosingFiles.sha256, version: barberClosingFiles.version })
    .from(barberClosingFiles)
    .where(
      and(
        eq(barberClosingFiles.tenantId, tenantId),
        eq(barberClosingFiles.locationId, locationId),
        eq(barberClosingFiles.status, "imported")
      )
    );
  const currentByDate = new Map(current.map((c) => [c.businessDate, c]));
  const closedCache = new Map<string, boolean>();
  const seenDates = new Set<string>();

  const previews: ClosingPreview[] = [];
  for (const upload of uploads) {
    const hash = await sha256(upload.bytes);
    const fileDecisions: ImportDecisions = {
      names: Object.fromEntries(
        Object.entries(decisions.names ?? {}).map(([key, v]) => [key, v === "new" ? `${NEW_BARBER_PREFIX}${key}` : v])
      ),
      outflows: decisions.outflows?.[upload.name],
    };
    const plan = planClosingImport({
      workbook: XLSX.read(upload.bytes),
      fileName: upload.name,
      barbers: ctx.barbers,
      paymentMethods: ctx.paymentMethods,
      decisions: fileDecisions,
    });

    let status: FileStatus = "new";
    let blockedReason: ClosingPreview["blockedReason"] = null;
    let replacesVersion: number | null = null;
    const date = plan.businessDate;
    if (date) {
      const existing = currentByDate.get(date);
      if (existing?.sha256 === hash && !decisions.reimport) status = "unchanged";
      else if (existing) {
        status = "replace";
        replacesVersion = existing.version;
      }
      const fortnight = fortnightOf(date);
      const key = `${fortnight.from}`;
      if (!closedCache.has(key)) closedCache.set(key, await isFortnightClosed(tenantId, fortnight));
      if (status !== "unchanged" && closedCache.get(key)) {
        status = "blocked";
        blockedReason = "fortnight_closed";
      }
      if (seenDates.has(date) && status !== "unchanged") {
        status = "blocked";
        blockedReason = "duplicate_date";
      }
      seenDates.add(date);
    }
    if (status !== "unchanged" && status !== "blocked" && !isPlanReady(plan)) {
      status = "blocked";
      blockedReason = "not_ready";
    }
    previews.push({ fileName: upload.name, sha256: hash, status, replacesVersion, blockedReason, plan, byBarber: summarize(plan) });
  }
  return previews;
}

/** Create any payment method the closings use that the shop doesn't have yet. */
async function ensurePaymentMethods(tenantId: string, userId: string, missing: ClosingPaymentMethod[]): Promise<void> {
  if (missing.length === 0) return;
  await db.insert(paymentMethods).values(
    missing.map((code) => ({
      id: crypto.randomUUID(),
      tenantId,
      createdBy: userId,
      name: DEFAULT_METHOD[code].name,
      feeRate: String(DEFAULT_METHOD[code].feeRate),
      status: "active" as const,
      tags: [],
    }))
  );
}

/** Remember how names were resolved, so the next import matches them itself. */
async function saveNameDecisions(tenantId: string, userId: string, names: Record<string, string>, written: Map<string, string>) {
  const byBarber = new Map<string, string[]>();
  for (const [key, barberId] of Object.entries(names)) {
    if (barberId === "ignore") continue;
    const spelling = written.get(key);
    if (spelling) byBarber.set(barberId, [...(byBarber.get(barberId) ?? []), spelling]);
  }
  for (const [barberId, spellings] of byBarber) {
    const [row] = await db
      .select({ aliases: barbers.aliases })
      .from(barbers)
      .where(and(eq(barbers.tenantId, tenantId), eq(barbers.id, barberId)))
      .limit(1);
    if (!row) continue;
    const known = new Set(row.aliases.map((a) => normalizeText(a)));
    const added = spellings.filter((s) => !known.has(normalizeText(s)));
    if (added.length === 0) continue;
    const aliases = [...row.aliases, ...added];
    await db.update(barbers).set({ aliases, updatedAt: new Date() }).where(and(eq(barbers.tenantId, tenantId), eq(barbers.id, barberId)));
    await auditBarbers(tenantId, userId, "barber.paymentDetails", {
      barberId,
      entityId: barberId,
      changes: { aliases: [row.aliases.join(", "), aliases.join(", ")] },
      reason: "closing import",
    });
  }
}

export type ImportResult = { fileName: string; status: FileStatus; version?: number; error?: BarbersErrorCode };

/** "GENESIS" → a new active professional named "Genesis", audited. */
async function createProfessional(tenantId: string, userId: string, written: string): Promise<string> {
  const firstName = written
    .trim()
    .toLowerCase()
    .replace(/(^|\s)\p{L}/gu, (c) => c.toUpperCase());
  const id = crypto.randomUUID();
  await db.insert(barbers).values({ id, tenantId, firstName, lastName: "", createdBy: userId });
  await auditBarbers(tenantId, userId, "barber.updated", {
    barberId: id,
    entityId: id,
    changes: { firstName: [null, firstName] },
    reason: "created by closing import",
  });
  return id;
}

export async function importClosings(
  tenantId: string,
  userId: string,
  locationId: string,
  uploads: ClosingUpload[],
  decisions: ClosingDecisions
): Promise<ImportResult[]> {
  const [location] = await db
    .select({ id: locations.id })
    .from(locations)
    .where(and(eq(locations.tenantId, tenantId), eq(locations.id, locationId)))
    .limit(1);
  if (!location) throw new BarbersError("notFound");

  let ctx = await loadImportContext(tenantId);
  if (ctx.missingMethodCodes.length > 0) {
    await ensurePaymentMethods(tenantId, userId, ctx.missingMethodCodes);
    ctx = await loadImportContext(tenantId);
  }

  // Name answers become aliases (or new professionals) first, so the plans
  // below match on their own.
  const written = new Map<string, string>();
  for (const u of uploads) {
    const p = planClosingImport({ workbook: XLSX.read(u.bytes), fileName: u.name, barbers: ctx.barbers, paymentMethods: ctx.paymentMethods });
    for (const n of p.unknownNames) written.set(n.key, n.written);
  }
  const names = { ...(decisions.names ?? {}) };
  for (const [key, value] of Object.entries(names)) {
    if (value !== "new" || !written.has(key)) continue;
    names[key] = await createProfessional(tenantId, userId, written.get(key)!);
  }
  await saveNameDecisions(tenantId, userId, names, written);
  decisions = { ...decisions, names };
  ctx = await loadImportContext(tenantId);

  const previews = await previewClosings(tenantId, locationId, uploads, decisions, ctx);
  const { ivaRate } = await getBarberSettings(tenantId);
  const results: ImportResult[] = [];

  for (const [i, preview] of previews.entries()) {
    const { plan } = preview;
    if (preview.status === "unchanged" || preview.status === "blocked" || !plan.businessDate) {
      results.push({ fileName: preview.fileName, status: preview.status });
      continue;
    }
    try {
      const date = plan.businessDate;
      const blob = await put(`barbers/${tenantId}/closings/${date}-${preview.fileName}`, Buffer.from(uploads[i].bytes), {
        access: "public",
        addRandomSuffix: true, // the URL must not be guessable: the file holds client data
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const [previous] = await db
        .select({ id: barberClosingFiles.id, version: barberClosingFiles.version })
        .from(barberClosingFiles)
        .where(
          and(
            eq(barberClosingFiles.tenantId, tenantId),
            eq(barberClosingFiles.locationId, locationId),
            eq(barberClosingFiles.businessDate, date)
          )
        )
        .orderBy(desc(barberClosingFiles.version))
        .limit(1);

      const fileId = crypto.randomUUID();
      const version = (previous?.version ?? 0) + 1;
      const now = new Date();
      const at = (time: string | null) => new Date(`${date}T${time ?? "12:00"}:00.000-06:00`);

      const activityValues = plan.activities.map((a) => ({
        id: crypto.randomUUID(),
        tenantId,
        barberId: a.barberId,
        locationId,
        serviceId: null,
        description: a.description,
        paymentMethodId: a.paymentMethodId,
        customerName: null,
        priceCharged: String(a.priceCharged),
        commissionRate: String(a.commissionRate),
        paymentMethodFeeRate: String(a.feeRate),
        commissionAmount: String(computeCommissionAmount(a.priceCharged, a.commissionRate, ivaRate)),
        performedAt: at(a.time),
        closingFileId: fileId,
        sourceRow: a.sourceRow,
        ticketId: a.ticketId,
        writtenRate: a.writtenRate != null ? String(a.writtenRate) : null,
        createdBy: userId,
      }));
      const voucherValues = plan.deductions.map((d) => ({
        id: crypto.randomUUID(),
        tenantId,
        barberId: d.barberId,
        amount: String(d.amount),
        issuedDate: date,
        note: d.note,
        category: d.category,
        closingFileId: fileId,
        sourceRow: d.sourceRow,
        createdBy: userId,
      }));
      const productValues = plan.productCredits.map((p) => ({
        id: crypto.randomUUID(),
        tenantId,
        barberId: p.barberId,
        productId: null,
        description: p.description,
        quantity: p.quantity,
        unitPrice: String(Math.round((p.amount / p.quantity) * 100) / 100),
        totalAmount: String(p.amount),
        saleDate: date,
        closingFileId: fileId,
        sourceRow: p.sourceRow,
        createdBy: userId,
      }));

      const replacing = previous && preview.status === "replace";
      // One atomic batch, in this order: retire the old import (the partial
      // unique index allows one "imported" file per date), then write the new.
      const statements = [
        ...(replacing
          ? [
              db.update(barberClosingFiles).set({ status: "replaced", replacedAt: now })
                .where(and(eq(barberClosingFiles.tenantId, tenantId), eq(barberClosingFiles.id, previous.id))),
              db.delete(barberActivities).where(and(eq(barberActivities.tenantId, tenantId), eq(barberActivities.closingFileId, previous.id))),
              db.delete(barberVouchers).where(and(eq(barberVouchers.tenantId, tenantId), eq(barberVouchers.closingFileId, previous.id))),
              db.delete(productSales).where(and(eq(productSales.tenantId, tenantId), eq(productSales.closingFileId, previous.id))),
            ]
          : []),
        db.insert(barberClosingFiles).values({
          id: fileId,
          tenantId,
          locationId,
          businessDate: date,
          internalDate: plan.internalDate,
          fileName: preview.fileName,
          sha256: preview.sha256,
          blobUrl: blob.url,
          version,
          status: "imported",
          summary: {
            totals: plan.totals,
            cashiers: plan.cashiers,
            shifts: plan.shifts,
            counts: { services: activityValues.length, deductions: voucherValues.length, products: productValues.length },
            warnings: plan.warnings,
            salonOutflows: plan.openOutflows,
          },
          importedBy: userId,
        }),
        ...(activityValues.length ? [db.insert(barberActivities).values(activityValues)] : []),
        ...(voucherValues.length ? [db.insert(barberVouchers).values(voucherValues)] : []),
        ...(productValues.length ? [db.insert(productSales).values(productValues)] : []),
      ];
      await db.batch(statements as unknown as Parameters<typeof db.batch>[0]);

      await auditBarbers(tenantId, userId, "closing.imported", {
        entityId: fileId,
        summary: { date, file: preview.fileName, version, services: activityValues.length },
      });
      results.push({ fileName: preview.fileName, status: preview.status, version });
    } catch (err) {
      console.error("[closing-import]", preview.fileName, err);
      results.push({
        fileName: preview.fileName,
        status: "blocked",
        // A code the screen translates (barbers.errors.*); never a raw DB message.
        error: err instanceof BarbersError ? err.code : "generic",
      });
    }
  }
  return results;
}

export type ClosingFileListItem = {
  id: string;
  businessDate: string;
  internalDate: string | null;
  fileName: string;
  version: number;
  importedAt: Date;
  services: number;
  billed: number;
  warnings: number;
};

/** Current (not replaced) imports, newest date first. */
export async function listClosingFiles(tenantId: string, limit = 60): Promise<ClosingFileListItem[]> {
  const rows = await db
    .select()
    .from(barberClosingFiles)
    .where(and(eq(barberClosingFiles.tenantId, tenantId), eq(barberClosingFiles.status, "imported")))
    .orderBy(desc(barberClosingFiles.businessDate))
    .limit(limit);
  return rows.map((r) => {
    const s = (r.summary ?? {}) as { totals?: { services?: number }; counts?: { services?: number }; warnings?: unknown[] };
    return {
      id: r.id,
      businessDate: r.businessDate,
      internalDate: r.internalDate,
      fileName: r.fileName,
      version: r.version,
      importedAt: r.importedAt,
      services: s.counts?.services ?? 0,
      billed: s.totals?.services ?? 0,
      warnings: s.warnings?.length ?? 0,
    };
  });
}

/** Barbers to offer when answering "who is this name?" in the preview. */
export async function listBarberChoices(tenantId: string) {
  const rows = await db
    .select({ id: barbers.id, firstName: barbers.firstName, lastName: barbers.lastName, status: barbers.status })
    .from(barbers)
    .where(eq(barbers.tenantId, tenantId))
    .orderBy(barbers.firstName);
  return rows.map((r) => ({ id: r.id, name: `${r.firstName} ${r.lastName}`, active: r.status === "active" }));
}

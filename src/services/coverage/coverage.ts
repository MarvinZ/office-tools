import { eq, and, sql, count } from "drizzle-orm";
import { db } from "@/db";
import { trades, coverageAreas } from "@/db/schema";
import type { InferSelectModel } from "drizzle-orm";
import type { Polygon } from "geojson";

export type TradeRow = InferSelectModel<typeof trades>;

export type CoverageAreaUI = {
  id: string;
  tenantId: string;
  tradeId: string;
  label: string | null;
  polygon: Polygon;
  createdBy: string;
  createdAt: string;
};

export type TradeWithCount = TradeRow & { areaCount: number };

// ── Queries ───────────────────────────────────────────────────────────────────

export async function listTrades(): Promise<TradeRow[]> {
  return db.select().from(trades).orderBy(trades.category, trades.name);
}

export async function listTradesWithCoverage(tenantId: string): Promise<TradeWithCount[]> {
  const rows = await db
    .select({
      trade: trades,
      areaCount: count(coverageAreas.id),
    })
    .from(trades)
    .leftJoin(
      coverageAreas,
      and(eq(coverageAreas.tradeId, trades.id), eq(coverageAreas.tenantId, tenantId))
    )
    .groupBy(trades.id)
    .orderBy(trades.category, trades.name);

  return rows.map(({ trade, areaCount }) => ({ ...trade, areaCount: Number(areaCount) }));
}

export async function getCoverageAreas(tenantId: string, tradeId: string): Promise<CoverageAreaUI[]> {
  const rows = await db
    .select({
      id: coverageAreas.id,
      tenantId: coverageAreas.tenantId,
      tradeId: coverageAreas.tradeId,
      label: coverageAreas.label,
      geojson: sql<string>`ST_AsGeoJSON(${coverageAreas.geom})`,
      createdBy: coverageAreas.createdBy,
      createdAt: coverageAreas.createdAt,
    })
    .from(coverageAreas)
    .where(and(eq(coverageAreas.tenantId, tenantId), eq(coverageAreas.tradeId, tradeId)))
    .orderBy(coverageAreas.createdAt);

  return rows.map((r) => ({
    id: r.id,
    tenantId: r.tenantId,
    tradeId: r.tradeId,
    label: r.label,
    polygon: JSON.parse(r.geojson) as Polygon,
    createdBy: r.createdBy,
    createdAt: r.createdAt.toISOString().slice(0, 10),
  }));
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export type CoverageAreaInput = {
  tradeId: string;
  label?: string | null;
  polygon: Polygon;
};

export async function createCoverageArea(
  tenantId: string,
  createdBy: string,
  data: CoverageAreaInput
): Promise<void> {
  const geojson = JSON.stringify(data.polygon);
  await db.execute(
    sql`INSERT INTO coverage_areas (id, tenant_id, trade_id, label, geom, created_by)
        VALUES (
          ${crypto.randomUUID()},
          ${tenantId},
          ${data.tradeId},
          ${data.label ?? null},
          ST_SetSRID(ST_GeomFromGeoJSON(${geojson}), 4326),
          ${createdBy}
        )`
  );
}

export async function updateCoverageArea(
  tenantId: string,
  id: string,
  data: { label?: string | null; polygon?: Polygon }
): Promise<void> {
  if (data.polygon) {
    const geojson = JSON.stringify(data.polygon);
    await db.execute(
      sql`UPDATE coverage_areas
          SET label = ${data.label ?? null},
              geom  = ST_SetSRID(ST_GeomFromGeoJSON(${geojson}), 4326),
              updated_at = now()
          WHERE id = ${id} AND tenant_id = ${tenantId}`
    );
  } else {
    await db
      .update(coverageAreas)
      .set({ label: data.label ?? null, updatedAt: new Date() })
      .where(and(eq(coverageAreas.id, id), eq(coverageAreas.tenantId, tenantId)));
  }
}

export async function deleteCoverageArea(tenantId: string, id: string): Promise<void> {
  await db
    .delete(coverageAreas)
    .where(and(eq(coverageAreas.id, id), eq(coverageAreas.tenantId, tenantId)));
}

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { barberSettings } from "@/db/schema";

export type BarberSettings = {
  ivaRate: number; // 0.13
  maintenanceDailyFee: number; // ₡ per day worked
};

/**
 * The tenant's shop-wide settlement settings. The row is created with the
 * schema defaults (13% IVA, ₡1,000/day maintenance) the first time it's read,
 * so callers never deal with a "not configured" state.
 */
export async function getBarberSettings(tenantId: string): Promise<BarberSettings> {
  let [row] = await db.select().from(barberSettings).where(eq(barberSettings.tenantId, tenantId)).limit(1);
  if (!row) {
    await db.insert(barberSettings).values({ tenantId }).onConflictDoNothing();
    [row] = await db.select().from(barberSettings).where(eq(barberSettings.tenantId, tenantId)).limit(1);
  }
  return {
    ivaRate: parseFloat(row.ivaRate),
    maintenanceDailyFee: parseFloat(row.maintenanceDailyFee),
  };
}

export async function updateBarberSettings(
  tenantId: string,
  updatedBy: string,
  data: BarberSettings
): Promise<BarberSettings> {
  if (!Number.isFinite(data.ivaRate) || data.ivaRate < 0 || data.ivaRate >= 1) {
    throw new Error("IVA rate must be a decimal between 0 and 1 (e.g. 0.13).");
  }
  if (!Number.isFinite(data.maintenanceDailyFee) || data.maintenanceDailyFee < 0) {
    throw new Error("Maintenance fee must be zero or a positive amount.");
  }

  const values = {
    ivaRate: String(data.ivaRate),
    maintenanceDailyFee: String(data.maintenanceDailyFee),
    updatedBy,
    updatedAt: new Date(),
  };
  await db
    .insert(barberSettings)
    .values({ tenantId, ...values })
    .onConflictDoUpdate({ target: barberSettings.tenantId, set: values });

  return { ivaRate: data.ivaRate, maintenanceDailyFee: data.maintenanceDailyFee };
}

import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { generateId } from "@/lib/ids";

/**
 * Best-effort audit write. It runs after the change it describes has already been saved, so a
 * failure here is logged rather than thrown: failing the request would make a client retry an
 * operation that already succeeded (e.g. adding a card twice).
 */
export async function recordAuditLog(
  tenantId: string,
  userId: string,
  action: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  try {
    await db.insert(auditLogs).values({ id: generateId(), tenantId, userId, action, metadata });
  } catch (err) {
    console.error("[audit] failed to record", action, err);
  }
}

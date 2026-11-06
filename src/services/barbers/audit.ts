import { and, desc, eq, like, sql } from "drizzle-orm";
import { clerkClient } from "@clerk/nextjs/server";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { recordAuditLog } from "@/services/audit";

/**
 * Audit trail for everything that affects what a barber is paid (spec §5
 * "Auditoría": entity, id, field, old value, new value, user, date, reason).
 *
 * Stored in the shared audit_logs table with actions prefixed "barbers.".
 * Writes are best-effort (see recordAuditLog): they run after the change is
 * saved, so a failed audit write never fails the user's action.
 */

export type BarberAuditAction =
  | "activity.logged"
  | "activity.status"
  | "activity.warranty"
  | "vale.created"
  | "vale.deleted"
  | "tip.created"
  | "tip.deleted"
  | "productSale.created"
  | "productSale.deleted"
  | "barber.updated"
  | "barber.settlementProfile"
  | "barber.paymentDetails"
  | "barber.rate"
  | "settings.updated"
  | "paymentMethod.updated"
  | "service.rate"
  | "fortnight.closed"
  | "fortnight.reopened"
  | "carryOver.created"
  | "carryOver.deleted";

/** field → [old, new]. Only fields that actually changed. */
export type AuditChanges = Record<string, [unknown, unknown]>;

export type BarberAuditDetails = {
  barberId?: string | null; // whose pay this touches, for the per-barber history
  entityId?: string;
  /** Short facts to show in the history line (amount, service name, period…). */
  summary?: Record<string, string | number | null>;
  changes?: AuditChanges;
  reason?: string | null;
};

const PREFIX = "barbers.";

export async function auditBarbers(
  tenantId: string,
  userId: string,
  action: BarberAuditAction,
  details: BarberAuditDetails
): Promise<void> {
  await recordAuditLog(tenantId, userId, PREFIX + action, details);
}

/**
 * The fields that differ between two snapshots of a record, as audit changes.
 * Values are compared as strings so numeric columns ("0.5000" vs 0.5) and
 * numbers compare sensibly.
 */
export function diffFields<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>,
  fields: (keyof T)[]
): AuditChanges {
  const norm = (v: unknown) => {
    if (v == null || v === "") return null;
    if (Array.isArray(v)) return v.join(", ");
    const n = typeof v === "number" ? v : typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : NaN;
    return Number.isFinite(n) ? n : String(v);
  };
  const changes: AuditChanges = {};
  for (const f of fields) {
    if (!(f in after)) continue;
    const a = norm(before[f]);
    const b = norm(after[f]);
    if (a !== b) changes[String(f)] = [a, b];
  }
  return changes;
}

export type BarberAuditEntry = {
  id: string;
  action: BarberAuditAction;
  userId: string;
  userName: string;
  createdAt: Date;
  details: BarberAuditDetails;
};

/** Newest first. With barberId, only entries touching that barber's pay. */
export async function listBarberAudit(
  tenantId: string,
  opts: { barberId?: string; limit?: number } = {}
): Promise<BarberAuditEntry[]> {
  const conditions = [eq(auditLogs.tenantId, tenantId), like(auditLogs.action, `${PREFIX}%`)];
  if (opts.barberId) conditions.push(sql`${auditLogs.metadata}->>'barberId' = ${opts.barberId}`);

  const rows = await db
    .select()
    .from(auditLogs)
    .where(and(...conditions))
    .orderBy(desc(auditLogs.createdAt))
    .limit(opts.limit ?? 100);

  const names = await userNames([...new Set(rows.map((r) => r.userId))]);
  return rows.map((r) => ({
    id: r.id,
    action: r.action.slice(PREFIX.length) as BarberAuditAction,
    userId: r.userId,
    userName: names.get(r.userId) ?? r.userId,
    createdAt: r.createdAt,
    details: (r.metadata ?? {}) as BarberAuditDetails,
  }));
}

/** Clerk user ids → display names, in one call. Falls back to the id. */
async function userNames(userIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (userIds.length === 0) return map;
  try {
    const clerk = await clerkClient();
    const { data } = await clerk.users.getUserList({ userId: userIds, limit: userIds.length });
    for (const u of data) {
      const name = [u.firstName, u.lastName].filter(Boolean).join(" ") || u.username || u.emailAddresses[0]?.emailAddress;
      if (name) map.set(u.id, name);
    }
  } catch (err) {
    console.error("[audit] couldn't resolve user names", err);
  }
  return map;
}

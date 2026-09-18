import { eq, and, count } from "drizzle-orm";
import { db } from "@/db";
import { paymentMethods } from "@/db/schema";
import type { InferSelectModel } from "drizzle-orm";

// ── Raw row types ─────────────────────────────────────────────────────────────

export type PaymentMethodRow = InferSelectModel<typeof paymentMethods>;

// ── Queries ───────────────────────────────────────────────────────────────────

export async function listPaymentMethods(tenantId: string): Promise<PaymentMethodRow[]> {
  return db
    .select()
    .from(paymentMethods)
    .where(eq(paymentMethods.tenantId, tenantId))
    .orderBy(paymentMethods.name);
}

export async function getPaymentMethod(
  tenantId: string,
  id: string
): Promise<PaymentMethodRow | null> {
  const [row] = await db
    .select()
    .from(paymentMethods)
    .where(and(eq(paymentMethods.tenantId, tenantId), eq(paymentMethods.id, id)))
    .limit(1);
  return row ?? null;
}

/**
 * CANONICAL resolver for a payment method's processing fee rate, mirroring
 * getEffectiveCommissionRate's shape. Returns null if the method can't be found
 * for this tenant.
 *
 * Like the commission-rate resolver, this deliberately does NOT filter by
 * status: given an exact paymentMethodId, the fee that applies is well-defined
 * even if the method has since been deactivated — historical corrections on
 * retired methods still need it. Offering only active methods is the concern of
 * whoever builds the picker list.
 */
export async function getPaymentMethodFeeRate(
  tenantId: string,
  paymentMethodId: string
): Promise<number | null> {
  const [row] = await db
    .select({ feeRate: paymentMethods.feeRate })
    .from(paymentMethods)
    .where(and(eq(paymentMethods.tenantId, tenantId), eq(paymentMethods.id, paymentMethodId)))
    .limit(1);

  return row ? parseFloat(row.feeRate) : null;
}

// ── Mutations ─────────────────────────────────────────────────────────────────
// Note: no delete function is implemented on purpose, matching services /
// locations / barbers. Once a payment method is referenced by barber_activities,
// hard-deleting it would corrupt historical payout records. Deactivating
// (status: "inactive") is the only supported way to retire one.

export type PaymentMethodInput = {
  name: string;
  feeRate: number;
  status: PaymentMethodRow["status"];
  tags?: string[];
};

export async function createPaymentMethod(
  tenantId: string,
  createdBy: string,
  data: PaymentMethodInput
): Promise<PaymentMethodRow> {
  const [row] = await db
    .insert(paymentMethods)
    .values({
      id: crypto.randomUUID(),
      tenantId,
      createdBy,
      name: data.name,
      feeRate: String(data.feeRate),
      status: data.status,
      tags: data.tags ?? [],
    })
    .returning();
  return row;
}

export async function updatePaymentMethod(
  tenantId: string,
  id: string,
  data: Partial<PaymentMethodInput>
): Promise<PaymentMethodRow | null> {
  const [row] = await db
    .update(paymentMethods)
    .set({
      ...data,
      feeRate: data.feeRate != null ? String(data.feeRate) : undefined,
      updatedAt: new Date(),
    })
    .where(and(eq(paymentMethods.tenantId, tenantId), eq(paymentMethods.id, id)))
    .returning();
  return row ?? null;
}

// ── Defaults ──────────────────────────────────────────────────────────────────

/**
 * The three payment methods every tenant starts with. These are seeded as
 * ORDINARY EDITABLE ROWS, not system constants: a tenant is free to rename them,
 * change their fee rates, add their own, or deactivate any of them. This array
 * only decides what exists on day one.
 *
 * "SINPE" is the Costa Rican instant-transfer rail and is a proper noun — it is
 * intentionally not translated.
 */
const DEFAULT_PAYMENT_METHODS: { name: string; feeRate: number }[] = [
  { name: "Cash", feeRate: 0 },
  { name: "SINPE", feeRate: 0.02 },
  { name: "Credit Card", feeRate: 0.06 },
];

/**
 * Idempotently ensure this tenant has payment methods to choose from. Guarded by
 * a count check rather than per-name upserts on purpose: once a tenant has ANY
 * payment method, this is a no-op forever — so a tenant who renamed "Cash" to
 * "Efectivo" or deleted nothing but deactivated it never gets the defaults
 * silently re-inserted underneath them.
 *
 * Called from the log page and the Payment Methods settings page so the entry
 * form can never render with an empty payment-method picker.
 */
export async function ensureDefaultPaymentMethods(
  tenantId: string,
  createdBy: string
): Promise<void> {
  const [existing] = await db
    .select({ n: count() })
    .from(paymentMethods)
    .where(eq(paymentMethods.tenantId, tenantId));

  if (Number(existing?.n ?? 0) > 0) return;

  await db
    .insert(paymentMethods)
    .values(
      DEFAULT_PAYMENT_METHODS.map((m) => ({
        id: crypto.randomUUID(),
        tenantId,
        createdBy,
        name: m.name,
        feeRate: String(m.feeRate),
        status: "active" as const,
        tags: [] as string[],
      }))
    )
    .onConflictDoNothing();
}

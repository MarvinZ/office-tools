import { eq, and, desc } from "drizzle-orm";
import { db } from "@/db";
import { webhookEndpoints, webhookEvents } from "@/db/schema";
import type { InferSelectModel } from "drizzle-orm";

// ── Raw row types ─────────────────────────────────────────────────────────────

export type WebhookEndpointRow = InferSelectModel<typeof webhookEndpoints>;
export type WebhookEventRow = InferSelectModel<typeof webhookEvents>;

// ── Queries ───────────────────────────────────────────────────────────────────

export async function getWebhookEndpoint(tenantId: string): Promise<WebhookEndpointRow | null> {
  const [row] = await db
    .select()
    .from(webhookEndpoints)
    .where(eq(webhookEndpoints.tenantId, tenantId))
    .limit(1);
  return row ?? null;
}

/** Lookup by endpoint id — used only by the public, unauthenticated ingest route. */
export async function getWebhookEndpointById(id: string): Promise<WebhookEndpointRow | null> {
  const [row] = await db
    .select()
    .from(webhookEndpoints)
    .where(eq(webhookEndpoints.id, id))
    .limit(1);
  return row ?? null;
}

export async function listWebhookEvents(tenantId: string): Promise<WebhookEventRow[]> {
  return db
    .select()
    .from(webhookEvents)
    .where(eq(webhookEvents.tenantId, tenantId))
    .orderBy(desc(webhookEvents.receivedAt));
}

export async function getWebhookEvent(tenantId: string, id: string): Promise<WebhookEventRow | null> {
  const [row] = await db
    .select()
    .from(webhookEvents)
    .where(and(eq(webhookEvents.tenantId, tenantId), eq(webhookEvents.id, id)))
    .limit(1);
  return row ?? null;
}

// ── Endpoint mutations ────────────────────────────────────────────────────────

export function generateSigningSecret(): string {
  return `whsec_${crypto.randomUUID().replace(/-/g, "")}`;
}

export async function createWebhookEndpoint(
  tenantId: string,
  createdBy: string,
  name: string
): Promise<WebhookEndpointRow> {
  const [row] = await db
    .insert(webhookEndpoints)
    .values({
      id: crypto.randomUUID(),
      tenantId,
      createdBy,
      name,
      signingSecret: generateSigningSecret(),
    })
    .returning();
  return row;
}

export async function renameWebhookEndpoint(
  tenantId: string,
  id: string,
  name: string
): Promise<WebhookEndpointRow | null> {
  const [row] = await db
    .update(webhookEndpoints)
    .set({ name, updatedAt: new Date() })
    .where(and(eq(webhookEndpoints.tenantId, tenantId), eq(webhookEndpoints.id, id)))
    .returning();
  return row ?? null;
}

export async function regenerateWebhookSecret(
  tenantId: string,
  id: string
): Promise<WebhookEndpointRow | null> {
  const [row] = await db
    .update(webhookEndpoints)
    .set({ signingSecret: generateSigningSecret(), updatedAt: new Date() })
    .where(and(eq(webhookEndpoints.tenantId, tenantId), eq(webhookEndpoints.id, id)))
    .returning();
  return row ?? null;
}

export async function setWebhookEndpointActive(
  tenantId: string,
  id: string,
  isActive: boolean
): Promise<WebhookEndpointRow | null> {
  const [row] = await db
    .update(webhookEndpoints)
    .set({ isActive, updatedAt: new Date() })
    .where(and(eq(webhookEndpoints.tenantId, tenantId), eq(webhookEndpoints.id, id)))
    .returning();
  return row ?? null;
}

// ── Event ingestion (called from the public, unauthenticated ingest route) ───

export async function recordWebhookEvent(data: {
  tenantId: string;
  endpointId: string;
  headers: Record<string, string>;
  body: unknown;
  rawBody: string;
  sourceIp: string | null;
  signatureValid: boolean;
}): Promise<WebhookEventRow> {
  const [row] = await db
    .insert(webhookEvents)
    .values({
      id: crypto.randomUUID(),
      tenantId: data.tenantId,
      endpointId: data.endpointId,
      headers: data.headers,
      body: data.body ?? null,
      rawBody: data.rawBody,
      sourceIp: data.sourceIp,
      signatureValid: data.signatureValid,
    })
    .returning();
  return row;
}

export async function deleteWebhookEvent(tenantId: string, id: string): Promise<void> {
  await db
    .delete(webhookEvents)
    .where(and(eq(webhookEvents.tenantId, tenantId), eq(webhookEvents.id, id)));
}

export async function clearWebhookEvents(tenantId: string): Promise<void> {
  await db.delete(webhookEvents).where(eq(webhookEvents.tenantId, tenantId));
}

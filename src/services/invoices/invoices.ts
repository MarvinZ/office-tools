import { eq, and, desc, count, gte } from "drizzle-orm";
import { db } from "@/db";
import { invoices, invoiceLineItems, invoiceActivity } from "@/db/schema";
import type { InferSelectModel } from "drizzle-orm";

// ── Raw DB types ──────────────────────────────────────────────────────────────

export type InvoiceRow = InferSelectModel<typeof invoices>;
export type InvoiceLineItemRow = InferSelectModel<typeof invoiceLineItems>;
export type InvoiceActivityRow = InferSelectModel<typeof invoiceActivity>;

// ── UI-ready types ────────────────────────────────────────────────────────────

export type InvoiceStatus = InvoiceRow["status"];
export type InvoiceActivityAction = InvoiceActivityRow["action"];

export type InvoiceLineItemUI = {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  position: number;
};

export type InvoiceActivityUI = {
  id: string;
  action: InvoiceActivityAction;
  date: string;
  note?: string;
};

export type InvoiceUI = {
  id: string;
  tenantId: string;
  clientId: string | null;
  quoteId: string | null;
  number: string;
  title: string;
  clientName: string;
  clientEmail: string;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string;
  currency: string;
  taxRate: number;
  subtotal: number;
  taxAmount: number;
  total: number;
  notes: string;
  createdBy: string;
  createdAt: string;
  lineItems: InvoiceLineItemUI[];
  activity: InvoiceActivityUI[];
};

export type InvoiceListItem = Omit<InvoiceUI, "lineItems" | "activity"> & {
  lineItemCount: number;
};

// ── Converters ────────────────────────────────────────────────────────────────

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function rowToUI(
  row: InvoiceRow,
  lineItems: InvoiceLineItemRow[],
  activity: InvoiceActivityRow[]
): InvoiceUI {
  return {
    id: row.id,
    tenantId: row.tenantId,
    clientId: row.clientId ?? null,
    quoteId: row.quoteId ?? null,
    number: row.number,
    title: row.title,
    clientName: row.clientName,
    clientEmail: row.clientEmail,
    status: row.status,
    issueDate: toDateString(row.issueDate),
    dueDate: toDateString(row.dueDate),
    currency: row.currency,
    taxRate: parseFloat(row.taxRate),
    subtotal: parseFloat(row.subtotal),
    taxAmount: parseFloat(row.taxAmount),
    total: parseFloat(row.total),
    notes: row.notes ?? "",
    createdBy: row.createdBy,
    createdAt: toDateString(row.createdAt),
    lineItems: lineItems
      .sort((a, b) => a.position - b.position)
      .map((li) => ({
        id: li.id,
        description: li.description,
        quantity: li.quantity,
        unitPrice: parseFloat(li.unitPrice),
        subtotal: parseFloat(li.subtotal),
        position: li.position,
      })),
    activity: activity
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((a) => ({
        id: a.id,
        action: a.action,
        date: toDateString(a.createdAt),
        note: a.note ?? undefined,
      })),
  };
}

// ── Number generation ─────────────────────────────────────────────────────────

async function nextInvoiceNumber(tenantId: string): Promise<string> {
  const year = new Date().getFullYear();
  const result = await db
    .select({ n: count() })
    .from(invoices)
    .where(
      and(
        eq(invoices.tenantId, tenantId),
        gte(invoices.createdAt, new Date(`${year}-01-01T00:00:00Z`))
      )
    );
  const n = (result[0]?.n ?? 0) + 1;
  return `INV-${year}-${String(n).padStart(3, "0")}`;
}

// ── Queries ───────────────────────────────────────────────────────────────────

export async function listInvoices(tenantId: string): Promise<InvoiceListItem[]> {
  const rows = await db
    .select({
      invoice: invoices,
      lineItemCount: count(invoiceLineItems.id),
    })
    .from(invoices)
    .leftJoin(invoiceLineItems, eq(invoiceLineItems.invoiceId, invoices.id))
    .where(eq(invoices.tenantId, tenantId))
    .groupBy(invoices.id)
    .orderBy(desc(invoices.createdAt));

  return rows.map(({ invoice: inv, lineItemCount }) => ({
    id: inv.id,
    tenantId: inv.tenantId,
    clientId: inv.clientId ?? null,
    quoteId: inv.quoteId ?? null,
    number: inv.number,
    title: inv.title,
    clientName: inv.clientName,
    clientEmail: inv.clientEmail,
    status: inv.status,
    issueDate: toDateString(inv.issueDate),
    dueDate: toDateString(inv.dueDate),
    currency: inv.currency,
    taxRate: parseFloat(inv.taxRate),
    subtotal: parseFloat(inv.subtotal),
    taxAmount: parseFloat(inv.taxAmount),
    total: parseFloat(inv.total),
    notes: inv.notes ?? "",
    createdBy: inv.createdBy,
    createdAt: toDateString(inv.createdAt),
    lineItemCount: Number(lineItemCount),
  }));
}

export async function getInvoice(tenantId: string, id: string): Promise<InvoiceUI | null> {
  const [invoiceRow] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.tenantId, tenantId), eq(invoices.id, id)))
    .limit(1);

  if (!invoiceRow) return null;

  const [items, acts] = await Promise.all([
    db.select().from(invoiceLineItems).where(eq(invoiceLineItems.invoiceId, id)).orderBy(invoiceLineItems.position),
    db.select().from(invoiceActivity).where(eq(invoiceActivity.invoiceId, id)).orderBy(invoiceActivity.createdAt),
  ]);

  return rowToUI(invoiceRow, items, acts);
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export type InvoiceInput = {
  clientId?: string | null;
  quoteId?: string | null;
  title: string;
  clientName: string;
  clientEmail: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  taxRate: number;
  subtotal: number;
  taxAmount: number;
  total: number;
  notes: string;
  tags?: string[];
  lineItems: { description: string; quantity: number; unitPrice: number; subtotal: number }[];
};

export async function createInvoice(
  tenantId: string,
  createdBy: string,
  data: InvoiceInput
): Promise<InvoiceUI> {
  const id = crypto.randomUUID();
  const number = await nextInvoiceNumber(tenantId);

  const [invoiceRow] = await db
    .insert(invoices)
    .values({
      id,
      tenantId,
      clientId: data.clientId ?? null,
      quoteId: data.quoteId ?? null,
      number,
      title: data.title,
      clientName: data.clientName,
      clientEmail: data.clientEmail,
      status: "draft",
      issueDate: new Date(data.issueDate),
      dueDate: new Date(data.dueDate),
      currency: data.currency,
      taxRate: String(data.taxRate),
      subtotal: String(data.subtotal),
      taxAmount: String(data.taxAmount),
      total: String(data.total),
      notes: data.notes || null,
      tags: data.tags ?? [],
      createdBy,
    })
    .returning();

  const lineItemRows = await db
    .insert(invoiceLineItems)
    .values(
      data.lineItems.map((li, i) => ({
        id: crypto.randomUUID(),
        invoiceId: id,
        tenantId,
        description: li.description,
        quantity: li.quantity,
        unitPrice: String(li.unitPrice),
        subtotal: String(li.subtotal),
        position: i,
      }))
    )
    .returning();

  const [actRow] = await db
    .insert(invoiceActivity)
    .values({ id: crypto.randomUUID(), invoiceId: id, tenantId, action: "created", userId: createdBy })
    .returning();

  return rowToUI(invoiceRow, lineItemRows, [actRow]);
}

export async function updateInvoice(
  tenantId: string,
  invoiceId: string,
  userId: string,
  data: InvoiceInput
): Promise<InvoiceUI | null> {
  const [invoiceRow] = await db
    .update(invoices)
    .set({
      clientId: data.clientId ?? null,
      title: data.title,
      clientName: data.clientName,
      clientEmail: data.clientEmail,
      issueDate: new Date(data.issueDate),
      dueDate: new Date(data.dueDate),
      currency: data.currency,
      taxRate: String(data.taxRate),
      subtotal: String(data.subtotal),
      taxAmount: String(data.taxAmount),
      total: String(data.total),
      notes: data.notes || null,
      updatedAt: new Date(),
    })
    .where(and(eq(invoices.tenantId, tenantId), eq(invoices.id, invoiceId)))
    .returning();

  if (!invoiceRow) return null;

  await db.delete(invoiceLineItems).where(eq(invoiceLineItems.invoiceId, invoiceId));
  const lineItemRows = await db
    .insert(invoiceLineItems)
    .values(
      data.lineItems.map((li, i) => ({
        id: crypto.randomUUID(),
        invoiceId,
        tenantId,
        description: li.description,
        quantity: li.quantity,
        unitPrice: String(li.unitPrice),
        subtotal: String(li.subtotal),
        position: i,
      }))
    )
    .returning();

  const [actRow] = await db
    .insert(invoiceActivity)
    .values({ id: crypto.randomUUID(), invoiceId, tenantId, action: "updated", userId })
    .returning();

  const prevActs = await db
    .select()
    .from(invoiceActivity)
    .where(and(eq(invoiceActivity.invoiceId, invoiceId), eq(invoiceActivity.tenantId, tenantId)))
    .orderBy(invoiceActivity.createdAt);

  return rowToUI(invoiceRow, lineItemRows, [...prevActs.filter((a) => a.id !== actRow.id), actRow]);
}

export type InvoiceStatusTransition = Exclude<InvoiceStatus, "draft">;

export async function updateInvoiceStatus(
  tenantId: string,
  invoiceId: string,
  userId: string,
  status: InvoiceStatusTransition,
  note?: string
): Promise<void> {
  await db
    .update(invoices)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(invoices.tenantId, tenantId), eq(invoices.id, invoiceId)));

  await db.insert(invoiceActivity).values({
    id: crypto.randomUUID(),
    invoiceId,
    tenantId,
    action: status,
    note: note ?? null,
    userId,
  });
}

export async function deleteInvoice(tenantId: string, invoiceId: string): Promise<void> {
  await db.delete(invoices).where(and(eq(invoices.tenantId, tenantId), eq(invoices.id, invoiceId)));
}

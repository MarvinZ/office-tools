import { eq, and, desc, count, gte } from "drizzle-orm";
import { db } from "@/db";
import { quotes, quoteLineItems, quoteActivity } from "@/db/schema";
import type { InferSelectModel } from "drizzle-orm";

// ── Raw DB types ──────────────────────────────────────────────────────────────

export type QuoteRow = InferSelectModel<typeof quotes>;
export type QuoteLineItemRow = InferSelectModel<typeof quoteLineItems>;
export type QuoteActivityRow = InferSelectModel<typeof quoteActivity>;

// ── UI-ready types (numeric strings converted to numbers) ─────────────────────

export type QuoteStatus = QuoteRow["status"];
export type QuoteActivityAction = QuoteActivityRow["action"];

export type QuoteLineItemUI = {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  position: number;
};

export type QuoteActivityUI = {
  id: string;
  action: QuoteActivityAction;
  date: string; // YYYY-MM-DD
  note?: string;
};

export type QuoteUI = {
  id: string;
  tenantId: string;
  number: string;
  title: string;
  clientName: string;
  clientEmail: string;
  status: QuoteStatus;
  issueDate: string;  // YYYY-MM-DD
  expiryDate: string; // YYYY-MM-DD
  currency: string;
  taxRate: number;
  subtotal: number;
  taxAmount: number;
  total: number;
  notes: string;
  createdBy: string;
  createdAt: string;
  lineItems: QuoteLineItemUI[];
  activity: QuoteActivityUI[];
};

export type QuoteListItem = Omit<QuoteUI, "lineItems" | "activity"> & {
  lineItemCount: number;
};

// ── Converters ────────────────────────────────────────────────────────────────

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function rowToUI(
  row: QuoteRow,
  lineItems: QuoteLineItemRow[],
  activity: QuoteActivityRow[]
): QuoteUI {
  return {
    id: row.id,
    tenantId: row.tenantId,
    number: row.number,
    title: row.title,
    clientName: row.clientName,
    clientEmail: row.clientEmail,
    status: row.status,
    issueDate: toDateString(row.issueDate),
    expiryDate: toDateString(row.expiryDate),
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

async function nextQuoteNumber(tenantId: string): Promise<string> {
  const year = new Date().getFullYear();
  const result = await db
    .select({ n: count() })
    .from(quotes)
    .where(
      and(
        eq(quotes.tenantId, tenantId),
        gte(quotes.createdAt, new Date(`${year}-01-01T00:00:00Z`))
      )
    );
  const n = (result[0]?.n ?? 0) + 1;
  return `Q-${year}-${String(n).padStart(3, "0")}`;
}

// ── Queries ───────────────────────────────────────────────────────────────────

export async function listQuotes(tenantId: string): Promise<QuoteListItem[]> {
  const rows = await db
    .select({
      quote: quotes,
      lineItemCount: count(quoteLineItems.id),
    })
    .from(quotes)
    .leftJoin(quoteLineItems, eq(quoteLineItems.quoteId, quotes.id))
    .where(eq(quotes.tenantId, tenantId))
    .groupBy(quotes.id)
    .orderBy(desc(quotes.createdAt));

  return rows.map(({ quote: q, lineItemCount }) => ({
    id: q.id,
    tenantId: q.tenantId,
    number: q.number,
    title: q.title,
    clientName: q.clientName,
    clientEmail: q.clientEmail,
    status: q.status,
    issueDate: toDateString(q.issueDate),
    expiryDate: toDateString(q.expiryDate),
    currency: q.currency,
    taxRate: parseFloat(q.taxRate),
    subtotal: parseFloat(q.subtotal),
    taxAmount: parseFloat(q.taxAmount),
    total: parseFloat(q.total),
    notes: q.notes ?? "",
    createdBy: q.createdBy,
    createdAt: toDateString(q.createdAt),
    lineItemCount: Number(lineItemCount),
  }));
}

export async function getQuote(tenantId: string, id: string): Promise<QuoteUI | null> {
  const [quoteRow] = await db
    .select()
    .from(quotes)
    .where(and(eq(quotes.tenantId, tenantId), eq(quotes.id, id)))
    .limit(1);

  if (!quoteRow) return null;

  const [items, acts] = await Promise.all([
    db.select().from(quoteLineItems).where(eq(quoteLineItems.quoteId, id)).orderBy(quoteLineItems.position),
    db.select().from(quoteActivity).where(eq(quoteActivity.quoteId, id)).orderBy(quoteActivity.createdAt),
  ]);

  return rowToUI(quoteRow, items, acts);
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export type QuoteInput = {
  title: string;
  clientName: string;
  clientEmail: string;
  issueDate: string;
  expiryDate: string;
  currency: string;
  taxRate: number;
  subtotal: number;
  taxAmount: number;
  total: number;
  notes: string;
  lineItems: { description: string; quantity: number; unitPrice: number; subtotal: number }[];
};

export async function createQuote(
  tenantId: string,
  createdBy: string,
  data: QuoteInput
): Promise<QuoteUI> {
  const id = crypto.randomUUID();
  const number = await nextQuoteNumber(tenantId);

  const [quoteRow] = await db
    .insert(quotes)
    .values({
      id,
      tenantId,
      number,
      title: data.title,
      clientName: data.clientName,
      clientEmail: data.clientEmail,
      status: "draft",
      issueDate: new Date(data.issueDate),
      expiryDate: new Date(data.expiryDate),
      currency: data.currency,
      taxRate: String(data.taxRate),
      subtotal: String(data.subtotal),
      taxAmount: String(data.taxAmount),
      total: String(data.total),
      notes: data.notes || null,
      createdBy,
    })
    .returning();

  const lineItemRows = await db
    .insert(quoteLineItems)
    .values(
      data.lineItems.map((li, i) => ({
        id: crypto.randomUUID(),
        quoteId: id,
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
    .insert(quoteActivity)
    .values({ id: crypto.randomUUID(), quoteId: id, tenantId, action: "created", userId: createdBy })
    .returning();

  return rowToUI(quoteRow, lineItemRows, [actRow]);
}

export async function updateQuote(
  tenantId: string,
  quoteId: string,
  userId: string,
  data: QuoteInput
): Promise<QuoteUI | null> {
  const [quoteRow] = await db
    .update(quotes)
    .set({
      title: data.title,
      clientName: data.clientName,
      clientEmail: data.clientEmail,
      issueDate: new Date(data.issueDate),
      expiryDate: new Date(data.expiryDate),
      currency: data.currency,
      taxRate: String(data.taxRate),
      subtotal: String(data.subtotal),
      taxAmount: String(data.taxAmount),
      total: String(data.total),
      notes: data.notes || null,
      updatedAt: new Date(),
    })
    .where(and(eq(quotes.tenantId, tenantId), eq(quotes.id, quoteId)))
    .returning();

  if (!quoteRow) return null;

  // Replace all line items
  await db.delete(quoteLineItems).where(eq(quoteLineItems.quoteId, quoteId));
  const lineItemRows = await db
    .insert(quoteLineItems)
    .values(
      data.lineItems.map((li, i) => ({
        id: crypto.randomUUID(),
        quoteId,
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
    .insert(quoteActivity)
    .values({ id: crypto.randomUUID(), quoteId, tenantId, action: "updated", userId })
    .returning();

  const prevActs = await db
    .select()
    .from(quoteActivity)
    .where(and(eq(quoteActivity.quoteId, quoteId), eq(quoteActivity.tenantId, tenantId)))
    .orderBy(quoteActivity.createdAt);

  return rowToUI(quoteRow, lineItemRows, [...prevActs.filter((a) => a.id !== actRow.id), actRow]);
}

export type QuoteStatusTransition = Exclude<QuoteStatus, "draft">;

export async function updateQuoteStatus(
  tenantId: string,
  quoteId: string,
  userId: string,
  status: QuoteStatusTransition,
  note?: string
): Promise<void> {
  await db
    .update(quotes)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(quotes.tenantId, tenantId), eq(quotes.id, quoteId)));

  await db.insert(quoteActivity).values({
    id: crypto.randomUUID(),
    quoteId,
    tenantId,
    action: status, // action name matches status for sent/viewed/accepted/declined/expired
    note: note ?? null,
    userId,
  });
}

export async function deleteQuote(tenantId: string, quoteId: string): Promise<void> {
  await db.delete(quotes).where(and(eq(quotes.tenantId, tenantId), eq(quotes.id, quoteId)));
}

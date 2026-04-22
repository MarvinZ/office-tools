import { eq, and, desc } from "drizzle-orm";
import { db } from "@/db";
import { clients, clientContacts, clientDocuments, clientNotes } from "@/db/schema";
import type { InferSelectModel } from "drizzle-orm";

// ── Raw row types ─────────────────────────────────────────────────────────────

export type ClientRow = InferSelectModel<typeof clients>;
export type ClientContactRow = InferSelectModel<typeof clientContacts>;
export type ClientDocumentRow = InferSelectModel<typeof clientDocuments>;
export type ClientNoteRow = InferSelectModel<typeof clientNotes>;

// ── Composite types ───────────────────────────────────────────────────────────

export type ClientWithRelations = ClientRow & {
  contacts: ClientContactRow[];
  documents: ClientDocumentRow[];
  notes: ClientNoteRow[];
};

export type ClientListItem = ClientRow & {
  primaryContact: Pick<ClientContactRow, "id" | "name" | "email" | "phone"> | null;
};

// ── Queries ───────────────────────────────────────────────────────────────────

export async function listClients(tenantId: string): Promise<ClientListItem[]> {
  const rows = await db
    .select()
    .from(clients)
    .where(eq(clients.tenantId, tenantId))
    .orderBy(clients.name);

  if (rows.length === 0) return [];

  // Fetch all primary contacts for these clients in one query
  const clientIds = rows.map((c) => c.id);
  const allContacts = await db
    .select()
    .from(clientContacts)
    .where(
      and(
        eq(clientContacts.tenantId, tenantId),
        eq(clientContacts.isPrimary, true),
      )
    );

  const primaryByClient = new Map(allContacts.map((c) => [c.clientId, c]));

  return rows.map((row) => {
    const contact = primaryByClient.get(row.id) ?? null;
    return {
      ...row,
      primaryContact: contact
        ? { id: contact.id, name: contact.name, email: contact.email, phone: contact.phone ?? null }
        : null,
    };
  });
}

export async function getClient(tenantId: string, id: string): Promise<ClientWithRelations | null> {
  const [row] = await db
    .select()
    .from(clients)
    .where(and(eq(clients.tenantId, tenantId), eq(clients.id, id)))
    .limit(1);

  if (!row) return null;

  const [contacts, documents, notes] = await Promise.all([
    db.select().from(clientContacts).where(eq(clientContacts.clientId, id)).orderBy(clientContacts.createdAt),
    db.select().from(clientDocuments).where(eq(clientDocuments.clientId, id)).orderBy(clientDocuments.uploadedAt),
    db.select().from(clientNotes).where(eq(clientNotes.clientId, id)).orderBy(desc(clientNotes.createdAt)),
  ]);

  return { ...row, contacts, documents, notes };
}

// ── Client mutations ──────────────────────────────────────────────────────────

export type ClientInput = {
  name: string;
  legalName: string;
  taxId: string;
  industry: string;
  status: ClientRow["status"];
  website?: string;
  paymentTerms: ClientRow["paymentTerms"];
  currency: string;
  creditLimit?: number;
  billingEmail: string;
  addressStreet?: string;
  addressCity?: string;
  addressState?: string;
  addressZip?: string;
  addressCountry?: string;
  clientSince: string; // YYYY-MM-DD
  tags: string[];
};

export async function createClient(
  tenantId: string,
  createdBy: string,
  data: ClientInput
): Promise<ClientRow> {
  const [row] = await db
    .insert(clients)
    .values({
      id: crypto.randomUUID(),
      tenantId,
      createdBy,
      name: data.name,
      legalName: data.legalName,
      taxId: data.taxId,
      industry: data.industry,
      status: data.status,
      website: data.website ?? null,
      paymentTerms: data.paymentTerms,
      currency: data.currency,
      creditLimit: data.creditLimit != null ? String(data.creditLimit) : null,
      billingEmail: data.billingEmail,
      addressStreet: data.addressStreet ?? null,
      addressCity: data.addressCity ?? null,
      addressState: data.addressState ?? null,
      addressZip: data.addressZip ?? null,
      addressCountry: data.addressCountry ?? null,
      clientSince: new Date(data.clientSince),
      tags: data.tags,
    })
    .returning();
  return row;
}

export async function updateClient(
  tenantId: string,
  id: string,
  data: Partial<ClientInput>
): Promise<ClientRow | null> {
  const [row] = await db
    .update(clients)
    .set({
      ...data,
      website: data.website ?? null,
      creditLimit: data.creditLimit != null ? String(data.creditLimit) : undefined,
      clientSince: data.clientSince ? new Date(data.clientSince) : undefined,
      updatedAt: new Date(),
    })
    .where(and(eq(clients.tenantId, tenantId), eq(clients.id, id)))
    .returning();
  return row ?? null;
}

export async function deleteClient(tenantId: string, id: string): Promise<void> {
  await db.delete(clients).where(and(eq(clients.tenantId, tenantId), eq(clients.id, id)));
}

// ── Contacts ──────────────────────────────────────────────────────────────────

export type ContactInput = {
  name: string;
  title?: string;
  email: string;
  phone?: string;
  isPrimary: boolean;
};

export async function addClientContact(
  tenantId: string,
  clientId: string,
  data: ContactInput
): Promise<ClientContactRow> {
  // If new contact is primary, demote existing primary first
  if (data.isPrimary) {
    await db
      .update(clientContacts)
      .set({ isPrimary: false })
      .where(and(eq(clientContacts.clientId, clientId), eq(clientContacts.isPrimary, true)));
  }
  const [row] = await db
    .insert(clientContacts)
    .values({ id: crypto.randomUUID(), clientId, tenantId, ...data, title: data.title ?? null, phone: data.phone ?? null })
    .returning();
  return row;
}

export async function updateClientContact(
  tenantId: string,
  contactId: string,
  clientId: string,
  data: Partial<ContactInput>
): Promise<ClientContactRow | null> {
  if (data.isPrimary) {
    await db
      .update(clientContacts)
      .set({ isPrimary: false })
      .where(and(eq(clientContacts.clientId, clientId), eq(clientContacts.isPrimary, true)));
  }
  const [row] = await db
    .update(clientContacts)
    .set(data)
    .where(and(eq(clientContacts.tenantId, tenantId), eq(clientContacts.id, contactId)))
    .returning();
  return row ?? null;
}

export async function deleteClientContact(tenantId: string, contactId: string): Promise<void> {
  await db
    .delete(clientContacts)
    .where(and(eq(clientContacts.tenantId, tenantId), eq(clientContacts.id, contactId)));
}

// ── Documents ─────────────────────────────────────────────────────────────────

export async function addClientDocument(
  tenantId: string,
  clientId: string,
  uploadedBy: string,
  data: { name: string; type: ClientDocumentRow["type"]; blobUrl: string }
): Promise<ClientDocumentRow> {
  const [row] = await db
    .insert(clientDocuments)
    .values({ id: crypto.randomUUID(), clientId, tenantId, uploadedBy, ...data })
    .returning();
  return row;
}

export async function deleteClientDocument(tenantId: string, documentId: string): Promise<void> {
  await db
    .delete(clientDocuments)
    .where(and(eq(clientDocuments.tenantId, tenantId), eq(clientDocuments.id, documentId)));
}

// ── Notes ─────────────────────────────────────────────────────────────────────

export async function addClientNote(
  tenantId: string,
  clientId: string,
  createdBy: string,
  body: string
): Promise<ClientNoteRow> {
  const [row] = await db
    .insert(clientNotes)
    .values({ id: crypto.randomUUID(), clientId, tenantId, createdBy, body })
    .returning();
  return row;
}

export async function deleteClientNote(tenantId: string, noteId: string): Promise<void> {
  await db
    .delete(clientNotes)
    .where(and(eq(clientNotes.tenantId, tenantId), eq(clientNotes.id, noteId)));
}

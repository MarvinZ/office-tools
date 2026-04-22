import { eq, and, desc } from "drizzle-orm";
import { db } from "@/db";
import { providers, providerContacts, providerDocuments, providerNotes } from "@/db/schema";
import type { InferSelectModel } from "drizzle-orm";

// ── Raw row types ─────────────────────────────────────────────────────────────

export type ProviderRow = InferSelectModel<typeof providers>;
export type ProviderContactRow = InferSelectModel<typeof providerContacts>;
export type ProviderDocumentRow = InferSelectModel<typeof providerDocuments>;
export type ProviderNoteRow = InferSelectModel<typeof providerNotes>;

// ── Composite types ───────────────────────────────────────────────────────────

export type ProviderWithRelations = ProviderRow & {
  contacts: ProviderContactRow[];
  documents: ProviderDocumentRow[];
  notes: ProviderNoteRow[];
};

export type ProviderListItem = ProviderRow & {
  primaryContact: Pick<ProviderContactRow, "id" | "name" | "email" | "phone"> | null;
};

// ── Queries ───────────────────────────────────────────────────────────────────

export async function listProviders(tenantId: string): Promise<ProviderListItem[]> {
  const rows = await db
    .select()
    .from(providers)
    .where(eq(providers.tenantId, tenantId))
    .orderBy(providers.name);

  if (rows.length === 0) return [];

  const allContacts = await db
    .select()
    .from(providerContacts)
    .where(
      and(
        eq(providerContacts.tenantId, tenantId),
        eq(providerContacts.isPrimary, true),
      )
    );

  const primaryByProvider = new Map(allContacts.map((c) => [c.providerId, c]));

  return rows.map((row) => {
    const contact = primaryByProvider.get(row.id) ?? null;
    return {
      ...row,
      primaryContact: contact
        ? { id: contact.id, name: contact.name, email: contact.email, phone: contact.phone ?? null }
        : null,
    };
  });
}

export async function getProvider(tenantId: string, id: string): Promise<ProviderWithRelations | null> {
  const [row] = await db
    .select()
    .from(providers)
    .where(and(eq(providers.tenantId, tenantId), eq(providers.id, id)))
    .limit(1);

  if (!row) return null;

  const [contacts, documents, notes] = await Promise.all([
    db.select().from(providerContacts).where(eq(providerContacts.providerId, id)).orderBy(providerContacts.createdAt),
    db.select().from(providerDocuments).where(eq(providerDocuments.providerId, id)).orderBy(providerDocuments.uploadedAt),
    db.select().from(providerNotes).where(eq(providerNotes.providerId, id)).orderBy(desc(providerNotes.createdAt)),
  ]);

  return { ...row, contacts, documents, notes };
}

// ── Provider mutations ────────────────────────────────────────────────────────

export type ProviderInput = {
  name: string;
  legalName: string;
  taxId?: string;
  category: string;
  status: ProviderRow["status"];
  website?: string;
  rating: number;
  currency: string;
  paymentTerms: ProviderRow["paymentTerms"];
  bankName?: string;
  bankAccount?: string;
  bankIban?: string;
  bankSwift?: string;
  productsServices: string;
  leadTimeDays?: number;
  minimumOrderAmount?: number;
  contractExpiry?: string; // YYYY-MM-DD
  addressStreet?: string;
  addressCity?: string;
  addressState?: string;
  addressZip?: string;
  addressCountry?: string;
  partnerSince: string; // YYYY-MM-DD
  tags: string[];
};

export async function createProvider(
  tenantId: string,
  createdBy: string,
  data: ProviderInput
): Promise<ProviderRow> {
  const [row] = await db
    .insert(providers)
    .values({
      id: crypto.randomUUID(),
      tenantId,
      createdBy,
      name: data.name,
      legalName: data.legalName,
      taxId: data.taxId ?? null,
      category: data.category,
      status: data.status,
      website: data.website ?? null,
      rating: data.rating,
      currency: data.currency,
      paymentTerms: data.paymentTerms,
      bankName: data.bankName ?? null,
      bankAccount: data.bankAccount ?? null,
      bankIban: data.bankIban ?? null,
      bankSwift: data.bankSwift ?? null,
      productsServices: data.productsServices,
      leadTimeDays: data.leadTimeDays ?? null,
      minimumOrderAmount: data.minimumOrderAmount != null ? String(data.minimumOrderAmount) : null,
      contractExpiry: data.contractExpiry ? new Date(data.contractExpiry) : null,
      addressStreet: data.addressStreet ?? null,
      addressCity: data.addressCity ?? null,
      addressState: data.addressState ?? null,
      addressZip: data.addressZip ?? null,
      addressCountry: data.addressCountry ?? null,
      partnerSince: new Date(data.partnerSince),
      tags: data.tags,
    })
    .returning();
  return row;
}

export async function updateProvider(
  tenantId: string,
  id: string,
  data: Partial<ProviderInput>
): Promise<ProviderRow | null> {
  const [row] = await db
    .update(providers)
    .set({
      ...data,
      taxId: data.taxId ?? null,
      website: data.website ?? null,
      bankName: data.bankName ?? null,
      bankAccount: data.bankAccount ?? null,
      bankIban: data.bankIban ?? null,
      bankSwift: data.bankSwift ?? null,
      minimumOrderAmount: data.minimumOrderAmount != null ? String(data.minimumOrderAmount) : undefined,
      contractExpiry: data.contractExpiry ? new Date(data.contractExpiry) : undefined,
      partnerSince: data.partnerSince ? new Date(data.partnerSince) : undefined,
      updatedAt: new Date(),
    })
    .where(and(eq(providers.tenantId, tenantId), eq(providers.id, id)))
    .returning();
  return row ?? null;
}

export async function deleteProvider(tenantId: string, id: string): Promise<void> {
  await db.delete(providers).where(and(eq(providers.tenantId, tenantId), eq(providers.id, id)));
}

// ── Contacts ──────────────────────────────────────────────────────────────────

export type ContactInput = {
  name: string;
  title?: string;
  email: string;
  phone?: string;
  isPrimary: boolean;
};

export async function addProviderContact(
  tenantId: string,
  providerId: string,
  data: ContactInput
): Promise<ProviderContactRow> {
  if (data.isPrimary) {
    await db
      .update(providerContacts)
      .set({ isPrimary: false })
      .where(and(eq(providerContacts.providerId, providerId), eq(providerContacts.isPrimary, true)));
  }
  const [row] = await db
    .insert(providerContacts)
    .values({ id: crypto.randomUUID(), providerId, tenantId, ...data, title: data.title ?? null, phone: data.phone ?? null })
    .returning();
  return row;
}

export async function updateProviderContact(
  tenantId: string,
  contactId: string,
  providerId: string,
  data: Partial<ContactInput>
): Promise<ProviderContactRow | null> {
  if (data.isPrimary) {
    await db
      .update(providerContacts)
      .set({ isPrimary: false })
      .where(and(eq(providerContacts.providerId, providerId), eq(providerContacts.isPrimary, true)));
  }
  const [row] = await db
    .update(providerContacts)
    .set(data)
    .where(and(eq(providerContacts.tenantId, tenantId), eq(providerContacts.id, contactId)))
    .returning();
  return row ?? null;
}

export async function deleteProviderContact(tenantId: string, contactId: string): Promise<void> {
  await db
    .delete(providerContacts)
    .where(and(eq(providerContacts.tenantId, tenantId), eq(providerContacts.id, contactId)));
}

// ── Documents ─────────────────────────────────────────────────────────────────

export async function addProviderDocument(
  tenantId: string,
  providerId: string,
  uploadedBy: string,
  data: { name: string; type: ProviderDocumentRow["type"]; blobUrl: string }
): Promise<ProviderDocumentRow> {
  const [row] = await db
    .insert(providerDocuments)
    .values({ id: crypto.randomUUID(), providerId, tenantId, uploadedBy, ...data })
    .returning();
  return row;
}

export async function deleteProviderDocument(tenantId: string, documentId: string): Promise<void> {
  await db
    .delete(providerDocuments)
    .where(and(eq(providerDocuments.tenantId, tenantId), eq(providerDocuments.id, documentId)));
}

// ── Notes ─────────────────────────────────────────────────────────────────────

export async function addProviderNote(
  tenantId: string,
  providerId: string,
  createdBy: string,
  body: string
): Promise<ProviderNoteRow> {
  const [row] = await db
    .insert(providerNotes)
    .values({ id: crypto.randomUUID(), providerId, tenantId, createdBy, body })
    .returning();
  return row;
}

export async function deleteProviderNote(tenantId: string, noteId: string): Promise<void> {
  await db
    .delete(providerNotes)
    .where(and(eq(providerNotes.tenantId, tenantId), eq(providerNotes.id, noteId)));
}

import { sql } from "drizzle-orm";
import { pgTable, text, timestamp, boolean, integer, numeric, jsonb, pgEnum, primaryKey, customType, date, uniqueIndex, unique, index, check } from "drizzle-orm/pg-core";

// ── PostGIS custom column type ─────────────────────────────────────────────────

const geometryPolygon = customType<{ data: string }>({
  dataType() {
    return "geometry(Polygon,4326)";
  },
});

// ── Enums ─────────────────────────────────────────────────────────────────────

export const batchStatusEnum = pgEnum("batch_status", [
  "draft",
  "queued",
  "processing",
  "sent",
  "cancelled",
  "failed",
]);

export const emailStatusEnum = pgEnum("email_status", [
  "queued",
  "sent",
  "failed",
]);

// ── Tenants ───────────────────────────────────────────────────────────────────

export const tenants = pgTable("tenants", {
  id: text("id").primaryKey(), // clerk org id
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  clerkOrgId: text("clerk_org_id").notNull().unique(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Tools ─────────────────────────────────────────────────────────────────────

export const tools = pgTable("tools", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
});

export const tenantTools = pgTable("tenant_tools", {
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  toolId: text("tool_id").notNull().references(() => tools.id),
  enabledAt: timestamp("enabled_at").defaultNow().notNull(),
}, (t) => [primaryKey({ columns: [t.tenantId, t.toolId] })]);

// ── Employees ─────────────────────────────────────────────────────────────────

export const employeeStatusEnum = pgEnum("employee_status", [
  "active",
  "on_leave",
  "terminated",
]);

export const compensationTypeEnum = pgEnum("compensation_type", [
  "hourly",
  "monthly",
  "annual",
]);

export const employeeDocTypeEnum = pgEnum("employee_doc_type", [
  "contract",
  "id_document",
  "other",
]);

export const departments = pgTable("departments", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const employees = pgTable("employees", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),

  // Identity
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  avatarUrl: text("avatar_url"),

  // Contact
  companyEmail: text("company_email").notNull(),
  personalEmail: text("personal_email"),
  phone: text("phone"),

  // Role
  position: text("position").notNull(),
  departmentId: text("department_id").references(() => departments.id),

  // Status
  status: employeeStatusEnum("status").notNull().default("active"),
  hireDate: timestamp("hire_date").notNull(),
  terminationDate: timestamp("termination_date"),

  // Address
  addressStreet: text("address_street"),
  addressCity: text("address_city"),
  addressState: text("address_state"),
  addressZip: text("address_zip"),
  addressCountry: text("address_country"),

  // Compensation
  compensationAmount: numeric("compensation_amount", { precision: 12, scale: 2 }),
  compensationType: compensationTypeEnum("compensation_type"),

  // Emergency contact
  emergencyContactName: text("emergency_contact_name"),
  emergencyContactPhone: text("emergency_contact_phone"),
  emergencyContactRelation: text("emergency_contact_relation"),

  // App access (future)
  clerkUserId: text("clerk_user_id"),

  // Meta
  notes: text("notes"),
  tags: text("tags").array().notNull().default([]),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const employeeDocuments = pgTable("employee_documents", {
  id: text("id").primaryKey(),
  employeeId: text("employee_id").notNull().references(() => employees.id, { onDelete: "cascade" }),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  name: text("name").notNull(),
  type: employeeDocTypeEnum("type").notNull().default("other"),
  blobUrl: text("blob_url").notNull(),
  uploadedBy: text("uploaded_by").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
});

// ── Payroll Uploads ───────────────────────────────────────────────────────────

export const payrollUploads = pgTable("payroll_uploads", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  filename: text("filename").notNull(),
  blobUrl: text("blob_url").notNull(),
  fileHash: text("file_hash").notNull(),
  label: text("label"),
  createdBy: text("created_by").notNull(), // clerk user id
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Payroll Batches ───────────────────────────────────────────────────────────

export const payrollBatches = pgTable("payroll_batches", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  uploadId: text("upload_id").notNull().references(() => payrollUploads.id),
  status: batchStatusEnum("status").notNull().default("draft"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ── Payroll Emails ────────────────────────────────────────────────────────────

export const payrollEmails = pgTable("payroll_emails", {
  id: text("id").primaryKey(),
  batchId: text("batch_id").notNull().references(() => payrollBatches.id),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  recipientEmail: text("recipient_email").notNull(),
  payload: jsonb("payload").notNull(), // full PayrollRow data
  status: emailStatusEnum("status").notNull().default("queued"),
  sentAt: timestamp("sent_at"),
  error: text("error"),
});

// ── Assets ────────────────────────────────────────────────────────────────────

export const assetStatusEnum = pgEnum("asset_status", [
  "available",
  "checked_out",
  "maintenance",
  "retired",
]);

export const assetCategoryEnum = pgEnum("asset_category", [
  "Electronics",
  "Furniture",
  "Vehicles",
  "Equipment",
  "Tools",
  "Other",
]);

export const assetDocumentTypeEnum = pgEnum("asset_document_type", [
  "invoice",
  "manual",
  "warranty",
  "other",
]);

export const assetHistoryActionEnum = pgEnum("asset_history_action", [
  "created",
  "checked_out",
  "checked_in",
  "maintenance_start",
  "maintenance_end",
  "updated",
  "document_added",
  "photo_added",
]);

export const assets = pgTable("assets", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  name: text("name").notNull(),
  category: assetCategoryEnum("category").notNull(),
  brand: text("brand").notNull(),
  model: text("model").notNull(),
  serialNumber: text("serial_number").notNull(),
  barcode: text("barcode").notNull(),
  status: assetStatusEnum("status").notNull().default("available"),
  location: text("location").notNull(),
  assignedToId: text("assigned_to_id").references(() => employees.id),
  purchaseDate: timestamp("purchase_date").notNull(),
  purchasePrice: numeric("purchase_price", { precision: 12, scale: 2 }).notNull(),
  warrantyExpiry: timestamp("warranty_expiry").notNull(),
  supplier: text("supplier").notNull(),
  buyUrl: text("buy_url"),
  notes: text("notes"),
  tags: text("tags").array().notNull().default([]),
  createdBy: text("created_by").notNull(), // clerk user id
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const assetPhotos = pgTable("asset_photos", {
  id: text("id").primaryKey(),
  assetId: text("asset_id").notNull().references(() => assets.id, { onDelete: "cascade" }),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  blobUrl: text("blob_url").notNull(),
  uploadedBy: text("uploaded_by").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
});

export const assetDocuments = pgTable("asset_documents", {
  id: text("id").primaryKey(),
  assetId: text("asset_id").notNull().references(() => assets.id, { onDelete: "cascade" }),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  name: text("name").notNull(),
  type: assetDocumentTypeEnum("type").notNull().default("other"),
  blobUrl: text("blob_url").notNull(),
  uploadedBy: text("uploaded_by").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
});

export const assetHistory = pgTable("asset_history", {
  id: text("id").primaryKey(),
  assetId: text("asset_id").notNull().references(() => assets.id, { onDelete: "cascade" }),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  action: assetHistoryActionEnum("action").notNull(),
  notes: text("notes"),
  user: text("user").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Quotes ────────────────────────────────────────────────────────────────────

export const quoteStatusEnum = pgEnum("quote_status", [
  "draft",
  "sent",
  "viewed",
  "accepted",
  "declined",
  "expired",
]);

export const quoteActivityActionEnum = pgEnum("quote_activity_action", [
  "created",
  "sent",
  "viewed",
  "accepted",
  "declined",
  "expired",
  "updated",
]);

export const quotes = pgTable("quotes", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  clientId: text("client_id").references(() => clients.id),
  number: text("number").notNull(),
  title: text("title").notNull(),
  clientName: text("client_name").notNull(),
  clientEmail: text("client_email").notNull(),
  status: quoteStatusEnum("status").notNull().default("draft"),
  issueDate: timestamp("issue_date").notNull(),
  expiryDate: timestamp("expiry_date").notNull(),
  currency: text("currency").notNull().default("USD"),
  taxRate: numeric("tax_rate", { precision: 5, scale: 4 }).notNull().default("0.13"),
  subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull(),
  taxAmount: numeric("tax_amount", { precision: 12, scale: 2 }).notNull(),
  total: numeric("total", { precision: 12, scale: 2 }).notNull(),
  notes: text("notes"),
  tags: text("tags").array().notNull().default([]),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const quoteLineItems = pgTable("quote_line_items", {
  id: text("id").primaryKey(),
  quoteId: text("quote_id").notNull().references(() => quotes.id, { onDelete: "cascade" }),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  description: text("description").notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
  subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull(),
  position: integer("position").notNull().default(0),
});

export const quoteActivity = pgTable("quote_activity", {
  id: text("id").primaryKey(),
  quoteId: text("quote_id").notNull().references(() => quotes.id, { onDelete: "cascade" }),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  action: quoteActivityActionEnum("action").notNull(),
  note: text("note"),
  userId: text("user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Clients ───────────────────────────────────────────────────────────────────

export const clientStatusEnum = pgEnum("client_status", [
  "active",
  "inactive",
  "prospect",
  "blocked",
]);

export const paymentTermsEnum = pgEnum("payment_terms", [
  "immediate",
  "net_15",
  "net_30",
  "net_60",
  "net_90",
]);

export const clientDocTypeEnum = pgEnum("client_doc_type", [
  "contract",
  "nda",
  "proposal",
  "invoice",
  "other",
]);

export const clients = pgTable("clients", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  name: text("name").notNull(),
  legalName: text("legal_name").notNull(),
  taxId: text("tax_id").notNull(),
  industry: text("industry").notNull(),
  status: clientStatusEnum("status").notNull().default("prospect"),
  website: text("website"),
  paymentTerms: paymentTermsEnum("payment_terms").notNull().default("net_30"),
  currency: text("currency").notNull().default("USD"),
  creditLimit: numeric("credit_limit", { precision: 12, scale: 2 }),
  billingEmail: text("billing_email").notNull(),
  addressStreet: text("address_street"),
  addressCity: text("address_city"),
  addressState: text("address_state"),
  addressZip: text("address_zip"),
  addressCountry: text("address_country"),
  clientSince: timestamp("client_since").notNull(),
  tags: text("tags").array().notNull().default([]),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const clientContacts = pgTable("client_contacts", {
  id: text("id").primaryKey(),
  clientId: text("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  name: text("name").notNull(),
  title: text("title"),
  email: text("email").notNull(),
  phone: text("phone"),
  isPrimary: boolean("is_primary").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const clientDocuments = pgTable("client_documents", {
  id: text("id").primaryKey(),
  clientId: text("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  name: text("name").notNull(),
  type: clientDocTypeEnum("type").notNull().default("other"),
  blobUrl: text("blob_url").notNull(),
  uploadedBy: text("uploaded_by").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
});

export const clientNotes = pgTable("client_notes", {
  id: text("id").primaryKey(),
  clientId: text("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  body: text("body").notNull(),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Providers ─────────────────────────────────────────────────────────────────

export const providerStatusEnum = pgEnum("provider_status", [
  "active",
  "inactive",
  "blocked",
]);

export const providerDocTypeEnum = pgEnum("provider_doc_type", [
  "contract",
  "price_list",
  "certificate",
  "invoice",
  "other",
]);

export const providers = pgTable("providers", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  name: text("name").notNull(),
  legalName: text("legal_name").notNull(),
  taxId: text("tax_id"),
  category: text("category").notNull(),
  status: providerStatusEnum("status").notNull().default("active"),
  website: text("website"),
  rating: integer("rating").notNull().default(3),
  currency: text("currency").notNull().default("USD"),
  paymentTerms: paymentTermsEnum("payment_terms").notNull().default("net_30"),
  bankName: text("bank_name"),
  bankAccount: text("bank_account"),
  bankIban: text("bank_iban"),
  bankSwift: text("bank_swift"),
  productsServices: text("products_services").notNull(),
  leadTimeDays: integer("lead_time_days"),
  minimumOrderAmount: numeric("minimum_order_amount", { precision: 12, scale: 2 }),
  contractExpiry: timestamp("contract_expiry"),
  addressStreet: text("address_street"),
  addressCity: text("address_city"),
  addressState: text("address_state"),
  addressZip: text("address_zip"),
  addressCountry: text("address_country"),
  partnerSince: timestamp("partner_since").notNull(),
  tags: text("tags").array().notNull().default([]),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const providerContacts = pgTable("provider_contacts", {
  id: text("id").primaryKey(),
  providerId: text("provider_id").notNull().references(() => providers.id, { onDelete: "cascade" }),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  name: text("name").notNull(),
  title: text("title"),
  email: text("email").notNull(),
  phone: text("phone"),
  isPrimary: boolean("is_primary").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const providerDocuments = pgTable("provider_documents", {
  id: text("id").primaryKey(),
  providerId: text("provider_id").notNull().references(() => providers.id, { onDelete: "cascade" }),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  name: text("name").notNull(),
  type: providerDocTypeEnum("type").notNull().default("other"),
  blobUrl: text("blob_url").notNull(),
  uploadedBy: text("uploaded_by").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
});

export const providerNotes = pgTable("provider_notes", {
  id: text("id").primaryKey(),
  providerId: text("provider_id").notNull().references(() => providers.id, { onDelete: "cascade" }),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  body: text("body").notNull(),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Audit Logs ────────────────────────────────────────────────────────────────

export const auditLogs = pgTable("audit_logs", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  userId: text("user_id").notNull(),
  action: text("action").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Invoices ──────────────────────────────────────────────────────────────────

export const invoiceStatusEnum = pgEnum("invoice_status", [
  "draft",
  "sent",
  "viewed",
  "paid",
  "overdue",
  "cancelled",
]);

export const invoiceActivityActionEnum = pgEnum("invoice_activity_action", [
  "created",
  "sent",
  "viewed",
  "paid",
  "overdue",
  "cancelled",
  "updated",
]);

export const invoices = pgTable("invoices", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  clientId: text("client_id").references(() => clients.id),
  quoteId: text("quote_id").references(() => quotes.id),
  number: text("number").notNull(),
  title: text("title").notNull(),
  clientName: text("client_name").notNull(),
  clientEmail: text("client_email").notNull(),
  status: invoiceStatusEnum("status").notNull().default("draft"),
  issueDate: timestamp("issue_date").notNull(),
  dueDate: timestamp("due_date").notNull(),
  currency: text("currency").notNull().default("USD"),
  taxRate: numeric("tax_rate", { precision: 5, scale: 4 }).notNull().default("0.13"),
  subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull(),
  taxAmount: numeric("tax_amount", { precision: 12, scale: 2 }).notNull(),
  total: numeric("total", { precision: 12, scale: 2 }).notNull(),
  notes: text("notes"),
  tags: text("tags").array().notNull().default([]),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const invoiceLineItems = pgTable("invoice_line_items", {
  id: text("id").primaryKey(),
  invoiceId: text("invoice_id").notNull().references(() => invoices.id, { onDelete: "cascade" }),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  description: text("description").notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
  subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull(),
  position: integer("position").notNull().default(0),
});

export const invoiceActivity = pgTable("invoice_activity", {
  id: text("id").primaryKey(),
  invoiceId: text("invoice_id").notNull().references(() => invoices.id, { onDelete: "cascade" }),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  action: invoiceActivityActionEnum("action").notNull(),
  note: text("note"),
  userId: text("user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Trades ────────────────────────────────────────────────────────────────────

export const trades = pgTable("trades", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  category: text("category").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Coverage Areas ────────────────────────────────────────────────────────────

export const coverageAreas = pgTable("coverage_areas", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  tradeId: text("trade_id").notNull().references(() => trades.id),
  label: text("label"),
  geom: geometryPolygon("geom").notNull(),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ── Barbers ───────────────────────────────────────────────────────────────────

export const serviceStatusEnum = pgEnum("service_status", [
  "active",
  "inactive",
]);

export const locationStatusEnum = pgEnum("location_status", [
  "active",
  "inactive",
]);

export const barberStatusEnum = pgEnum("barber_status", [
  "active",
  "inactive",
]);

// Spec §5.1 movement states. A service is never deleted: it's voided (kept,
// excluded from pay), marked a courtesy (paid normally, salon covers it) or is
// a warranty redo of another service. Returns ("devolución") come later.
export const barberActivityStatusEnum = pgEnum("barber_activity_status", [
  "active",
  "voided",
  "courtesy",
  "warranty",
]);

export const services = pgTable("services", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  name: text("name").notNull(),
  category: text("category"),
  defaultCommissionRate: numeric("default_commission_rate", { precision: 5, scale: 4 }).notNull(),
  status: serviceStatusEnum("status").notNull().default("active"),
  tags: text("tags").array().notNull().default([]),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const paymentMethodStatusEnum = pgEnum("payment_method_status", [
  "active",
  "inactive",
]);

// How a customer paid. Each method carries a processing fee rate charged on the
// IVA-free base of services paid that way and deducted in the barber's
// settlement (the card "datáfono" fee), so this is payout-affecting
// configuration, not a cosmetic label. Tenants get three editable defaults
// seeded (Cash 0%, SINPE 0%, Credit Card 6.5%) — they are ordinary rows, freely
// renamable/addable/deactivatable, not system constants.
export const paymentMethods = pgTable("payment_methods", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  name: text("name").notNull(),
  feeRate: numeric("fee_rate", { precision: 5, scale: 4 }).notNull(),
  status: paymentMethodStatusEnum("status").notNull().default("active"),
  tags: text("tags").array().notNull().default([]),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const locations = pgTable("locations", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  name: text("name").notNull(),
  addressStreet: text("address_street"),
  addressCity: text("address_city"),
  addressState: text("address_state"),
  addressZip: text("address_zip"),
  addressCountry: text("address_country"),
  phone: text("phone"),
  status: locationStatusEnum("status").notNull().default("active"),
  tags: text("tags").array().notNull().default([]),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const barbers = pgTable("barbers", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  phone: text("phone"),
  email: text("email"),
  status: barberStatusEnum("status").notNull().default("active"),
  notes: text("notes"),
  tags: text("tags").array().notNull().default([]),
  // ── Payment details. Personal data: only ever shown to this tenant.
  idNumber: text("id_number"), // cédula
  iban: text("iban"), // bank account the settlement transfer goes to
  // Other spellings of the name as cashiers write it in the daily closing
  // file ("Bryan", "Lesli"), matched exactly by the importer.
  aliases: text("aliases").array().notNull().default([]),
  // ── Settlement ("liquidación") profile — see src/lib/barbers/settlement.ts.
  // Plain per-barber fields rather than a rules engine: each covers one real
  // variation in how a barber is paid. No effective dating on purpose (small
  // shop); history will be protected by snapshotting settlements once paid.
  //
  // Daily maintenance fee is charged for each day with ≥1 service; false = exempt.
  appliesMaintenance: boolean("applies_maintenance").notNull().default(true),
  // Share of service income that the barber's IVA is computed on. 1 normally;
  // 0.5 for a barber whose IVA only applies to half the base.
  ivaBaseRate: numeric("iva_base_rate", { precision: 5, scale: 4 }).notNull().default("1"),
  // IVA is calculated and shown but NOT added to the invoice/transfer.
  ivaInformative: boolean("iva_informative").notNull().default(false),
  // Fixed IVA-bearing amount added every fortnight (e.g. a cleaning stipend).
  fortnightlyAddition: numeric("fortnightly_addition", { precision: 12, scale: 2 }).notNull().default("0"),
  // When deductions exceed earnings, the shortfall is taken from this person's
  // monthly salary instead of being carried as a balance (spec §7, CA 10).
  shortfallToSalary: boolean("shortfall_to_salary").notNull().default(false),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// One row per tenant: the shop-wide numbers the settlement engine needs. A row
// is created with these defaults on first read (getBarberSettings), so there is
// never a "missing settings" state to handle.
export const barberSettings = pgTable("barber_settings", {
  tenantId: text("tenant_id").primaryKey().references(() => tenants.id),
  ivaRate: numeric("iva_rate", { precision: 5, scale: 4 }).notNull().default("0.13"),
  maintenanceDailyFee: numeric("maintenance_daily_fee", { precision: 12, scale: 2 }).notNull().default("1000"),
  updatedBy: text("updated_by"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// A closed ("paid") fortnight. Settlements are computed live from the raw
// data; closing freezes that result here so later edits to rates, settings or
// movements never change what was already paid. snapshot holds the full
// FortnightSettlements result (services/barbers/settlements.ts) — read-only,
// never recomputed.
//
// Versioned: reopening stamps reopenedAt on the current row instead of
// deleting it, and closing again adds version + 1. The current closing is
// the one row per fortnight with reopenedAt null (enforced by the index).
export const barberFortnightClosings = pgTable("barber_fortnight_closings", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  period: text("period").notNull(), // "YYYY-MM-H", H = 1 (1–15) or 2 (16–end)
  version: integer("version").notNull(),
  snapshot: jsonb("snapshot").notNull(),
  closedBy: text("closed_by").notNull(),
  closedAt: timestamp("closed_at").defaultNow().notNull(),
  reopenedBy: text("reopened_by"),
  reopenedAt: timestamp("reopened_at"),
  reopenReason: text("reopen_reason"), // required when reopening (spec §11.1)
}, (t) => [
  uniqueIndex("barber_fortnight_closings_version_uq").on(t.tenantId, t.period, t.version),
  uniqueIndex("barber_fortnight_closings_current_uq").on(t.tenantId, t.period).where(sql`${t.reopenedAt} is null`),
]);

export const barberLocations = pgTable("barber_locations", {
  barberId: text("barber_id").notNull().references(() => barbers.id, { onDelete: "cascade" }),
  locationId: text("location_id").notNull().references(() => locations.id, { onDelete: "cascade" }),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [primaryKey({ columns: [t.barberId, t.locationId] })]);

export const locationServices = pgTable("location_services", {
  locationId: text("location_id").notNull().references(() => locations.id, { onDelete: "cascade" }),
  serviceId: text("service_id").notNull().references(() => services.id, { onDelete: "cascade" }),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  price: numeric("price", { precision: 12, scale: 2 }).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [primaryKey({ columns: [t.tenantId, t.locationId, t.serviceId] })]);

export const barberServiceRates = pgTable("barber_service_rates", {
  barberId: text("barber_id").notNull().references(() => barbers.id, { onDelete: "cascade" }),
  serviceId: text("service_id").notNull().references(() => services.id, { onDelete: "cascade" }),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  commissionRate: numeric("commission_rate", { precision: 5, scale: 4 }).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [primaryKey({ columns: [t.tenantId, t.barberId, t.serviceId] })]);

// A barber checked in to work at a location on a given calendar day. Filters
// the fast-entry form's barber picker to who's actually in today, separate
// from barberLocations (which locations a barber is ever permitted to work)
// and from barbers.status (still-employed vs retired). Editable all day:
// checking in inserts a row, checking out deletes it — no lock, no history
// kept for who-was-in-when (this is a live roster, not an attendance log).
export const barberDailyRoster = pgTable("barber_daily_roster", {
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  locationId: text("location_id").notNull().references(() => locations.id, { onDelete: "cascade" }),
  barberId: text("barber_id").notNull().references(() => barbers.id, { onDelete: "cascade" }),
  workDate: date("work_date").notNull(),
  checkedInAt: timestamp("checked_in_at").defaultNow().notNull(),
}, (t) => [primaryKey({ columns: [t.tenantId, t.locationId, t.barberId, t.workDate] })]);

export const barberActivities = pgTable("barber_activities", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  barberId: text("barber_id").notNull().references(() => barbers.id),
  locationId: text("location_id").notNull().references(() => locations.id),
  serviceId: text("service_id").notNull().references(() => services.id),
  // No onDelete cascade, same as barberId/locationId/serviceId: a payout record
  // must outlive edits to the catalog it was created from.
  paymentMethodId: text("payment_method_id").notNull().references(() => paymentMethods.id),
  customerName: text("customer_name"),
  priceCharged: numeric("price_charged", { precision: 12, scale: 2 }).notNull(),
  commissionRate: numeric("commission_rate", { precision: 5, scale: 4 }).notNull(), // snapshot at log time
  // Snapshot of the payment method's fee rate at log time, for the same reason
  // commissionRate is snapshotted: re-pricing a payment method later must never
  // retroactively change what a barber was already owed for past work.
  paymentMethodFeeRate: numeric("payment_method_fee_rate", { precision: 5, scale: 4 }).notNull(),
  // price ÷ (1 + IVA) × commissionRate, computed server-side, rounded for
  // display. Settlements recompute from the raw fields instead of summing this.
  // Rows logged before the settlement engine hold the old fee-reduced figure.
  commissionAmount: numeric("commission_amount", { precision: 12, scale: 2 }).notNull(),
  performedAt: timestamp("performed_at").defaultNow().notNull(),
  // ── Status (spec §8.7–8.10). See barberActivityStatusEnum.
  status: barberActivityStatusEnum("status").notNull().default("active"),
  statusReason: text("status_reason"), // why it was voided / redone
  statusChangedBy: text("status_changed_by"),
  statusChangedAt: timestamp("status_changed_at"),
  // A warranty redo points at the service it redoes. The barber on this row is
  // the one who redid it; the original row's barber is the one responsible.
  warrantyOfActivityId: text("warranty_of_activity_id"),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// A "vale": a cash advance handed to a barber before their normal payday (paid
// on the 15th, needs money on the 12th). No tax or commission math: the amount
// is exactly what was handed over, and the settlement engine deducts it in full
// from the fortnight its issuedDate falls in.
//
// No updatedAt and no update path: a mistaken vale is deleted and re-entered,
// which keeps "what was handed over" unambiguous.
export const barberVouchers = pgTable("barber_vouchers", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  // No onDelete cascade, same reasoning as barberActivities' refs: a record of
  // cash actually handed to someone must outlive later edits to the barber.
  barberId: text("barber_id").notNull().references(() => barbers.id),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  // A plain calendar date, like barberDailyRoster.workDate: a vale is dated
  // "the 12th", not a specific instant.
  issuedDate: date("issued_date").notNull(),
  note: text("note"),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// A tip ("propina") owed to a barber. Tips are paid out in full on top of the
// settlement transfer: no IVA, not part of the electronic invoice. Same shape
// and same delete-and-re-enter correction policy as barberVouchers.
// A shortfall moved by an admin from a closed fortnight to the next one
// (spec §8.1/§8.5: a manual, audited action, possibly only part of it). The
// next fortnight deducts `amount` as "previous balance".
export const barberCarryOvers = pgTable("barber_carry_overs", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  barberId: text("barber_id").notNull().references(() => barbers.id),
  fromPeriod: text("from_period").notNull(), // fortnight key, "YYYY-MM-H"
  toPeriod: text("to_period").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [uniqueIndex("barber_carry_overs_uq").on(t.tenantId, t.barberId, t.fromPeriod)]);

export const barberTips = pgTable("barber_tips", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  barberId: text("barber_id").notNull().references(() => barbers.id),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  tipDate: date("tip_date").notNull(),
  note: text("note"),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const productStatusEnum = pgEnum("product_status", [
  "active",
  "inactive",
]);

// Things the shop sells to its barbers (blades, product, whatever they need).
// Mirrors `services` in shape, with one deliberate difference: a single
// tenant-wide price rather than a per-location one — the shop charges its own
// barbers the same everywhere, so there is no location_products join table.
//
// Like `services`, there is no delete path: once a sale references a product,
// deactivating it (status: "inactive") is the only way to retire it.
export const products = pgTable("products", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  name: text("name").notNull(),
  price: numeric("price", { precision: 12, scale: 2 }).notNull(),
  status: productStatusEnum("status").notNull().default("active"),
  tags: text("tags").array().notNull().default([]),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// A product sold to a barber on credit: the same kind of debt against future
// pay as a vale, but for a physical item instead of cash. Deliberately a
// separate table from barberVouchers rather than one unified ledger — the owner
// wants to know *what* sold, which a free-text vale note can't answer.
//
// No tax or commission math is involved, exactly like barberVouchers.
//
// No updatedAt and no update path: a mistaken sale is deleted and re-entered.
export const productSales = pgTable("product_sales", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  // No onDelete cascade on either ref, same reasoning as barberActivities and
  // barberVouchers: the record of a real debt must outlive later edits to the
  // barber or to the product catalog it was created from.
  barberId: text("barber_id").notNull().references(() => barbers.id),
  productId: text("product_id").notNull().references(() => products.id),
  quantity: integer("quantity").notNull(),
  // Snapshot of products.price at sale time, for the same reason
  // barberActivities snapshots commissionRate: re-pricing a product later must
  // never retroactively change what a barber already owes for a past sale.
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(), // computed server-side
  // A plain calendar date, like barberVouchers.issuedDate.
  saleDate: date("sale_date").notNull(),
  note: text("note"),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Webhooks ──────────────────────────────────────────────────────────────────
// A generic inbound-webhook receiver: one endpoint per tenant, HMAC-SHA256
// signed, for testing payloads from other systems. Every request that hits the
// public ingest route is logged as a webhookEvent regardless of whether its
// signature verifies — a failed/unverified delivery is itself useful
// diagnostic info, not something to silently drop.

export const webhookEndpoints = pgTable("webhook_endpoints", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id).unique(),
  name: text("name").notNull(),
  signingSecret: text("signing_secret").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const webhookEvents = pgTable("webhook_events", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  endpointId: text("endpoint_id").notNull().references(() => webhookEndpoints.id, { onDelete: "cascade" }),
  headers: jsonb("headers").notNull(),
  body: jsonb("body"), // parsed JSON body, null if the raw body wasn't valid JSON
  rawBody: text("raw_body").notNull(), // kept verbatim — the signature was computed over this, not the parsed body
  sourceIp: text("source_ip"),
  signatureValid: boolean("signature_valid").notNull(),
  receivedAt: timestamp("received_at").defaultNow().notNull(),
});

// ── Cards (TwinsCards collections) ────────────────────────────────────────────
// Consumed by the TwinsCards mobile app through /api/cards/v1 — see docs/specs/cards-module.md.
// Unlike other modules, these tables need composite unique constraints: the API's upserts
// ("add the same card again = +1 quantity", "one price point per card/printing/day") rely on them.

export const cardLanguageEnum = pgEnum("card_language", ["en", "ja"]);
export const cardConditionEnum = pgEnum("card_condition", ["NM", "LP", "MP", "HP", "DMG"]);

/** Global reference data (no tenant_id): one row per card printed in a language, shared by every family. */
export const cardCatalog = pgTable("card_catalog", {
  id: text("id").primaryKey(),
  tcgdexId: text("tcgdex_id").notNull(),
  language: cardLanguageEnum("language").notNull(),
  name: text("name").notNull(),
  setId: text("set_id").notNull(),
  setName: text("set_name").notNull(),
  localId: text("local_id").notNull(),
  setOfficialCount: integer("set_official_count"),
  rarity: text("rarity"),
  imageUrl: text("image_url"), // TCGdex base URL, no extension
  marketImageUrl: text("market_image_url"),
  tcgplayerGroupId: integer("tcgplayer_group_id"), // null = not linked → no automatic price refresh
  tcgplayerProductId: integer("tcgplayer_product_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [unique("card_catalog_tcgdex_language_uq").on(t.tcgdexId, t.language)]);

/** Global, append-only price history: one row per card · printing · source · day. */
export const cardPricePoints = pgTable("card_price_points", {
  id: text("id").primaryKey(),
  catalogCardId: text("catalog_card_id").notNull().references(() => cardCatalog.id, { onDelete: "cascade" }),
  variant: text("variant").notNull(), // normal, holofoil, reverse-holofoil, … ; "default" when the source doesn't split
  source: text("source").notNull(), // TCGplayer / Cardmarket
  currency: text("currency").notNull(), // USD / EUR
  marketPrice: numeric("market_price", { precision: 12, scale: 2 }).notNull(),
  observedOn: date("observed_on").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  unique("card_price_points_card_variant_source_day_uq").on(t.catalogCardId, t.variant, t.source, t.observedOn),
  index("card_price_points_card_day_idx").on(t.catalogCardId, t.observedOn.desc()),
]);

/** A family member who collects. Created on their first API call. */
export const cardCollectors = pgTable("card_collectors", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  clerkUserId: text("clerk_user_id").notNull(),
  displayName: text("display_name").notNull(),
  isPrivate: boolean("is_private").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [unique("card_collectors_tenant_user_uq").on(t.tenantId, t.clerkUserId)]);

export const collectionItems = pgTable("collection_items", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  collectorId: text("collector_id").notNull().references(() => cardCollectors.id, { onDelete: "cascade" }),
  catalogCardId: text("catalog_card_id").notNull().references(() => cardCatalog.id),
  variant: text("variant").notNull(),
  condition: cardConditionEnum("condition").notNull().default("NM"),
  quantity: integer("quantity").notNull().default(1),
  isFavorite: boolean("is_favorite").notNull().default(false),
  notes: text("notes"),
  acquiredAt: date("acquired_at"),
  createdBy: text("created_by").notNull(), // Clerk user id — a parent may add for a kid
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  unique("collection_items_collector_card_variant_condition_uq").on(t.collectorId, t.catalogCardId, t.variant, t.condition),
  index("collection_items_tenant_collector_idx").on(t.tenantId, t.collectorId),
  check("collection_items_quantity_positive", sql`${t.quantity} > 0`),
]);

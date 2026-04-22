import { pgTable, text, timestamp, boolean, integer, numeric, jsonb, pgEnum, primaryKey } from "drizzle-orm/pg-core";

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

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

// ── Audit Logs ────────────────────────────────────────────────────────────────

export const auditLogs = pgTable("audit_logs", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  userId: text("user_id").notNull(),
  action: text("action").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

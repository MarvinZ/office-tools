import { pgTable, text, timestamp, boolean, integer, jsonb, pgEnum } from "drizzle-orm/pg-core";

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

// ── Audit Logs ────────────────────────────────────────────────────────────────

export const auditLogs = pgTable("audit_logs", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  userId: text("user_id").notNull(),
  action: text("action").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

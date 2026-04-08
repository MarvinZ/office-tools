# OfficeTools — Claude Context File

This file is for Claude to understand the project, decisions made, and what to build next.

---

## What This App Is

A multi-tenant SaaS platform where an internal admin can create client companies, enable tools for them, and each company accesses their own portal. The first tool is **Payroll** — upload an Excel file, review, and send payroll emails to employees.

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js (App Router) |
| Language | TypeScript |
| Auth | Clerk (Organizations) |
| Database | PostgreSQL via Neon |
| ORM | Drizzle ORM |
| Email | Resend |
| File Storage | Vercel Blob (not set up yet) |
| Queue / Worker | QStash (Upstash) — not set up yet |
| Styling | Tailwind CSS + shadcn/ui |
| Deployment | Vercel |

---

## Architecture Decisions

### Multi-Tenancy
- Each client company = one **Clerk Organization**
- Internal team (admins) = separate Clerk Organization
- Tenant context is resolved from the Clerk org the user belongs to
- **Subdomains are deferred** — no domain yet. When ready, each client gets `slug.domain.com`. For now, routing is path-based or org-based.
- Every DB table that holds tenant data must have a `tenant_id` column — enforce this on every query.

### Admin vs User
- Admins = members of the internal Clerk org
- Admins access `/admin` routes — protected by role check
- Regular users = members of a client Clerk org — access their tenant dashboard
- Admin can impersonate/enter a client context to manage it

### Tools System
- Tools are features that can be enabled/disabled per tenant
- Tool list lives in the DB (`tools` table)
- Tenant-tool mapping lives in a join table (`tenant_tools`)
- Nav menu on the tenant dashboard shows only enabled tools
- Currently only **Payroll** tool is defined. Architecture must support adding more tools later without schema changes.

### Payroll Tool Flow
1. User uploads `.xlsx` file
2. System hashes file to detect duplicates
3. File stored in Vercel Blob
4. File parsed → rows extracted → validated
5. Draft batch created (status: `draft`)
6. User reviews data + email preview
7. User confirms → batch status → `queued`
8. QStash worker picks up batch → sends emails via Resend → updates status per email
9. User can retry failed, resend sent, or cancel queued batches

### Email Sending
- Provider: Resend
- Emails are sent per-row from the Excel file
- Each email tracked individually in DB (status: queued / sent / failed)
- Worker processes asynchronously via QStash
- Retry = new email record, not mutation of existing

### File Storage
- Provider: Vercel Blob
- Files stored after upload
- Download via signed/secure URL (US-10.4)
- Deduplication via SHA-256 hash before storing

### Audit Logs
- Log uploads and email lifecycle events
- Stored in DB, queryable per tenant

---

## Database Tables (planned, not yet created)

- `tenants` — id, name, slug, clerk_org_id, is_active, created_at
- `tools` — id, name, slug, description
- `tenant_tools` — tenant_id, tool_id, enabled_at
- `payroll_uploads` — id, tenant_id, filename, blob_url, file_hash, label, created_by, created_at
- `payroll_batches` — id, tenant_id, upload_id, status (draft/queued/processing/sent/cancelled), created_at
- `payroll_emails` — id, batch_id, tenant_id, recipient_email, payload (json), status (queued/sent/failed), sent_at, error
- `audit_logs` — id, tenant_id, user_id, action, metadata (json), created_at

---

## Current State

### Done
- [x] Next.js app scaffolded
- [x] Clerk auth integrated (sign in / sign up / dashboard)
- [x] Neon database connected
- [x] Resend connected
- [x] Landing page with login
- [x] Protected dashboard with user greeting
- [x] Basic send email form on dashboard (proof of concept)
- [x] Deployed to Vercel

### In Progress / Next
- [ ] Set up Vercel Blob (user needs to do this in Vercel dashboard)
- [ ] Get sample Excel file from user to define payroll schema
- [ ] DB schema + migrations (Drizzle)
- [ ] Clerk Organizations wired to tenant system
- [ ] Admin dashboard — create/manage clients, enable tools
- [ ] Tenant dashboard — tools nav
- [ ] Payroll upload + processing pipeline
- [ ] Email batch review UI
- [ ] QStash worker for email sending
- [ ] Retry / resend / cancel flows
- [ ] Audit logs UI

### Deferred
- [ ] Subdomain routing — waiting on domain purchase

---

## Blocked On (needs user input)

1. **Sample Excel file** — needed to define payroll column schema and build the parser
2. **Vercel Blob setup** — user needs to enable it in Vercel dashboard and add `BLOB_READ_WRITE_TOKEN` to env

---

## File Structure

```
src/
  app/
    page.tsx                  # Landing page
    layout.tsx                # Root layout (ClerkProvider)
    dashboard/
      layout.tsx              # Dashboard layout with nav + UserButton
      page.tsx                # Dashboard home
      actions.ts              # Server actions (email send)
      send-email-form.tsx     # Client component (email form)
    sign-in/[[...sign-in]]/   # Clerk sign-in page
    sign-up/[[...sign-up]]/   # Clerk sign-up page
  db/
    index.ts                  # Drizzle + Neon client
    schema.ts                 # DB schema (empty, to be built)
  lib/
    resend.ts                 # Resend client
    utils.ts                  # cn() utility
  middleware.ts               # Clerk auth middleware
```

---

## Key Conventions
- Server actions in `actions.ts` co-located with the route that uses them
- Client components explicitly marked with `"use client"`
- All DB queries must filter by `tenant_id`
- Never expose internal tenant data across org boundaries
- Env vars: see `.env.local` (never commit this file)

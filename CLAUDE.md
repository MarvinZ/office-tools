# OfficeTools — Claude Context File

This file is for Claude to understand the project, decisions made, and what to build next.

---

## What This App Is

A multi-tenant SaaS platform: an internal admin creates client companies ("tenants"), enables tools per tenant, and each tenant gets a portal showing only its enabled tools. This is the founder's own "tool of tools" — a suite of small business-ops modules (payroll, employees, assets, clients, providers, quotes, invoices, coverage mapping) intended to eventually be sold as a product.

**This is a real, working app, not a scaffold.** Multi-tenancy, tool-gating, auth, i18n, and 8 feature modules are implemented against a live Neon Postgres schema. Treat it accordingly — changes should match the quality bar of the existing code, not greenfield-prototype shortcuts.

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 16 (App Router), React 19 |
| Language | TypeScript |
| Auth | Clerk (Organizations = tenants) |
| Database | PostgreSQL via Neon (+ PostGIS for coverage areas) |
| ORM | Drizzle ORM |
| Email | Resend |
| File Storage | Vercel Blob |
| Queue / Worker | QStash (Upstash) — used for payroll email fan-out |
| i18n | next-intl (EN/ES) |
| Styling | Tailwind CSS v4 + shadcn/ui + next-themes (dark mode) |
| Forms | react-hook-form + zod |
| Deployment | Vercel |

---

## Architecture

### Multi-Tenancy
- Each client company = one **Clerk Organization**. The internal team is a separate Clerk org, identified by `INTERNAL_ORG_ID` env var.
- `src/services/tenants.ts` resolves the current tenant from the signed-in user's active Clerk org (`getCurrentTenant`/`requireTenant`, matched via `tenants.clerkOrgId`).
- `src/app/(app)/layout.tsx` redirects internal-org members to `/admin`; everyone else must resolve to a tenant or gets sent to `/select-org`.
- Every tenant-owned table has a `tenant_id` column (text, references `tenants.id`). All queries must filter by it — there is no RLS, so this is enforced by convention in the `services/*` layer only. Be careful here when adding new queries.
- Subdomain routing is still deferred (no domain yet) — routing is org-based via Clerk's active-org switching, not path/subdomain based.

### Admin vs Tenant Apps
- Two route groups: `src/app/(admin)/` and `src/app/(app)/`.
- `(admin)` — internal org only. Admins list/create tenants (`admin/page.tsx`), open a tenant detail page (`admin/[id]/`) to toggle active status and enable/disable tools (`tool-toggles.tsx`, `status-toggle.tsx`), and there's a demo-seed panel for spinning up demo data per tenant.
- `(app)` — the tenant-facing product. Nav in `(app)/layout.tsx` filters to only the tools enabled for that tenant.

### Tools System
- `tools` table + `tenant_tools` join table (see `src/db/schema.ts`). Enabled tools per tenant are read via `adminGetEnabledTools` (`src/services/admin/tenants.ts`).
- Current tools (seeded in `src/db/seed-tools.ts`): **payroll, assets, employees, quotes, clients, providers, invoices, coverage**.
- Adding a new tool = new row in `TOOLS` seed array + a new route under `(app)/` + nav entry in `(app)/layout.tsx`'s `NAV_LINKS`. No schema changes needed for the gating mechanism itself.

### Payroll Tool Flow (the original flagship flow, now one of many)
1. Upload `.xlsx` (`(app)/payroll/_components/upload-zone.tsx`) → parsed via `src/lib/payroll/parser.ts`.
2. File hashed (dedup) and stored in Vercel Blob → `payroll_uploads` row.
3. Draft `payroll_batches` row created → user reviews rows + email preview (`[batchId]/_components/batch-review.tsx`).
4. On confirm, batch → `queued`, one `payroll_emails` row per recipient, QStash fans out a job per email to `src/app/api/workers/payroll/send-email/route.ts`.
5. Worker verifies the QStash signature, sends via Resend, updates `payroll_emails.status`, and flips the batch to `sent`/`failed` once all rows are terminal.
6. Retry = new email record (not a mutation of the old one) — not yet built, still TODO.

**Known dev shortcuts still in the payroll path (`src/lib/constants.ts`)** — needs cleanup before this is real:
- `DEV_ROW_LIMIT` caps processed rows to 20, hardcoded in `[batchId]/page.tsx` and `[batchId]/actions.ts`.
- `DEV_EMAIL_OVERRIDE` sends every email to one hardcoded address instead of the real per-row recipient — the Excel schema doesn't have a real email column wired in yet.

### Other Modules (clients, providers, employees, assets, quotes, invoices, coverage)
- All follow the same shape: `services/<module>/*.ts` (tenant-scoped DB access) → `(app)/<module>/actions.ts` (server actions) → `page.tsx` + `_components/*-list-client.tsx` (client list/detail UI) → optional `[id]/` detail route with tabs, documents, notes, activity history.
- Quotes and invoices share a near-identical shape (line items + activity log + status enum) and both link to `clients`.
- Assets and employees both support document/photo uploads to Vercel Blob and have their own history/audit tables (`asset_history`, activity logs).
- Coverage is different: maps trade-based service areas as PostGIS polygons (`coverage_areas.geom`), rendered via `@react-google-maps/api` in `coverage-map-client.tsx`.
- **Note:** several modules import shared constants/enums/types from a folder literally named `_mock/data.ts` (e.g. `clients/_mock/data.ts`, `assets/_mock/data.ts`). Despite the name, this is **not fake data** — it's real constants (status configs, industry lists, category enums) that got left in a mock-data folder from early scaffolding. Real data comes from the DB via `services/*`. This naming is misleading and worth renaming (e.g. to `_constants/` or `_lib/`) but is not a functional bug.

### File Storage
- Vercel Blob, already configured and in use (asset photos/documents, employee documents, payroll uploads).
- Dedup via SHA-256 hash on payroll uploads.

### i18n & Theming
- `next-intl` with EN/ES locales (`src/i18n/request.ts`, `locale-switcher.tsx`); locale set via a server action in `src/app/actions/locale.ts`.
- Dark mode via `next-themes` (`theme-provider.tsx`, `theme-toggle.tsx`).

---

## Database

Schema lives entirely in `src/db/schema.ts` (Drizzle). No separate migrations-as-docs — the file itself is the source of truth. Key table families:

- **Platform**: `tenants`, `tools`, `tenant_tools`
- **Payroll**: `payroll_uploads`, `payroll_batches`, `payroll_emails`
- **Employees**: `departments`, `employees`, `employee_documents`
- **Assets**: `assets`, `asset_photos`, `asset_documents`, `asset_history`
- **Clients**: `clients`, `client_contacts`, `client_documents`, `client_notes`
- **Providers**: `providers`, `provider_contacts`, `provider_documents`, `provider_notes`
- **Quotes**: `quotes`, `quote_line_items`, `quote_activity`
- **Invoices**: `invoices`, `invoice_line_items`, `invoice_activity`
- **Coverage**: `trades`, `coverage_areas` (PostGIS geometry column)
- **Audit**: `audit_logs` (table exists; not yet consistently written to or surfaced in UI)

Run `npm run db:push` (or `db:generate`/`db:migrate`) after schema changes. Seed scripts: `db:seed`, `db:seed-tools`, `db:seed-trades`. PostGIS setup: `npm run db:setup-postgis`.

---

## Current State

### Working end-to-end
- Clerk auth + Clerk Organizations as tenants, admin org routed separately
- Admin dashboard: create tenants, toggle active status, enable/disable tools per tenant, demo data seeding
- Tenant dashboard with tool-gated nav
- Payroll: upload → parse → draft → review → queue → QStash → Resend send, with per-email status tracking
- Employees, Assets, Clients, Providers, Quotes, Invoices — full CRUD + detail pages, documents/notes/activity where applicable
- Coverage: trade-based service area mapping with PostGIS + Google Maps
- i18n (EN/ES), dark mode

### Known gaps / cleanup needed
- [ ] Payroll dev hardcodes: `DEV_ROW_LIMIT` (20-row cap) and `DEV_EMAIL_OVERRIDE` (all emails go to one address) — need the Excel schema to include a real recipient email column, then remove both
- [ ] Payroll retry/resend/cancel flows for batches — not built yet
- [ ] `audit_logs` table exists but isn't consistently written or surfaced in any UI
- [ ] `_mock/data.ts` folders (clients, providers, assets, quotes, invoices) hold real constants/enums, not mock data — misleading name, should be renamed
- [ ] Subdomain routing — deferred until a domain is purchased; tenant resolution is Clerk-org-based for now

### Deferred
- [ ] Subdomain routing per tenant (`slug.domain.com`)

---

## File Structure (high level)

```
src/
  app/
    (admin)/admin/              # internal-org-only: tenant CRUD, tool toggles
    (app)/                      # tenant product: payroll, assets, employees,
                                 # clients, providers, quotes, invoices, coverage
    api/
      workers/payroll/send-email/route.ts   # QStash worker, signature-verified
      files/route.ts
      email/test/route.ts
    select-org/                 # shown when a user has no resolvable tenant
    sign-in/ sign-up/
  db/
    schema.ts                   # single source of truth for DB schema
    seed.ts / seed-tools.ts / seed-trades.ts
  services/
    tenants.ts                  # tenant resolution (getCurrentTenant/requireTenant)
    admin/                      # admin-only tenant + tool management
    payroll/ employees/ assets/ clients/ providers/ quotes/ invoices/ coverage/
  lib/
    payroll/parser.ts, email-template.ts
    resend.ts, qstash.ts
    constants.ts                # DEV_* hardcodes — see "Known gaps" above
  i18n/                         # next-intl config
  proxy.ts                      # Clerk middleware (renamed from middleware.ts for Next 16)
```

---

## Key Conventions
- Server actions live in `actions.ts` co-located with the route that uses them; DB access goes through `services/<module>/*.ts`, not directly from actions/pages.
- Client components explicitly marked `"use client"`.
- **All tenant-data queries must filter by `tenant_id`** — there's no DB-level enforcement (no RLS), so this is a manual discipline everywhere in `services/*`.
- Never expose data across tenant/org boundaries — double-check this in any new service function.
- Env vars in `.env.local` (gitignored, never commit). Required: `DATABASE_URL`, Clerk keys, `INTERNAL_ORG_ID`, Resend key, `BLOB_READ_WRITE_TOKEN`, QStash token + signing keys, Google Maps key (coverage).
- Middleware file is `src/proxy.ts`, not `middleware.ts` — renamed for a Next.js 16 compatibility fix. Don't rename it back.

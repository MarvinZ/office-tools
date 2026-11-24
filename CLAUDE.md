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
- Current tools (seeded in `src/db/seed-tools.ts`): **payroll, assets, employees, quotes, clients, providers, invoices, coverage, barbers, webhooks, cards**.
- Adding a new tool = new row in `TOOLS` seed array + a new route under `(app)/` with a `layout.tsx` that calls `requireTool(slug)` + nav entry in `(app)/layout.tsx`'s `NAV_LINKS`. No schema changes needed for the gating mechanism itself.
- **Gating is enforced, not just hidden:** every tool folder's `layout.tsx` calls `requireTool(slug)` (`src/services/tenants.ts`), which redirects to /dashboard unless the tool is enabled AND the tenant `isActive`. Route handlers skip layouts, so they call `getAvailableTools(tenant)` themselves. Server actions are not individually gated (only reachable from gated pages), except in Barbers, where every action checks the person's role.

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
- **Building a new module? Read [`MODULE_BLUEPRINT.md`](./MODULE_BLUEPRINT.md) first.** It's the exact as-built pattern (schema shape, service conventions, action file split, component layout, i18n structure, tool-gating steps) derived from the `clients` module, including where it diverges from this file's stack table (no zod/react-hook-form in practice — see blueprint §0).
- Quotes and invoices share a near-identical shape (line items + activity log + status enum) and both link to `clients`.
- Assets and employees both support document/photo uploads to Vercel Blob and have their own history/audit tables (`asset_history`, activity logs).
- Coverage is different: maps trade-based service areas as PostGIS polygons (`coverage_areas.geom`), rendered via `@react-google-maps/api` in `coverage-map-client.tsx`.
- **Note:** several modules import shared constants/enums/types from a folder literally named `_mock/data.ts` (e.g. `clients/_mock/data.ts`, `assets/_mock/data.ts`). Despite the name, this is **not fake data** — it's real constants (status configs, industry lists, category enums) that got left in a mock-data folder from early scaffolding. Real data comes from the DB via `services/*`. This naming is misleading and worth renaming (e.g. to `_constants/` or `_lib/`) but is not a functional bug.

### Barbers Module (`(app)/barbers/`) — built for NOURA Center, a Costa Rica barbershop/salon
- Front-desk logging of services per barber/location/payment method, daily check-in roster, vales (cash advances), product sales on credit, tips, payout report, and **fortnightly settlements** ("liquidaciones").
- Source spec: `NOURA_Especificacion_Funcional_Tecnica_Sistema_Liquidaciones.pdf` (v1.3, not in repo — contains personal/bank data). **Keep it simple**: small shop, plain per-barber fields over rule engines.
- **Settlement engine** is a pure function in `src/lib/barbers/settlement.ts` (decimal.js, no intermediate rounding, unit-tested against the spec's CA cases in `settlement.test.ts`). `services/barbers/settlements.ts` only loads data and calls it. Per line: commission = price ÷ (1+IVA) × rate. Card fee = base × payment method `feeRate`, a settlement deduction (not a commission reduction). Maintenance = days with ≥1 service × daily fee. Then net → IVA → invoice → + tips = transfer.
- Per-barber settlement fields live on `barbers` (`appliesMaintenance`, `ivaBaseRate`, `ivaInformative`, `fortnightlyAddition`); shop-wide IVA % and maintenance fee in `barber_settings` (one row per tenant). No effective dating on purpose: settlements are computed live while a fortnight is open; **closing** it (Barbers admins, `barber_fortnight_closings`) stores the full result as a jsonb snapshot, which is what the page/exports show from then on (with a warning if live data drifts). Closings are versioned: reopen stamps `reopenedAt` on the current row (kept as history, viewable with `?version=N`), closing again adds version+1; a partial unique index allows one current closing per fortnight. Carry-over is **manual** (spec §8.1/§8.5): on a closed fortnight an admin moves all or part of a barber's shortfall to the next one (`barber_carry_overs`), deducted there as `carryOver`. Barbers with `shortfallToSalary` (Brayan) never carry; their shortfall is shown as a salary deduction. Reopening requires a reason.
- Barbers also hold `idNumber` (cédula), `iban` and `aliases` (spellings used in CIERRE files, for the importer). Personal data — tenant-only.
- Exports: `settlements/export` route → .xlsx (summary, bank transfers, one sheet per barber; route checks tenant + tool itself since route handlers skip layouts). `settlements/print` → printable per-barber pages; "Save as PDF" in the browser is the PDF export (no PDF lib). Both share `src/lib/barbers/settlement-document.ts`.
- **Dates are Costa Rica business days** (`src/lib/barbers/dates.ts`, fixed UTC−6). Never bucket `performedAt` by UTC day.
- **Daily-closing import** (`/barbers/imports`, spec §4): pure parsers (`parse-facturacion.ts`, `parse-cierre-general.ts`) and a pure **planner** (`plan-import.ts`) decide everything: name matching (exact, via aliases; unknown names become questions, answerable with a barber, "create new" or "not a professional"), supplier lines (Meterasa/Metersa…) kept apart, rate = barber's `fixedCommissionRate` else the written %, any cash outflow made out to a professional = deduction, services on credit deducted from the receiver (§8.2), products on credit from G40:L45. `services/barbers/closing-imports.ts` previews (read-only) and imports in ONE `db.batch` per file (retire the date's previous import, delete its rows, insert the new file + rows); originals go to Vercel Blob with a random suffix; `barber_closing_files` keeps hash, version and a summary. Imported lines have `serviceId = null` + `description`, and carry `closingFileId`/`sourceRow`/`ticketId`/`writtenRate`. Import is admin-only; a closed fortnight blocks it.
- **Real client files** (personal + bank data) live in gitignored `docs/files/` and `fixtures/noura/`. `closing-import/noura-nov-2026.golden.test.ts` imports the real 1–15 Nov 2026 closings and compares every person's payment with the accountant's slips (6/9 exact, 3 known data gaps); it skips itself where the files aren't present.
- Shop settings also hold `cardFeeOnGross` (accountant charges 6.5% on the IVA-included price; spec §6.5 says on the base) and `invoiceEmail` (printed on receipts). Engine output splits `invoice` (IVA-bearing part + IVA) from `nonInvoiced` (Maicol's other 50%). Receipts (`settlementDocLines(s, "receipt")`) omit the IVA line for people paid without IVA.
- **Services are never deleted** (spec §8.7–8.10): `barber_activities.status` is active / voided (reason required, excluded from pay and days) / courtesy (normal commission, no card fee) / warranty (a redo row pointing at the original via `warrantyOfActivityId`; same barber = rate 0, colleague = their rate, and the original barber gets a `warrantyClawback` in the redo's fortnight). Row actions live in `_components/activity-row-actions.tsx`.
- **Audit trail:** every pay-affecting action calls `auditBarbers()` (`services/barbers/audit.ts`, stored in `audit_logs` with `barbers.*` actions, field-level old→new + reason). Add a call for any new pay-affecting action. Shown at `/barbers/history` and on each barber page.
- Engine output includes `byRate` (services per commission rate) → "By commission rate" table + Excel sheet (spec §10.3 mixtos).
- **Dated commission changes** (Brayan's "option B"): `barber_rate_changes` (scope = barber fixed rate or one service; rate or null; `effectiveFrom`; `previousRate`). Rates resolve as of each service's own date (`lib/barbers/rate-schedule.ts`); `barbers.fixed_commission_rate` / `barber_service_rates` mirror the value in force today. A change starting in the past re-rates logged services from that date in open fortnights only. All rate edits go through `recordRateChange`.
- **Product sales to customers + product closing** (`/barbers/product-closing`): products have a fixed `commissionAmount` per unit and `chargesIva` (IVA added on top of the price). `product_customer_sales` snapshots price/IVA/commission; commissions are paid there (pending → paid, date, optional cash outflow), never in the service settlement. Math in `lib/barbers/product-commissions.ts`. (`product_sales` = products sold to barbers on credit, a different thing.)
- **Roles** (`lib/barbers/permissions.ts`, `services/barbers/roles.ts`): admin / cashier / accountant over areas operate / view / settle / configure. `barber_member_roles` is authoritative inside Barbers (Team invites used to make everyone org:admin); no row → org:admin = admin, else cashier. Every Barbers server action starts with `requireBarbersAccess([...])`, every section folder has a layout calling `requireBarbersPage(PAGE_AREAS[...])`, export routes check `can(role, "view")`, and tabs are filtered by role. Add all three for any new Barbers page/action.
- **Cash shortfalls** (`/barbers/cash`): per-shift differences (CIERRE GENERAL row 25) stored in each imported closing's summary; a positive difference is charged to that shift's cashier in the same fortnight (report only; cashier pay is outside the system).
- **Errors shown to people** (all Barbers actions): services throw `BarbersError(code, values)` (`lib/barbers/errors.ts`); every action body is wrapped in `barbersAction()` (`services/barbers/action.ts`), which returns `{ ok, data | error }` with the message translated from `barbers.errors.<code>`. Next.js hides thrown messages in production, so never rely on `throw new Error("…")` reaching the screen. Client code calls actions through `unwrap(...)`, which throws the translated message for the usual `catch (e) { setError(e.message) }`. New error → add a code + EN/ES text.
- Tests: `npm test` (Vitest).

### Cards module (TwinsCards mobile backend)
- Spec: `docs/specs/cards-module.md`. First module consumed by a **native app**: JSON REST under `/api/cards/v1/*`, not server actions. Tenant = family, Clerk user = collector, `org:admin` = parent.
- Auth: `Authorization: Bearer <Clerk session JWT>`. `/api/cards/(.*)` is public in `proxy.ts`; `requireCardsApiContext` (`src/lib/cards/api-auth.ts`) authenticates and returns JSON 401/403/409. Tool gating uses `getAvailableTools` (route handlers skip layouts). Every handler is wrapped in `withCardsApi` so errors are always JSON.
- Diverges from the blueprint on purpose: zod validation (`src/lib/cards/validation.ts`), composite unique constraints + indexes (the upserts depend on them), money as integer cents (`src/lib/cards/money.ts`), and it writes `audit_logs` (`src/services/audit.ts`).
- `card_catalog` / `card_price_points` are **global** (no tenant_id); `card_collectors` / `collection_items` are tenant data.
- Pure logic lives in `src/lib/cards/*` and is unit-tested with Vitest (`npm test`).
- DB has **no transactions** (neon-http): use `db.batch([...])` when two writes must be atomic.
- Not built yet (milestone B2): `/summary` endpoint, daily TCGCSV price-refresh worker + QStash schedule.

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
- **Webhooks**: `webhook_endpoints` (one per tenant, HMAC-SHA256 signing secret), `webhook_events` (logged payloads, verified or not)
- **Barbers**: `barbers`, `locations`, `services`, `products`, `payment_methods`, `barber_settings`, `barber_activities`, `barber_vouchers`, `barber_tips`, `product_sales` (to barbers, on credit), `product_customer_sales`, `barber_rate_changes`, `barber_fortnight_closings`, `barber_carry_overs`, `barber_closing_files`, `barber_member_roles`, plus roster/location/rate join tables
- **Cards**: `card_catalog`, `card_price_points` (global), `card_collectors`, `collection_items`
- **Audit**: `audit_logs` — written by Barbers (`barbers.*`, shown in its History) and Cards; the other modules don't write it yet

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
- Barbers (NOURA): front desk, daily-closing import, fortnightly settlements with closing/versions, exports, dated commissions, product closing, roles, audit trail — validated against the accountant's November 2026 slips
- Webhooks: tenant-configured single inbound endpoint (`/api/webhooks/ingest/[endpointId]`), HMAC-SHA256 verified (`X-Signature` header, raw body), logs every delivery (verified or not) for inspection in the portal
- i18n (EN/ES), dark mode

### Known gaps / cleanup needed
- [ ] Payroll dev hardcodes: `DEV_ROW_LIMIT` (20-row cap) and `DEV_EMAIL_OVERRIDE` (all emails go to one address) — need the Excel schema to include a real recipient email column, then remove both
- [ ] Payroll retry/resend/cancel flows for batches — not built yet
- [ ] `audit_logs` is written by Barbers and Cards only; other modules don't record changes yet
- [ ] Server actions outside Barbers throw `Error` for user-facing problems; Next.js hides those messages in production, so people see a generic error (Barbers solved this with `barbersAction` + `unwrap`)
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
- Never expose data across tenant/org boundaries — double-check this in any new service function. Lookups by id must include `tenantId` in the same WHERE (child rows may rely on a parent already verified).
- `/dev`, `/api/files` and `/api/email/test` are early scaffolding and 404 in production (unscoped blob listing / open email relay). Don't re-enable them there.
- Env vars in `.env.local` (gitignored, never commit). Required: `DATABASE_URL`, Clerk keys, `INTERNAL_ORG_ID`, Resend key, `BLOB_READ_WRITE_TOKEN`, QStash token + signing keys, Google Maps key (coverage).
- Middleware file is `src/proxy.ts`, not `middleware.ts` — renamed for a Next.js 16 compatibility fix. Don't rename it back.

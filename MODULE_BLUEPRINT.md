# Module Blueprint — exact pattern to copy for any new tool module

This file exists so Claude (or any dev) doesn't have to re-derive the module pattern
from scratch by reading the `clients` module every time. It documents the **as-built**
pattern precisely, including where it diverges from what CLAUDE.md's stack table implies.

Reference implementation studied: `clients` module (schema + services + actions + pages).
Keep this file updated if the pattern evolves — it should always reflect current reality,
not aspiration.

---

## 0. IMPORTANT divergence from CLAUDE.md

CLAUDE.md's stack table says "Forms: react-hook-form + zod." **This is aspirational, not
as-built.** No module (clients included) uses zod or react-hook-form anywhere under `src/app`.
Forms are plain controlled components: per-field `useState`, native HTML `required` /
`type="email"` / `type="number"` validation. Server actions accept loosely-typed input
objects with **no runtime validation at the action boundary**.

Default to matching this as-built pattern (no zod/RHF) for a new module unless the user
explicitly asks to introduce real validation — don't silently upgrade one module while
the rest of the app doesn't have it; that's an inconsistency, not an improvement.

---

## 1. Schema (`src/db/schema.ts`)

Per module, define (in this order): enums → parent table → child tables.

```ts
export const <module>StatusEnum = pgEnum("<module>_status", [...]);
// other module-specific enums (e.g. payment terms, doc type)

export const <module>s = pgTable("<module>s", {
  id: text("id").primaryKey(),                    // app-generated crypto.randomUUID(), NOT a DB default
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  // ...module fields. Free-text "enum-ish" fields (e.g. industry) are just text,
  // with options living in _mock/data.ts, not a pg enum.
  // numeric money fields: numeric("x", { precision: 12, scale: 2 }) — comes back as STRING from the driver
  createdBy: text("created_by").notNull(),        // Clerk user id, not a FK
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const <module>Contacts = pgTable("<module>_contacts", {
  id: text("id").primaryKey(),
  <module>Id: text("<module>_id").notNull().references(() => <module>s.id, { onDelete: "cascade" }),
  tenantId: text("tenant_id").notNull().references(() => tenants.id), // DENORMALIZED onto every child table
  // ...
});
// same shape for <module>Documents (blobUrl: text, type enum, uploadedBy) and <module>Notes (body, createdBy)
```

Rules:
- No `index()` calls anywhere — tenant isolation is enforced only in the service layer
  via `.where(eq(table.tenantId, tenantId))`, never DB-level RLS. Treat this as mandatory
  discipline when writing new service functions.
- Child tables always carry their own `tenantId` (not just inherited via the parent join) —
  lets child queries filter by tenant without a join.
- `clientId`-style FKs use `onDelete: "cascade"`; `tenantId` FKs do not set onDelete.

## 2. Services layer (`src/services/<module>/<module>.ts`)

**Single file**, not split per entity. Structure with banner comments in this order:
Raw row types → Composite types → Queries → `<Module>` mutations → Contacts → Documents → Notes.

```ts
export type <Module>Row = InferSelectModel<typeof <module>s>;
export type <Module>WithRelations = <Module>Row & { contacts; documents; notes };
export type <Module>ListItem = <Module>Row & { primaryContact: Pick<...> | null };
export type <Module>Input = { /* plain object, no zod */ };

export async function list<Module>s(tenantId: string) { ... }       // batched primary-contact lookup, no N+1
export async function get<Module>(tenantId: string, id: string) { ... } // row + Promise.all of children
export async function create<Module>(tenantId: string, createdBy: string, data: <Module>Input) { ... } // crypto.randomUUID() in service
export async function update<Module>(tenantId: string, id: string, data: Partial<<Module>Input>) { ... }
export async function delete<Module>(tenantId: string, id: string) { ... }
export async function add<Module>Contact / update<Module>Contact / delete<Module>Contact(...)
export async function add<Module>Document / delete<Module>Document(...)
export async function add<Module>Note / delete<Module>Note(...)
```

Rules:
- `tenantId` is **always the first parameter** of every exported function. Hard convention.
- Every query/mutation: `and(eq(table.tenantId, tenantId), eq(table.id, id))` — tenant filter
  always present, always listed first inside `and(...)`.
- Setting a contact `isPrimary: true` first demotes the existing primary with a separate
  `update` before the insert/update.
- `numeric` columns: `String(data.x)` on write; `parseFloat(row.x)` on read (conversion
  happens in the component, not the service).
- No raw SQL.

## 3. Server actions — split by route, not one big file

- `src/app/(app)/<module>/actions.ts` — only the **create** action (list page owns creation).
- `src/app/(app)/<module>/[id]/actions.ts` — update/delete/contact/document/note actions
  (detail-page-scoped).

```ts
"use server";
export async function update<Module>Action(id: string, data: Partial<<Module>Input>) {
  const tenant = await requireTenant();
  await update<Module>(tenant.id, id, data);
  revalidatePath("/<module>");
  revalidatePath(`/<module>/${id}`);
}
```

- `requireTenant()` from `@/services/tenants` — called at the top of nearly every action/page;
  redirects to `/select-org` if no tenant resolves.
- When Clerk user id is needed: `const [user, tenant] = await Promise.all([currentUser(), requireTenant()]);`
  then throw `new Error("Not authenticated.")` if `user` missing.
- Delete actions call `redirect("/<module>")` after deleting.
- Actions return `void` — no `{success, error}` wrapper shape, no try/catch; errors bubble
  to Next's error boundary.

## 4. Pages/components

```
src/app/(app)/<module>/
  actions.ts                              — create action
  page.tsx                                 — server list page: getTranslations + requireTenant + list<Module>s
  _mock/data.ts                            — REAL constants (enums/STATUS_CONFIG/option arrays), not mock data
  _components/
    <module>-list-client.tsx               — "use client", local useState filters (search/status/etc), client-side filtering, table with status pill + Link to [id]
    <module>-form.tsx                      — shared create/edit form. Plain useState per field, NOT react-hook-form/zod. `initial?: Partial<Input> & {id?}` prop toggles add/edit copy. Sectioned (e.g. Company/Financial/Address/Tags) via a `sectionCls` label style.
    create-<module>-modal.tsx              — "use client", hand-rolled `fixed inset-0` overlay (no shadcn Dialog), useTransition -> action -> router.refresh()
  [id]/
    actions.ts
    page.tsx                               — server detail page: breadcrumb, header (avatar initials + status pill + Edit modal), stat cards, then Tabs component
    _components/
      <module>-tabs.tsx                    — "use client", local `tab` state over `TAB_IDS = [...] as const`, tab buttons show count badges, each tab body is an inline conditional block (not separate route segments)
      edit-<module>-modal.tsx              — reuses the shared form; builds initialData by hand (string->number, Date->"YYYY-MM-DD")
```

Note: when wiring Notes, make sure an actual add-note composer UI exists consuming
`addNoteAction`/`deleteNoteAction` — in the clients module this was easy to leave as
scaffold-only (actions exist, no UI calls them). Don't repeat that gap unless intentional.

## 5. `_mock/data.ts`

Despite the folder name, this holds **real constants**, not fake/demo data:
- Status/enum literal union types
- `STATUS_CONFIG: Record<Status, {color, dot}>` — Tailwind class strings for pills
- Option arrays (e.g. `PAYMENT_TERMS_OPTIONS`, `INDUSTRIES`)

Any `MOCK_*` fleshed-out fake-entity arrays are leftover/dead from pre-DB scaffolding —
don't replicate those for a new module, just the enums/config/options.

## 6. Tools registration (gating — no schema changes needed)

1. `src/db/seed-tools.ts` — append to `TOOLS` array:
   ```ts
   { id: "tool_<module>", name: "<Module>", slug: "<module>", description: "..." }
   ```
   Upserted via `.onConflictDoNothing()`.
2. `src/app/(app)/layout.tsx` — append to `NAV_LINKS`:
   ```ts
   { slug: "<module>", href: "/<module>", labelKey: "nav.<module>" }
   ```
   Layout filters `NAV_LINKS` by `adminGetEnabledTools(tenant.id)` slugs.
3. Admin toggle UI (`(admin)/admin/[id]/_components/tool-toggles.tsx`) needs no changes —
   it reads the `tools` table generically. `adminEnableTool`/`adminDisableTool` in
   `src/services/admin/tenants.ts` insert/delete `tenantTools` rows.

## 7. i18n (`messages/en.json`, `messages/es.json`)

Top-level key `"<module>"` namespaced into:
- `page` — title/subtitle/addButton
- `list` — search/filters/column headers/empty/resultsCount
- one group per enum (`status`, `paymentTerms`, `docType`, ...) — one key per enum value
- `form` — section headers + `field<Name>` / `field<Name>Placeholder` pairs + cancel/create/save labels
- `detail` — stat labels, tab labels, section/field labels, `edit`, `primaryBadge`,
  `<x>Empty` empty-states

Also add one line to the shared top-level `"nav"` namespace: `"nav.<module>": "..."`.
Reuse the shared `"common"` namespace for cross-module strings (`notApplicable`, `added`,
`download`) via a second `useTranslations("common")` call aliased as `tc`.

Mirror the exact same nesting in both `en.json` and `es.json` — don't let locales drift.

---

## Full file checklist for a new `<module>`

```
src/db/schema.ts                                   — enums + <module>/<module>_contacts/_documents/_notes tables
src/db/seed-tools.ts                                — tool row
src/services/<module>/<module>.ts                   — single file, tenantId-first functions
src/app/(app)/<module>/
  actions.ts
  page.tsx
  _mock/data.ts
  _components/
    <module>-list-client.tsx
    <module>-form.tsx
    create-<module>-modal.tsx
  [id]/
    actions.ts
    page.tsx
    _components/
      <module>-tabs.tsx
      edit-<module>-modal.tsx
src/app/(app)/layout.tsx                            — NAV_LINKS entry
messages/en.json, messages/es.json                  — "nav.<module>" + "<module>.{page,list,...,form,detail}"
```

After schema changes: `npm run db:push` (or `db:generate`/`db:migrate`).

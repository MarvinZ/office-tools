# OfficeTools and the Barbers module: status brief

**Audience:** an AI assistant helping Marvin Zumbado (founder and developer of OfficeTools) prepare answers and decisions for NOURA Center, the barbershop client.
**As of:** 24 November 2026 (updated after NOURA's answers, the real November files and the daily-closing importer).
**Source spec:** *Especificación funcional y técnica del sistema de liquidaciones de NOURA Center*, v1.3, 29 October 2026. It isn't in the repo because it contains personal and bank data. Section numbers like "§8.7" below refer to that spec.

Part 1 explains the platform. Part 2 covers the Barbers module: what it does, how close it is to the spec, what's blocked, and the open questions with the background needed to answer them.

---

## Part 1: OfficeTools

### What it is

OfficeTools is a multi-tenant web application: one platform that hosts many small business tools ("modules"). Marvin's internal team creates a client company (a **tenant**), turns on the modules that company needs, and the company's staff sign in to a portal that shows only those modules. The goal is to sell it as a product. Each module solves one business-operations job (payroll emails, assets, invoices, and so on), and a client pays for the ones it uses.

### How it works

- **Tenants are Clerk Organizations.** Clerk handles sign-in. Each client company is a Clerk organization, and a user's active organization decides which tenant's data they see. Marvin's own team is a separate internal organization, which gets the admin area instead of the client portal.
- **The admin area** lets the internal team create tenants, mark them active or inactive, and turn modules on or off per tenant. It can also seed demo data.
- **Tool gating is enforced on the server.** Every module checks that it's enabled for the tenant, and that the tenant is active, before showing any page. A tenant can't reach a disabled module even by typing its URL.
- **Data isolation.** Every table that holds client data has a `tenant_id`, and every query filters by it. This is enforced in the code's data layer (`services/*`), not by the database.
- **Roles.** Each organization has admins (`org:admin`) and members. Client admins can invite their own staff. Some modules restrict sensitive actions to admins.
- **Languages and theme.** The UI is in English and Spanish, with light and dark mode.

### Technology

| Layer | Choice |
|---|---|
| App framework | Next.js 16 (App Router), React 19, TypeScript |
| Sign-in and organizations | Clerk |
| Database | PostgreSQL on Neon, accessed with Drizzle ORM |
| Files | Vercel Blob |
| Email and background jobs | Resend, QStash |
| Hosting | Vercel, Node 24 |
| Tests | Vitest |

### Modules

| Module | What it does |
|---|---|
| Payroll | Upload a payroll spreadsheet, review it, and email each employee their pay details. |
| Employees | Staff records, departments and documents. |
| Assets | Company equipment with photos, documents and history. |
| Clients | Customer records, contacts, documents and notes. |
| Providers | Supplier records, contacts, documents and notes. |
| Quotes | Quotes with line items and an activity log, linked to clients. |
| Invoices | Invoices with line items and an activity log, linked to clients. |
| Coverage | Service areas per trade, drawn as map polygons. |
| Webhooks | Receives signed data from other systems and logs each delivery. |
| Cards | Backend API for a family trading-card collection mobile app. |
| **Barbers** | **Front desk and fortnightly settlements for a barbershop or salon. Built for NOURA Center; see Part 2.** |

### Conventions that matter for new work

- Pages call server actions, server actions call `services/*`, and only services touch the database.
- Money in the Barbers module is calculated with exact decimals (decimal.js), never floating point.
- The database driver has no transactions, so multi-step writes are designed to be safe without them.
- Changes that affect what someone is paid are written to an audit log (`audit_logs`).

---

## Part 2: The Barbers module (NOURA Center)

### 2.1 The client and the problem

**NOURA Center** (legal name Estilistas Creativos de San Pedro S.A.) is a barbershop and salon in Concepción, Costa Rica. Its functional lead is **Brayan Ramírez Rivera**, who is also one of its barbers. The professionals are independent micro-businesses: every fortnight each one is paid a settlement (*liquidación*) and issues an electronic invoice to the salon.

Today the shop records sales in WeiBook, which can't produce the settlement report they need. Cashiers rebuild each day by hand in an Excel closing file (`CIERRE DD-MM-AAAA.xlsx`), and an outside person turns a fortnight of those files into payment spreadsheets, which an accountant then processes. The spec asks for a system that imports the daily closings, calculates the fortnightly settlements, produces individual and consolidated reports, controls cash, and can be compared against the accountant's figures.

We built this as the **Barbers module** inside OfficeTools, so NOURA is a tenant with the Barbers tool turned on. The guiding principle, agreed with Marvin, is **keep it simple**: it's a small shop, so we use plain per-person settings instead of a rules engine wherever the result is the same.

### 2.2 What the shop can do today

**Daily work (tabs):**
- **Log:** the front desk records services: barber, location, payment method, one or more services with the price actually charged, and an optional customer name. A daily check-in list limits the barber picker to who's working. Each logged service gets a menu to mark it as a **courtesy**, record a **warranty redo**, or **void** it with a reason. Services are never deleted.
- **Vales:** cash advances handed to a barber, deducted in full in the fortnight they're dated.
- **Product sales:** products sold to a barber on credit, deducted at settlement.
- **Tips:** tips owed to a barber, paid on top of the invoice.
- **Settlements (*Liquidaciones*):** see 2.4.
- **Reports:** services and commissions per barber for any date range, with the same void, courtesy and warranty actions on older services.

**Setup (Catalogs menu):**
- **Barbers:** personal and payment data (ID number, IBAN, name aliases), locations they work at, per-service commission overrides, and settlement settings (2.3).
- **Locations, Services, Products:** services carry a category and a default commission rate, with a price per location.
- **Payment methods:** each with a fee rate (card 6.5%, others 0%).
- **Settings:** shop-wide IVA rate (13%) and daily maintenance fee (₡1,000).
- **History:** the audit trail of every change that affects pay.

### 2.3 Settlement rules as implemented

The calculation is a single pure function (`src/lib/barbers/settlement.ts`) with unit tests built from the spec's acceptance cases. It runs per barber per fortnight. Periods are the 1st–15th and the 16th to the end of the month, using Costa Rica dates (UTC−6).

For each service line:
- `base = price charged ÷ (1 + IVA)` (§6.2)
- `commission = base × commission rate` (§6.3). The rate is fixed on the line when it's logged, so later catalog changes don't rewrite history.
- `card fee = base × payment method fee rate`, only for services the customer actually paid (§6.5)

For the fortnight:
- `income = Σ commission`
- `maintenance = days with at least one service × daily fee`, unless the barber is exempt (§6.6)
- `expenses = card fee + maintenance + products on credit + vales + carried balance + warranty clawback` (§6.7)
- `net = income + fortnightly addition − expenses`
- `IVA base = income × barber's IVA base % + addition − expenses`
- `IVA = max(0, IVA base) × 13%`
- `invoice = max(0, net) + IVA` (the IVA isn't added if the barber's IVA is informative only)
- `transfer = invoice + tips` (§6.8)
- `shortfall = max(0, −net)`: what the barber owes when deductions exceed earnings

Nothing is rounded until the final figure, then each is rounded to céntimos (§6.9).

**Service statuses (§8.7–8.10):**

| Status | Effect on pay |
|---|---|
| Normal | Paid as above. |
| Courtesy | Normal commission. No card fee, since the customer didn't pay. Counts as a worked day. |
| Warranty redo, same barber | Recorded and counts as a worked day, but not paid again. |
| Warranty redo, another barber | The other barber gets their normal commission on the original price. The original barber's commission is taken back in the fortnight of the redo. |
| Voided | Kept for the record with reason, user and date. No effect on pay or days worked. |

**Per-person rules (§7)**, all set through plain per-barber settings:

| Rule | Barber setting |
|---|---|
| Maicol and Brayan receive 100% | Commission override of 100% on their services |
| Maicol pays IVA on 50% of the base only | IVA base = 50% |
| Jorge's IVA is shown but not paid | "IVA informative only" |
| Imara receives ₡20,000 per fortnight for cleaning, which bears IVA | Fortnightly addition = 20,000 |
| Imara, Raquel and Brayan are exempt from maintenance | "Pays maintenance" unchecked |
| Brayan's shortfall becomes a salary deduction (CA 10) | "Shortfall goes to salary deduction" |
| Imara and Zoe work at mixed rates | Automatic: each service carries its own rate. A "By commission rate" table shows the breakdown. |

**Closing a fortnight (§3.4, §11.1):**
- Only admins can **close** a fortnight. Closing freezes every barber's figures; from then on the page and all exports show the frozen numbers. If underlying data changes afterwards, a warning appears, but the paid figures don't move.
- **Reopening** requires a reason and keeps the old version in a closing history. Closing again creates a new version, and old versions can still be viewed and exported.
- **Carry-over (§8.1, §8.5):** on a closed fortnight, an admin can move all or part of a barber's shortfall to the next fortnight, where it's deducted as "previous balance". It's never automatic, and never for barbers whose shortfall goes to salary.

**Outputs (§10.1, §10.4):**
- An Excel workbook per fortnight: a summary, a bank-transfer list (name, ID number, IBAN, amount), the by-rate breakdown, and one sheet per barber.
- Printable individual settlements, one per barber or all at once, which the browser saves as PDF.

**Audit trail (§5, §11):** every change that affects pay records the old value, new value, user, date and reason. That covers services, vales, tips, product sales, barber settings and bank details, commission rates, payment-method fees, shop settings, close and reopen, and carry-overs. It's visible on the History page and on each barber's page.

### 2.4 Where we deliberately differ from the spec

These choices keep the system simple. Each is open to change if NOURA disagrees.

1. **No start and end dates on rules (§9.2, CA 21–26).** The spec wants every rate and amount versioned by effective date. Instead, closing a fortnight freezes its figures and every change is audited. The trade-off is that a change applies immediately to fortnights that are still open, rather than from a chosen date. **This is open question B in 2.7.**
2. **Commission rate per service and per barber, not per category table.** Services carry a category and a default rate, and barbers can have per-service overrides. Once the daily-closing import exists, the rate written in the closing file will take priority, with an alert when it differs, as the spec requires (§6.1).
3. **PDF through the browser's "Save as PDF"** rather than a PDF library. The documents are print-formatted.
4. **Two roles only.** Admins close and reopen fortnights and carry balances; everyone else can do the daily work. The spec's Cajera, Revisor and Contabilidad roles aren't built yet (2.6).

### 2.5 Status against the spec

| Spec area | Status |
|---|---|
| Calculation engine (§6) | ✅ Done and tested |
| Days worked and maintenance (§6.6) | ✅ Done |
| Per-person rules (§7) | ✅ Done |
| Staff master data: ID number, IBAN, aliases (§5) | ✅ Done |
| Courtesy, warranty, voided (§8.7, §8.8, §8.10) | ✅ Done |
| Close, reopen, versions, carry-over (§3.4, §11.1) | ✅ Done |
| Individual settlement, Excel, bulk PDF (§10.1, §10.4) | ✅ Done |
| Mixed-rate report (§10.3) | ✅ Done |
| Audit trail (§5, §11) | ✅ Done |
| Exact money math, CRC, Costa Rica time (§6.9, §12) | ✅ Done |
| Vales, products on credit, tips | ✅ Done |
| **Daily closing import (§4)** | ✅ Built and verified on the real 1–15 Nov 2026 closings (see 2.9). Upload, preview with questions, import, re-import by date. |
| Service received from a colleague (§8.2) | 🔴 Not built; can be built now |
| Returns (§8.9) | 🔴 Not built; can be built now |
| Product used inside a service, Meterasa share (§8.3) | 🔴 Not built; needs the WeiBook catalog |
| Split payments linked by ticket (§6.4) | 🔴 Comes with the import |
| Cash control per cashier and shift (§4.4) | 🔴 Needs real closing files |
| SINPE reconciliation (§4.5) | 🔴 Needs real closing files |
| Meterasa supplier settlement (§8.4, §10.3) | 🔴 Needs real closing files |
| Cierre – Desglose diario report (§10.2) | 🔴 Needs real closing files |
| Accountant comparison (§10.3, CA 20) | 🔴 Needs the accountant's files |
| Roles: Cajera, Revisor, Contabilidad (§2.1) | 🟡 Admin only so far; waiting on the user list |
| Rules with effective dates (§9.2) | ⚠️ Done differently (2.4.1), awaiting sign-off |

**Spec acceptance cases (§13):**
- **Covered by automated tests:** CA 01–12 (including CA 10, the salary-deduction flag) and CA 15–17.
- **Need the product and Meterasa work:** CA 13–14.
- **Need the import:** CA 18–19 and CA 27–29.
- **Needs the accountant's files:** CA 20.
- **Handled by frozen closings instead of dated rules:** CA 21–26.

### 2.6 What's blocked, and on whom

**On NOURA (Brayan).** This list was sent to him in Spanish as "Lo que necesitamos de usted para terminar":
1. **Files:**
   - Daily closings for 16–31 August 2026 together with the accountant's file for that fortnight. This is the most important item: it lets us check our figures against the accountant's to the céntimo.
   - Reference closings for 12 September and 29 October.
   - The accountant's other fortnight files.
   - WeiBook catalogs for services and inventory, including the product amount per service.
2. Decision A or B (2.7).
3. Users: name, role and email for each person.
4. The company's billing email.

**On Marvin:**
- Create a `cashier` role in Clerk.
- Enter NOURA's setup in the app: payment-method fees, each barber's settlement settings, ID numbers, IBANs and aliases.

**On development, unblocked:** service received from a colleague (§8.2) and returns (§8.9).

### 2.7 Open questions for NOURA, with background

These are the questions in Brayan's document. For each: why we ask, what each answer changes, and our recommendation. An AI helping to answer them should not invent facts (emails, file contents, people). Those must come from NOURA. The AI can help explain the questions, organize the files, and draft replies.

**A. Files (section 1 of Brayan's document)**
- *Why:* the import has to match the real workbook layout. The spec gives cell ranges (§4.3–4.5), but real files always have variations: extra rows, merged cells, typos. The August fortnight plus the accountant's output becomes our end-to-end "golden" test.
- *What we need from each file:* the FACTURACION, CIERRE GENERAL and CONTROL SINPES sheets. From the accountant: per-person totals for each concept (income, card fee, maintenance, products, vales, net, IVA, invoice, tips, transfer).
- *Handling:* the files contain personal and bank data. They go only to Marvin, privately, and are stored in a folder git ignores (`fixtures/noura/`).

**B. Dated rules versus frozen fortnights (section 2)**
- *Option A (recommended, how it works today):* closing freezes a fortnight's figures; every change is audited; a reopen needs a reason and keeps the old version. A rate change applies immediately to open fortnights. To make a change "from next fortnight", close the current one first.
- *Option B:* every rate and amount gets start and end dates, and the engine looks up the value in force on each service's date. That's significantly more development and more complex screens.
- *What decides it:* how often NOURA changes rates or fees mid-fortnight. If rarely, A is enough.

**C. Users and roles (section 3)**
- *Why:* the spec requires individual users without shared passwords (§14) and role-based permissions (§2.1, §11).
- *Planned roles:*
  - **Administrator:** everything, including closing, reopening, carry-overs and rate changes.
  - **Cashier:** logs services, vales, tips and product sales. Can't see settlements or change rates.
  - **Accountant:** read-only access to settlements and exports, if NOURA wants it.
- *Cashiers named in the spec:* Lesly Ruiz Mora (Corte 1) and Karen Guerrero Monje (Corte 2). The spec also says Lesly's and Karen's own vales are reported separately from the professionals' settlements (§8.5).
- *Needed:* email per person, and whether anyone else is an admin or reviewer.

**D. Company billing email (section 4)**
- *Why:* settlement documents should show the company's billing details (§10.1). We already have the legal name and corporate ID; the spec says to confirm the billing email before using it (§14).

**E. Assumptions (section 5, answer only if they disagree)**
1. Jorge's informative IVA appears only in the internal report, not on his electronic invoice (§14 lists this as pending).
2. Product-sale commissions paid immediately in cash are recorded as cash out, outside the fortnightly settlement (§1.4, §14).
3. Professional IVA is calculated after deductions, including vales. The spec states this (§6.7), so it's listed only for transparency.
4. Brayan's shortfall goes to salary deduction; anyone else's is carried forward only if an admin decides to (§7, §8.1, §8.5).

**Known data issue, not sent to Brayan:** Annex A lists Brayan's email as the same address as the supplier Meterasa's, which looks like a copy error. Staff can correct it in the app.

### 2.9 Validation against the accountant (1–15 Nov 2026)

NOURA sent the 15 daily closings and the accountant's files for 1–15 November 2026. Our importer and engine reproduce the accountant's final payment exactly for 6 of 9 people (Bernal, Brayan, Genesis, Jorge, Raquel, Zoe). The other 3 differ by amounts with a known cause that isn't a calculation error:

| Person | Difference | Cause |
|---|---|---|
| Maicol | +₡3,390.00 | The accountant has a ₡3,000 vale on 6 Nov that isn't in that day's closing (+13% IVA). |
| Joshua | +₡1,276.90 | The accountant has ₡1,130 of razors on 9 Nov that aren't in that day's closing (+13% IVA). |
| Imara | −₡2,950.00 | The accountant paid ₡29,500 of lines written at 50% at 60%, apparently correcting by category. |

What the real files taught us, now built into the importer:
- The accountant charges the **6.5% card fee on the IVA-included price**, not on the base (spec §6.5). Every card fee matches only that way.
- **Any cash outflow made out to a professional is deducted** ("Otros o vales"): vales, shampoo, "VALE IMARA MINOXIDIL". "GENESIS JEFA" is not Genesis.
- **Maicol's invoice** covers his 50% share plus IVA; the other 50% is paid outside the invoice. Totals match the spec's rule.
- Cashiers type **afternoon times without pm**, copy files **without updating the internal date**, and the supplier appears as METERASA, METERSA or METERESA.

### 2.10 Decisions taken without Brayan (to confirm)

Brayan wasn't available, so these were decided to reproduce what the accountant actually pays. Each is a setting, so changing it needs no code.

1. **Genesis is paid 60%** (fixed rate on her profile). The closings say 50%; the accountant pays 60% (₡60,520 difference in November).
2. **Card fee on the IVA-included price** (shop setting). The spec's rule would charge about 11% less.
3. **A barber's fixed rate wins over the % written in the closing**, with a warning in the preview. Barbers paid by category (Imara, Zoe) keep the written %.
4. **Items the accountant adds that aren't in the closings** (like Maicol's 6 Nov vale) are entered by hand in the app.
5. **Unknown names are never guessed**: the import asks. "Luis Hernández" (₡0 in November) and Brayan's administrative services are outside the settlement for now.

From Brayan's earlier answers (Nov 2026): dated rules (option B) are preferred; product commissions as a separate closing with fixed amounts per product, IVA added on top when marked; cashiers close shifts with downloadable reports; shortfalls charged to the shift's cashier; Jorge, Raquel and Zoe paid without IVA, which doesn't appear on their receipt; receipts say "send the electronic invoice to estilistascreativos@gmail.com". Of these, the receipt changes and the invoice email are built; the rest are next.

### 2.11 Glossary

| Spanish | Meaning in this system |
|---|---|
| Liquidación | Fortnightly settlement for one professional |
| Quincena | Fortnight: the 1st–15th, or the 16th to the end of the month |
| Cierre diario / CIERRE | The cashiers' daily closing Excel file |
| Vale | Cash advance, deducted at settlement |
| Propina | Tip, paid outside the invoice |
| Datáfono | Card terminal; its 6.5% fee is deducted from the barber |
| Cuota de mantenimiento | Daily maintenance fee, ₡1,000 per day with at least one service |
| Cortesía / Garantía / Anulado | Courtesy / warranty redo / voided service |
| Faltante | Shortfall: deductions larger than earnings |
| Traslado | Carry-over of a shortfall to the next fortnight |
| Meterasa | Product supplier; receives 100% of product amounts |
| Corte 1 / Corte 2 | First and second cash shift of the day |
| SINPE Móvil | Costa Rican instant bank transfer, used as a payment method |
| WeiBook | NOURA's point-of-sale and booking system |

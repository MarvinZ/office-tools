# Cards module — backend spec (v1)

**Status:** draft for review · 2026-11-06
**Consumer:** TwinsCards mobile app (Flutter, iOS + Android) — `~/TwinsCards`
**Lives in:** office-tools (Next.js 16 · Clerk · Neon Postgres · Drizzle · QStash · Vercel)

---

## 1. Goal

Give TwinsCards a real backend so each person's card collection is stored, priced, and visible from any device.

- Each collector signs in on the app, scans a card, sees its price (unchanged — the app already does this), and **adds it to their own collection**.
- Each collector can **browse their collection** (search, filter, total value) and **show it off** to the rest of the family.
- Prices stay current: the backend refreshes market prices for every collected card once a day, so totals don't go stale.
- Start with **2 collectors** (the kids) in one family; adding a collector or a whole new family is configuration, not code.

### Out of scope for v1
- Public share links outside the family (see §11, open question 3).
- Trading, wishlists, sealed product, graded cards (PSA/BGS).
- Photos of the physical card (Vercel Blob is available; add later if wanted).
- Moving card *search/matching* to the server — the app keeps doing that (see §4).
- A full web UI. v1 ships the API plus the tool registration; a read-only web page is optional (§9).

---

## 2. How it fits office-tools

office-tools is already multi-tenant with per-tenant tools. The Cards module reuses those pieces as they are:

| office-tools concept | Cards meaning |
|---|---|
| Tenant (= Clerk Organization) | A **family** (e.g. "Zumbado"). Data never crosses families. |
| Clerk user, member of the org | A **collector** (each kid; a parent too, if they want a collection). |
| Org role `org:admin` | **Parent** — manages members, can edit any collection in the family. |
| `tools` / `tenant_tools` | New tool `tool_cards` (slug `cards`), enabled per family from `/admin/[id]`. |
| `audit_logs` | Add/remove/edit events on collection items. |
| QStash worker + `Receiver` signature check | Daily price-refresh worker. |

**New for office-tools:** this is the first module consumed by a **native mobile client**. Every existing module uses server actions behind a Clerk browser session. Cards needs:

1. A **JSON REST API** under `/api/cards/v1/*`.
2. **Bearer-token auth**: the app sends `Authorization: Bearer <Clerk session JWT>`. `clerkMiddleware` + `auth()` already accept this; unauthenticated API calls must get a **401 JSON** response, not the sign-in redirect `auth.protect()` gives pages.

---

## 3. Users, families, permissions

### Accounts
- Every collector is a **Clerk user** in the family's org. Recommended for kids: **username + password** accounts (no email needed), created by the parent. This requires enabling *username* as an identifier in the Clerk instance. → open question 1.
- When a member first calls the API, a `card_collectors` row is created for them (upsert on `tenant_id + clerk_user_id`). It caches the display name, so collection queries never call Clerk.

### Tenant resolution (API)
1. Verify the bearer token → `userId`, and `orgId` if the session has an active org.
2. Tenant = `tenants.clerk_org_id = orgId`. If the token has no active org, use the user's **single** org membership that has `cards` enabled (Clerk backend API, then cached). If there are zero or several matches → `409 tenant_ambiguous`. The app then shows a family picker and sends `X-Tenant-Id`. With one family per user, the picker never appears.
3. Tenant must be `is_active` **and** have `tool_cards` enabled → otherwise `403 tool_disabled`.

### Permission matrix

| Action | Owner | Other member of the family | Parent (`org:admin`) |
|---|---|---|---|
| Read a collection + totals | ✅ | ✅ read-only (showcase) | ✅ |
| Add / edit / remove items | ✅ | ❌ | ✅ (any member) |
| Hide own collection from family | ✅ (`is_private`) | — | sees it anyway |

→ open question 2 confirms this matrix.

Every query filters by `tenant_id` (office-tools rule). Write paths also check `owner_collector_id` against the permission matrix.

---

## 4. Responsibility split: app vs backend

| Concern | Owner | Why |
|---|---|---|
| OCR, catalog search, matching a scan to a TCGdex card | **App** (already built, tested) | Complex rules live in Dart (`CardsRepositoryImpl`, `CardMatchRules`); duplicating them in TS doubles the maintenance. |
| Linking the card to its TCGplayer product (`groupId`, `productId`) | **App** (already does it) | It sends the ids with the add request. |
| Storing the card's identity + a display snapshot | **Backend** | So collections render without re-querying TCGdex. |
| Current prices + price history | **Backend** | Daily refresh from TCGCSV by `groupId`. One `GET /prices` per set, no matching needed. |
| Collection, quantities, totals | **Backend** | Source of truth for the app. |

The price the app saw at add time is stored as the first price point. That's acceptable for a family app; once outside users exist, the server should fetch the price itself rather than trust the client (§10).

---

## 5. Data model (Drizzle, `src/db/schema.ts`)

Conventions match the existing schema: `text` ids from `generateId()`, `tenant_id` on tenant data, `numeric(12,2)` money, `created_at/updated_at`.

### Enums
```ts
cardLanguageEnum  = pgEnum("card_language",  ["en", "ja"]);
cardConditionEnum = pgEnum("card_condition", ["NM", "LP", "MP", "HP", "DMG"]);
```

### `card_catalog` — global reference data (no `tenant_id`, like `tools` / `trades`)
One row per physical card printed in a language. Shared by every family; created the first time anyone collects that card.

| column | type | notes |
|---|---|---|
| id | text PK | |
| tcgdex_id | text not null | e.g. `sv01-025`, `SV8-052` |
| language | card_language not null | |
| name | text not null | as printed (`ピカチュウ` for ja) |
| set_id / set_name | text not null | TCGdex set |
| local_id | text not null | `025`, `TG05` |
| set_official_count | integer | the `/198` |
| rarity | text | |
| image_url | text | TCGdex base URL (no extension) |
| market_image_url | text | TCGCSV fallback image |
| tcgplayer_group_id / tcgplayer_product_id | integer | null when the app couldn't link it → no auto-refresh |
| created_at / updated_at | timestamp | |

Unique: `(tcgdex_id, language)`. When a later add sends newer snapshot fields (e.g. the image arrived), update the row.

### `card_price_points` — global, append-only, one row per card · printing · day
| column | type | notes |
|---|---|---|
| id | text PK | |
| catalog_card_id | text FK → card_catalog | |
| variant | text not null | `normal`, `holofoil`, `reverse-holofoil`, … (same keys as the app's `CardPrice.variantOrder`); `default` when the source doesn't split |
| source | text not null | `TCGplayer` / `Cardmarket` |
| currency | text not null | `USD` / `EUR` |
| market_price | numeric(12,2) not null | |
| observed_on | date not null | TCGCSV `Last-Modified` date, or the app's `updatedAt` |
| created_at | timestamp | |

Unique: `(catalog_card_id, variant, source, observed_on)`.
**Current price** = the latest row per `(card, variant)`, with USD/TCGplayer preferred. Keeping history from day one is what enables a collection-value chart later (data can't be backfilled).

### `card_collectors` — tenant data
| column | type | notes |
|---|---|---|
| id | text PK | |
| tenant_id | text FK → tenants | |
| clerk_user_id | text not null | |
| display_name | text not null | from Clerk on upsert; editable |
| is_private | boolean default false | hides the collection from other members |
| created_at / updated_at | timestamp | |

Unique: `(tenant_id, clerk_user_id)`.

### `collection_items` — tenant data
| column | type | notes |
|---|---|---|
| id | text PK | |
| tenant_id | text FK → tenants | |
| collector_id | text FK → card_collectors | owner |
| catalog_card_id | text FK → card_catalog | |
| variant | text not null | printing owned |
| condition | card_condition not null default `NM` | |
| quantity | integer not null default 1, check > 0 | |
| is_favorite | boolean default false | pins to the top of the showcase |
| notes | text | |
| acquired_at | date | optional |
| created_by | text not null | clerk user id (a parent may add for a kid) |
| created_at / updated_at | timestamp | |

Unique: `(collector_id, catalog_card_id, variant, condition)` — adding the same card again **increments quantity** instead of creating a duplicate row.

Indexes: `collection_items(tenant_id, collector_id)`, `card_price_points(catalog_card_id, observed_on desc)`.

---

## 6. API — `/api/cards/v1`

JSON only. Requests are validated with **zod** (already a dependency). Errors return `{ "error": { "code": "snake_case", "message": "..." } }` with 400 / 401 / 403 / 404 / 409. Money is sent as a decimal **string** (`"12.34"`) plus a currency, so no float rounding.

### `GET /me`
The caller, their family, and every member (for the showcase list).
```json
{
  "collector": { "id": "…", "displayName": "Sofía", "isPrivate": false, "canManageOthers": false },
  "family": { "id": "…", "name": "Zumbado" },
  "members": [
    { "id": "…", "displayName": "Sofía", "cardCount": 132, "totalValue": { "USD": "241.50" } },
    { "id": "…", "displayName": "Mateo", "cardCount": 87,  "totalValue": { "USD": "96.10" } }
  ]
}
```
Private members appear with no counts and no values (unless the caller is a parent).

### `GET /collectors/{collectorId}/items`
Query: `q` (name contains), `language`, `setId`, `favorite`, `sort` = `added|name|value|set` (default `added` desc), `cursor`, `limit` (default 50, max 200).
```json
{
  "items": [{
    "id": "…", "variant": "holofoil", "condition": "NM", "quantity": 2,
    "isFavorite": true, "notes": null, "acquiredAt": null, "addedAt": "2026-11-06T…",
    "card": { "tcgdexId": "sv01-025", "language": "en", "name": "Pikachu", "setName": "Scarlet & Violet",
              "localId": "025", "setOfficialCount": 198, "rarity": "Common",
              "imageUrl": "https://assets.tcgdex.net/…", "marketImageUrl": null },
    "price": { "amount": "1.25", "currency": "USD", "source": "TCGplayer", "observedOn": "2026-11-05" },
    "lineValue": { "amount": "2.50", "currency": "USD" }
  }],
  "nextCursor": null
}
```
`price` is the current price for that item's variant. If that variant has no price, it falls back to the card's headline price and sets `"priceIsFallback": true`. If there's no price at all, `price` is `null`.

### `GET /collectors/{collectorId}/summary`
```json
{ "cardCount": 132, "uniqueCards": 118,
  "totalValue": { "USD": "241.50", "EUR": "3.10" }, "unpricedCount": 4,
  "pricesAsOf": "2026-11-05",
  "bySet": [{ "setId": "sv01", "setName": "Scarlet & Violet", "language": "en", "cardCount": 20, "value": { "USD": "31.00" } }],
  "mostValuable": [ /* top 5 items, same shape as above */ ] }
```
Totals are **per currency — never converted**. Japanese/Cardmarket-only cards can be EUR. The app shows USD as the headline and the others underneath.

### `POST /collectors/{collectorId}/items`
Add a scanned card. Upsert: if the `(card, variant, condition)` row already exists, quantity increases by `quantity`.
```json
{
  "card": { "tcgdexId": "sv01-025", "language": "en", "name": "Pikachu", "setId": "sv01",
            "setName": "Scarlet & Violet", "localId": "025", "setOfficialCount": 198,
            "rarity": "Common", "imageUrl": "…", "marketImageUrl": null,
            "tcgplayerGroupId": 22873, "tcgplayerProductId": 497548 },
  "variant": "holofoil", "condition": "NM", "quantity": 1,
  "prices": [ { "variant": "holofoil", "amount": "1.25", "currency": "USD", "source": "TCGplayer", "updatedAt": "2026-11-05" } ]
}
```
→ `201` (new row) or `200` (incremented), body = the item. `prices` is every printing the app currently shows, stored as price points (deduplicated by the unique key).
**App change required:** the TCGplayer `groupId` / `productId` the app finds in `_marketProduct` is currently dropped. It needs to be carried on `PokemonCard` so the app can send it.

### `PATCH /collectors/{collectorId}/items/{itemId}`
Any of `quantity` (> 0), `condition`, `variant`, `isFavorite`, `notes`, `acquiredAt`. If a change to condition/variant collides with an existing row, the two rows are **merged** (quantities summed) and the merged item is returned.

### `DELETE /collectors/{collectorId}/items/{itemId}` → `204`

### `PATCH /me` → `displayName`, `isPrivate`

`collectorId` accepts `me` as an alias everywhere.

---

## 7. Price refresh worker

- **Trigger:** QStash **schedule** (daily, 06:00 UTC — TCGCSV updates around 20:00 UTC) → `POST /api/workers/cards/refresh-prices`. Signature is verified with `Receiver`, same as the payroll worker; the route is already public via `/api/workers/(.*)` in `proxy.ts`.
- **Work:** distinct `(language, tcgplayer_group_id)` across cards that are in at least one collection → one `GET {TCGCSV_BASE_URL}/{3|85}/{groupId}/prices` each (category 3 = English, 85 = Japanese) → insert today's `card_price_points` for the matching product ids (`on conflict do nothing`). The date comes from the `Last-Modified` header.
- **Must send a named `User-Agent`** (`TwinsCards/1.0`). TCGCSV returns 401 to default agents (verified from the app on 2026-11-04).
- **Scale check:** 2 kids × a few hundred cards ≈ tens of sets → a few dozen requests/day. If a family grows past the Vercel function time limit, fan out one QStash message per group.
- Cards with no TCGplayer link (`tcgplayer_product_id` null) keep the price the app sent. They refresh only when someone adds that card again.

---

## 8. Config (office-tools `.env.local`, plus Vercel env)

| key | value | note |
|---|---|---|
| `TCGCSV_BASE_URL` | `https://tcgcsv.com/tcgplayer` | new |
| `TCGCSV_USER_AGENT` | `TwinsCards/1.0 (+contact)` | new; real contact goes in env, not code |
| existing Clerk / Neon / QStash keys | — | reused |

TwinsCards `.env` / `.env.example` gets `COLLECTION_API_BASE_URL` (the office-tools deployment URL + `/api/cards/v1`) and `CLERK_PUBLISHABLE_KEY` (public by design, so fine in the bundled `.env`).

---

## 9. office-tools changes checklist

1. `schema.ts`: the 2 enums + 4 tables above → `npm run db:generate` → `db:migrate` (on a Neon **dev branch** first).
2. `seed-tools.ts`: `{ id: "tool_cards", name: "Cards", slug: "cards", description: "Pokémon card collections (TwinsCards app)." }`.
3. `src/services/cards/{catalog,collectors,items,prices}.ts` — query functions taking `tenantId` first, the same shape as `services/assets`.
4. `src/lib/cards/api-auth.ts` — `requireCardsApiContext(req)` → `{ tenant, collector, isParent }` or a 401/403/409 JSON response (§3).
5. Route handlers under `src/app/api/cards/v1/…` + the worker under `src/app/api/workers/cards/refresh-prices/route.ts`.
6. `proxy.ts`: `/api/cards/(.*)` must return 401 JSON instead of redirecting. Either make it public in the matcher and authenticate inside `requireCardsApiContext`, or branch in the middleware.
7. Audit log: `cards.item.added|updated|removed` with `{ collectorId, itemId, tcgdexId, quantity }`.
8. `messages/en.json` + `es.json`: the tool name/description for the admin toggles.
9. *(Optional, v1.1)* Read-only web page `/(app)/cards`: per-member totals + grid. Useful for showing a collection on a big screen.

---

## 10. Before opening to other families (not v1, but don't paint into a corner)

- **Children's data:** the collectors are minors. Before *other* families sign up, review children's-privacy obligations (e.g. US COPPA for under-13s, local equivalents), parental consent, and data deletion on request. v1 is just the owner's family, so this is a checkpoint, not a blocker.
- **Price licensing:** TCGCSV is a one-person community mirror of TCGplayer data. It's fine for personal use but **not a licensed source for a product**. Swapping in a licensed feed changes only the worker and §5's `source` value.
- **Trusting client prices:** at that point, ignore client-sent `prices` and fetch on add server-side.
- **Self-serve family creation:** today a family is created from `/admin`. Self-serve sign-up is a separate feature.
- **Rate limiting** on the API (e.g. Upstash Ratelimit — already on Upstash).

---

## 11. Open questions (need the owner's answer before building)

1. **Kids' sign-in:** each kid gets their own Clerk account with **username + password**, created by a parent (recommended). Alternatives: email accounts, or one parent login on both devices with a "who's collecting?" profile switcher (simpler, but no per-kid security).
2. **Visibility:** is §3's matrix right? Everyone in the family sees everyone's collection read-only; only the owner and parents can edit; a kid can go private.
3. **Showcase outside the family** (e.g. a link to show friends or grandparents): wanted soon? If yes, add `share_token` on `card_collectors` + a public read-only page in v1.1.
4. **Tests in office-tools:** there's no test runner yet. Add **Vitest** (dev dependency) for the services and the permission checks? (TwinsCards rules: ask before any dependency.)
5. **TwinsCards dependency:** sign-in from Flutter needs Clerk on the client. Options: Clerk's official **`clerk_flutter`** package (beta), or calling Clerk's Frontend API by hand. Needs a decision + approval as a new dependency.
6. **Accounts behind office-tools:** confirm the Clerk instance, Neon project, Vercel project and Upstash account are on **personal** accounts. TwinsCards must never touch Salvo/RoadTech/ChrispCo resources. The repo is personal (`MarvinZ/office-tools`), but the hosted services weren't checked.

---

## 12. Milestones

| # | Deliverable | Verify |
|---|---|---|
| B1 | Schema + migration, tool seeded, `api-auth`, `GET /me`, add/list/patch/delete items | curl with a real Clerk token for 2 test users: each sees both collections, can only write their own; a third user in another org gets 403/404 |
| B2 | Summary endpoint, price points on add, refresh worker + QStash schedule | Run the worker manually; today's price rows appear; totals change |
| A1 (TwinsCards) | Sign-in, `CollectionRemoteDatasourceImpl` behind `CollectionRepository`, "Add to collection" on the match screen, carry TCGplayer ids | Add on the iOS sim (via "Type it in") → the card shows up on the other kid's device as read-only |
| A2 (TwinsCards) | Collection tab (grid, search, filters, totals), member switcher / showcase, item detail editing | iPhone + iPad + Android run |

Note for TwinsCards: this **replaces** the "in-memory collection for the PoC" decision in its CLAUDE.md. Update that file and `lib/CLAUDE.md` → Collection when A1 starts.

// ── Dev / single-tenant hardcodes ─────────────────────────────────────────────
// TODO: replace with real tenant resolution (Clerk org) when multi-tenancy lands

export const DEV_TENANT_ID = "tenant_company1";
export const DEV_TENANT_NAME = "Company 1";
export const DEV_TENANT_SLUG = "company1";
export const DEV_TENANT_CLERK_ORG_ID = "dev_org_company1";

// TODO: replace with per-row email from Excel once column is added
export const DEV_EMAIL_OVERRIDE = "marvinzzz@gmail.com";

// TODO: remove row limit once end-to-end flow is validated
export const DEV_ROW_LIMIT = 20;

import { loadEnvConfig } from "@next/env";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";
import { DEV_TENANT_ID } from "../lib/constants";

loadEnvConfig(process.cwd());

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

const DEPARTMENTS = [
  "Customer Support",
  "Engineering",
  "Finance",
  "HR",
  "Legal",
  "Marketing",
  "Operations",
  "Sales",
];

async function seed() {
  console.log("Seeding departments...");

  // Ensure tenant exists (needed for FK)
  await db
    .insert(schema.tenants)
    .values({
      id: DEV_TENANT_ID,
      name: "Company 1",
      slug: "company1",
      clerkOrgId: "dev_org_company1",
      isActive: true,
    })
    .onConflictDoNothing();

  for (const name of DEPARTMENTS) {
    await db
      .insert(schema.departments)
      .values({ id: crypto.randomUUID(), tenantId: DEV_TENANT_ID, name })
      .onConflictDoNothing();
  }

  console.log(`✓ Seeded ${DEPARTMENTS.length} departments`);
}

seed().catch((e) => { console.error(e); process.exit(1); });

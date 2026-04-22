import { loadEnvConfig } from "@next/env";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

loadEnvConfig(process.cwd());

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

const TOOLS = [
  { id: "tool_payroll",   name: "Payroll",   slug: "payroll",   description: "Upload and send payroll emails to employees." },
  { id: "tool_assets",    name: "Assets",    slug: "assets",    description: "Track and manage company equipment and resources." },
  { id: "tool_employees", name: "Employees", slug: "employees", description: "Manage your team, roles, and HR records." },
  { id: "tool_quotes",    name: "Quotes",    slug: "quotes",    description: "Create and send professional quotes to clients." },
];

async function seed() {
  console.log("Seeding tools...");

  for (const tool of TOOLS) {
    await db.insert(schema.tools).values(tool).onConflictDoNothing();
  }

  console.log(`✓ Seeded ${TOOLS.length} tools`);
}

seed().catch((e) => { console.error(e); process.exit(1); });

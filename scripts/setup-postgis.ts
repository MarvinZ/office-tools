import { loadEnvConfig } from "@next/env";
import { neon } from "@neondatabase/serverless";

loadEnvConfig(process.cwd());

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  // PostGIS
  await sql`CREATE EXTENSION IF NOT EXISTS postgis`;
  console.log("✓ PostGIS enabled");

  // trades table (system-wide, not tenant-scoped)
  await sql`
    CREATE TABLE IF NOT EXISTS trades (
      id          text PRIMARY KEY,
      name        text NOT NULL,
      slug        text NOT NULL UNIQUE,
      category    text NOT NULL,
      created_at  timestamp DEFAULT now() NOT NULL
    )
  `;
  console.log("✓ trades table ready");

  // coverage_areas table
  await sql`
    CREATE TABLE IF NOT EXISTS coverage_areas (
      id          text PRIMARY KEY,
      tenant_id   text NOT NULL REFERENCES tenants(id),
      trade_id    text NOT NULL REFERENCES trades(id),
      label       text,
      geom        geometry(Polygon,4326) NOT NULL,
      created_by  text NOT NULL,
      created_at  timestamp DEFAULT now() NOT NULL,
      updated_at  timestamp DEFAULT now() NOT NULL
    )
  `;
  // Spatial index for fast coverage queries later
  await sql`
    CREATE INDEX IF NOT EXISTS coverage_areas_geom_idx
    ON coverage_areas USING GIST (geom)
  `;
  console.log("✓ coverage_areas table ready (with spatial index)");

  process.exit(0);
}

main().catch((e) => { console.error("✗ Setup failed:", e); process.exit(1); });

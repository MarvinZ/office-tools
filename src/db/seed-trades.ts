import { loadEnvConfig } from "@next/env";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

loadEnvConfig(process.cwd());

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

const TRADES = [
  // HVAC & Mechanical
  { id: "trade_hvac",          name: "HVAC",                        slug: "hvac",              category: "HVAC & Mechanical" },
  { id: "trade_refrigeration", name: "Refrigeration",               slug: "refrigeration",     category: "HVAC & Mechanical" },
  // Plumbing & Water
  { id: "trade_plumbing",      name: "Plumbing",                    slug: "plumbing",          category: "Plumbing & Water" },
  { id: "trade_water_heater",  name: "Water Heater Services",       slug: "water-heater",      category: "Plumbing & Water" },
  { id: "trade_septic",        name: "Septic & Drain Services",     slug: "septic-drain",      category: "Plumbing & Water" },
  // Electrical & Power
  { id: "trade_electrical",    name: "Electrical",                  slug: "electrical",        category: "Electrical & Power" },
  { id: "trade_solar",         name: "Solar & Renewable Energy",    slug: "solar",             category: "Electrical & Power" },
  { id: "trade_generator",     name: "Generator Services",          slug: "generators",        category: "Electrical & Power" },
  // Roofing & Exterior
  { id: "trade_roofing",       name: "Roofing",                     slug: "roofing",           category: "Roofing & Exterior" },
  { id: "trade_gutters",       name: "Gutters & Downspouts",        slug: "gutters",           category: "Roofing & Exterior" },
  { id: "trade_siding",        name: "Siding & Cladding",          slug: "siding",            category: "Roofing & Exterior" },
  { id: "trade_windows",       name: "Window & Door Installation",  slug: "windows-doors",     category: "Roofing & Exterior" },
  // Structure & Masonry
  { id: "trade_general",       name: "General Contracting",         slug: "general-contracting", category: "Structure & Masonry" },
  { id: "trade_masonry",       name: "Masonry & Concrete",          slug: "masonry",           category: "Structure & Masonry" },
  { id: "trade_foundation",    name: "Foundation Repair",           slug: "foundation",        category: "Structure & Masonry" },
  // Interior
  { id: "trade_flooring",      name: "Flooring",                    slug: "flooring",          category: "Interior" },
  { id: "trade_painting",      name: "Painting & Drywall",          slug: "painting-drywall",  category: "Interior" },
  { id: "trade_carpentry",     name: "Carpentry & Woodwork",        slug: "carpentry",         category: "Interior" },
  { id: "trade_insulation",    name: "Insulation",                  slug: "insulation",        category: "Interior" },
  // Grounds & Outdoor
  { id: "trade_landscaping",   name: "Landscaping & Grounds",       slug: "landscaping",       category: "Grounds & Outdoor" },
  { id: "trade_pool",          name: "Pool & Spa Service",          slug: "pool-spa",          category: "Grounds & Outdoor" },
  { id: "trade_irrigation",    name: "Irrigation & Sprinklers",     slug: "irrigation",        category: "Grounds & Outdoor" },
  // Safety & Security
  { id: "trade_locksmith",     name: "Locksmith",                   slug: "locksmith",         category: "Safety & Security" },
  { id: "trade_security",      name: "Security Systems",            slug: "security-systems",  category: "Safety & Security" },
  { id: "trade_fire",          name: "Fire Protection",             slug: "fire-protection",   category: "Safety & Security" },
  // Specialty
  { id: "trade_pest",          name: "Pest Control",                slug: "pest-control",      category: "Specialty" },
  { id: "trade_appliance",     name: "Appliance Repair",            slug: "appliance-repair",  category: "Specialty" },
  { id: "trade_elevator",      name: "Elevator & Lift Services",    slug: "elevators",         category: "Specialty" },
];

async function seed() {
  console.log("Seeding trades...");
  for (const trade of TRADES) {
    await db.insert(schema.trades).values(trade).onConflictDoNothing();
  }
  console.log(`✓ Seeded ${TRADES.length} trades`);
}

seed().catch((e) => { console.error(e); process.exit(1); });

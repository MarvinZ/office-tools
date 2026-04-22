import { eq, and, sql, count } from "drizzle-orm";
import { db } from "@/db";
import { clients, providers, employees, quotes, assets } from "@/db/schema";
import {
  createClient,
  addClientContact,
} from "@/services/clients/clients";
import {
  createProvider,
  addProviderContact,
} from "@/services/providers/providers";
import { createEmployee } from "@/services/employees/employees";
import { createAsset } from "@/services/assets/assets";
import { createQuote } from "@/services/quotes/quotes";
import type { ClientInput, ContactInput as ClientContact } from "@/services/clients/clients";
import type { ProviderInput, ContactInput as ProviderContact } from "@/services/providers/providers";
import type { EmployeeRow } from "@/services/employees/employees";
import type { AssetRow } from "@/services/assets/assets";
import type { QuoteInput } from "@/services/quotes/quotes";

type DemoEmployeeInput = Omit<EmployeeRow, "id" | "tenantId" | "createdBy" | "createdAt" | "updatedAt">;
type DemoAssetData = Omit<AssetRow, "id" | "tenantId" | "createdBy" | "createdAt" | "updatedAt" | "assignedToId">;
type DemoAsset = { employeeIndex: number | null; data: DemoAssetData };

// ── Demo data ─────────────────────────────────────────────────────────────────

const DEMO_CLIENTS: { input: ClientInput; contacts: ClientContact[] }[] = [
  {
    input: {
      name: "Café Montaña",
      legalName: "Café Montaña S.A.",
      taxId: "3-101-845231",
      industry: "Food & Beverage",
      status: "active",
      website: "https://cafemontana.cr",
      paymentTerms: "net_30",
      currency: "USD",
      creditLimit: 10000,
      billingEmail: "cuentas@cafemontana.cr",
      clientSince: "2024-01-10",
      addressStreet: "Av. Central 120",
      addressCity: "San José",
      addressState: "San José",
      addressZip: "10101",
      addressCountry: "Costa Rica",
      tags: ["retainer", "priority", "demo"],
    },
    contacts: [
      { name: "Andrea Solís", title: "Gerente General", email: "andrea@cafemontana.cr", phone: "+506 8800-1234", isPrimary: true },
      { name: "Luis Mora", title: "Jefe de Compras", email: "compras@cafemontana.cr", phone: "+506 8800-5678", isPrimary: false },
    ],
  },
  {
    input: {
      name: "TechFlow Solutions",
      legalName: "TechFlow Solutions LLC",
      taxId: "EIN 45-1234567",
      industry: "Technology",
      status: "active",
      website: "https://techflow.io",
      paymentTerms: "net_15",
      currency: "USD",
      creditLimit: 25000,
      billingEmail: "billing@techflow.io",
      clientSince: "2024-03-01",
      addressStreet: "350 5th Ave, Suite 4100",
      addressCity: "New York",
      addressState: "New York",
      addressZip: "10118",
      addressCountry: "United States",
      tags: ["saas", "long-term", "demo"],
    },
    contacts: [
      { name: "James Whitfield", title: "CTO", email: "james@techflow.io", phone: "+1 212 555-0100", isPrimary: true },
      { name: "Sara Chen", title: "Project Manager", email: "sara@techflow.io", isPrimary: false },
    ],
  },
  {
    input: {
      name: "Inmobiliaria Pacífico",
      legalName: "Inversiones Pacífico S.A.",
      taxId: "3-101-622890",
      industry: "Real Estate",
      status: "active",
      website: "https://inmopacifico.cr",
      paymentTerms: "net_30",
      currency: "USD",
      creditLimit: 15000,
      billingEmail: "admin@inmopacifico.cr",
      clientSince: "2024-06-01",
      addressStreet: "Paseo Colón, Edif. Torre del Mar, Piso 6",
      addressCity: "San José",
      addressState: "San José",
      addressZip: "10101",
      addressCountry: "Costa Rica",
      tags: ["design-retainer", "demo"],
    },
    contacts: [
      { name: "Roberto Vega", title: "Director", email: "roberto@inmopacifico.cr", phone: "+506 2222-3344", isPrimary: true },
    ],
  },
  {
    input: {
      name: "ArtisanCR",
      legalName: "Artisan Crafts CR S.R.L.",
      taxId: "3-102-441123",
      industry: "Retail",
      status: "prospect",
      website: "https://artisancr.com",
      paymentTerms: "immediate",
      currency: "USD",
      billingEmail: "hola@artisancr.com",
      clientSince: "2025-01-20",
      addressStreet: "Barrio Escalante, Calle 33",
      addressCity: "San José",
      addressState: "San José",
      addressZip: "10104",
      addressCountry: "Costa Rica",
      tags: ["e-commerce", "follow-up", "demo"],
    },
    contacts: [
      { name: "Valeria Núñez", title: "Fundadora", email: "hola@artisancr.com", phone: "+506 8811-9900", isPrimary: true },
    ],
  },
  {
    input: {
      name: "FinTech CR",
      legalName: "FinTech Soluciones CR S.A.",
      taxId: "3-101-788234",
      industry: "Finance",
      status: "inactive",
      website: "https://fintechcr.com",
      paymentTerms: "net_60",
      currency: "USD",
      billingEmail: "product@fintechcr.com",
      clientSince: "2024-12-01",
      addressStreet: "Centro Corporativo El Tobogán, Torre B",
      addressCity: "Heredia",
      addressState: "Heredia",
      addressZip: "40101",
      addressCountry: "Costa Rica",
      tags: ["ux", "fintech", "demo"],
    },
    contacts: [
      { name: "Felipe Arroyo", title: "Product Lead", email: "product@fintechcr.com", phone: "+506 4000-8800", isPrimary: true },
    ],
  },
];

const DEMO_PROVIDERS: { input: ProviderInput; contacts: ProviderContact[] }[] = [
  {
    input: {
      name: "Adobe Inc.",
      legalName: "Adobe Inc.",
      taxId: "EIN 77-0019522",
      category: "Technology & Software",
      status: "active",
      website: "https://adobe.com",
      rating: 5,
      paymentTerms: "net_30",
      currency: "USD",
      productsServices: "Creative Cloud, Acrobat, Document Cloud — design and PDF tooling.",
      leadTimeDays: 0,
      partnerSince: "2023-04-01",
      tags: ["software", "essential", "demo"],
    },
    contacts: [
      { name: "Support Team", title: "Enterprise Account", email: "enterprise@adobe.com", isPrimary: true },
    ],
  },
  {
    input: {
      name: "Vercel Inc.",
      legalName: "Vercel Inc.",
      taxId: "EIN 84-3400968",
      category: "Technology & Software",
      status: "active",
      website: "https://vercel.com",
      rating: 5,
      paymentTerms: "net_30",
      currency: "USD",
      productsServices: "Cloud platform for frontend deployment, serverless functions, edge network.",
      leadTimeDays: 0,
      partnerSince: "2023-09-15",
      tags: ["cloud", "infrastructure", "demo"],
    },
    contacts: [
      { name: "Billing Support", title: "Account Manager", email: "billing@vercel.com", isPrimary: true },
    ],
  },
  {
    input: {
      name: "Impresos del Valle",
      legalName: "Impresos del Valle S.A.",
      taxId: "3-101-320045",
      category: "Marketing & Design",
      status: "active",
      website: "https://impresosdelvallerc.com",
      rating: 4,
      paymentTerms: "net_15",
      currency: "CRC",
      bankName: "Banco Nacional de Costa Rica",
      bankAccount: "100-01-078-000123-4",
      productsServices: "Offset and digital printing, banners, business cards, packaging.",
      leadTimeDays: 5,
      minimumOrderAmount: 50000,
      partnerSince: "2023-06-01",
      addressCity: "Heredia",
      addressState: "Heredia",
      addressCountry: "Costa Rica",
      tags: ["printing", "local", "demo"],
    },
    contacts: [
      { name: "Karla Vargas", title: "Ejecutiva Comercial", email: "kvargas@impresosdelvallerc.com", phone: "+506 2260-1234", isPrimary: true },
    ],
  },
  {
    input: {
      name: "Despacho Arias & Cía",
      legalName: "Arias & Compañía Abogados S.A.",
      taxId: "3-101-550982",
      category: "Legal & Accounting",
      status: "active",
      rating: 4,
      paymentTerms: "net_30",
      currency: "USD",
      productsServices: "Corporate law, trademark registration, contract drafting, tax advisory.",
      leadTimeDays: 10,
      partnerSince: "2023-01-15",
      addressStreet: "Edificio Torre Sabana, Piso 8",
      addressCity: "San José",
      addressState: "San José",
      addressCountry: "Costa Rica",
      tags: ["legal", "retainer", "demo"],
    },
    contacts: [
      { name: "Lic. Diego Arias", title: "Socio Director", email: "darias@ariascia.cr", phone: "+506 2233-4400", isPrimary: true },
      { name: "Asistente Legal", title: "Paralegal", email: "legal@ariascia.cr", isPrimary: false },
    ],
  },
  {
    input: {
      name: "Servientrega CR",
      legalName: "Servientrega Costa Rica S.A.",
      taxId: "3-101-710034",
      category: "Logistics & Shipping",
      status: "active",
      rating: 3,
      paymentTerms: "net_15",
      currency: "CRC",
      productsServices: "National and international courier, express delivery, freight logistics.",
      leadTimeDays: 2,
      minimumOrderAmount: 5000,
      partnerSince: "2024-02-01",
      addressCity: "San José",
      addressState: "San José",
      addressCountry: "Costa Rica",
      tags: ["shipping", "local", "demo"],
    },
    contacts: [
      { name: "Juan Solano", title: "Ejecutivo de Cuentas", email: "jsolano@servientrega.cr", phone: "+506 4000-5050", isPrimary: true },
    ],
  },
];

const DEMO_EMPLOYEES: DemoEmployeeInput[] = [
  {
    firstName: "Carlos",
    lastName: "Vargas",
    avatarUrl: null,
    companyEmail: "carlos.vargas@company.com",
    personalEmail: "cvargas@gmail.com",
    phone: "+506 8801-1234",
    position: "Senior Designer",
    departmentId: null,
    status: "active",
    hireDate: new Date("2023-06-01"),
    terminationDate: null,
    addressStreet: "Calle 5, Av. 2",
    addressCity: "San José",
    addressState: "San José",
    addressZip: "10101",
    addressCountry: "Costa Rica",
    compensationAmount: "2500.00",
    compensationType: "monthly",
    emergencyContactName: "María Vargas",
    emergencyContactPhone: "+506 8802-5678",
    emergencyContactRelation: "Spouse",
    clerkUserId: null,
    notes: null,
    tags: ["demo"],
  },
  {
    firstName: "Mariana",
    lastName: "Jiménez",
    avatarUrl: null,
    companyEmail: "mariana.jimenez@company.com",
    personalEmail: null,
    phone: "+506 8803-2222",
    position: "Lead Developer",
    departmentId: null,
    status: "active",
    hireDate: new Date("2023-09-15"),
    terminationDate: null,
    addressStreet: null,
    addressCity: "Cartago",
    addressState: "Cartago",
    addressZip: null,
    addressCountry: "Costa Rica",
    compensationAmount: "3200.00",
    compensationType: "monthly",
    emergencyContactName: null,
    emergencyContactPhone: null,
    emergencyContactRelation: null,
    clerkUserId: null,
    notes: null,
    tags: ["demo"],
  },
  {
    firstName: "Sofía",
    lastName: "Mata",
    avatarUrl: null,
    companyEmail: "sofia.mata@company.com",
    personalEmail: "sofiamata@hotmail.com",
    phone: "+506 8804-3333",
    position: "Project Manager",
    departmentId: null,
    status: "active",
    hireDate: new Date("2024-01-10"),
    terminationDate: null,
    addressStreet: "Rohrmoser, Blvd. Rohrmoser",
    addressCity: "San José",
    addressState: "San José",
    addressZip: "10108",
    addressCountry: "Costa Rica",
    compensationAmount: "2800.00",
    compensationType: "monthly",
    emergencyContactName: "Pedro Mata",
    emergencyContactPhone: "+506 8805-4444",
    emergencyContactRelation: "Father",
    clerkUserId: null,
    notes: null,
    tags: ["demo"],
  },
  {
    firstName: "Andrés",
    lastName: "Solano",
    avatarUrl: null,
    companyEmail: "andres.solano@company.com",
    personalEmail: null,
    phone: "+506 8806-5555",
    position: "Marketing Specialist",
    departmentId: null,
    status: "active",
    hireDate: new Date("2024-03-01"),
    terminationDate: null,
    addressStreet: null,
    addressCity: "Alajuela",
    addressState: "Alajuela",
    addressZip: null,
    addressCountry: "Costa Rica",
    compensationAmount: "1900.00",
    compensationType: "monthly",
    emergencyContactName: null,
    emergencyContactPhone: null,
    emergencyContactRelation: null,
    clerkUserId: null,
    notes: null,
    tags: ["demo"],
  },
  {
    firstName: "Elena",
    lastName: "Ramírez",
    avatarUrl: null,
    companyEmail: "elena.ramirez@company.com",
    personalEmail: "eramirez@gmail.com",
    phone: "+506 8807-6666",
    position: "Sales Executive",
    departmentId: null,
    status: "active",
    hireDate: new Date("2024-08-01"),
    terminationDate: null,
    addressStreet: "Curridabat, Freses",
    addressCity: "San José",
    addressState: "San José",
    addressZip: "11801",
    addressCountry: "Costa Rica",
    compensationAmount: "2100.00",
    compensationType: "monthly",
    emergencyContactName: "Jorge Ramírez",
    emergencyContactPhone: "+506 8808-7777",
    emergencyContactRelation: "Brother",
    clerkUserId: null,
    notes: null,
    tags: ["demo"],
  },
];

// Quote templates receive clientId and clientName/email at seed time
type DemoQuoteTemplate = {
  clientKey: string; // matches DEMO_CLIENTS[i].input.name
  input: Omit<QuoteInput, "clientId" | "clientName" | "clientEmail">;
};

const DEMO_QUOTE_TEMPLATES: DemoQuoteTemplate[] = [
  {
    clientKey: "Café Montaña",
    input: {
      title: "Brand Refresh Package",
      issueDate: "2025-01-10",
      expiryDate: "2025-02-10",
      currency: "USD",
      taxRate: 0.13,
      subtotal: 3982.30,
      taxAmount: 517.70,
      total: 4500.00,
      notes: "Includes logo redesign, brand guidelines, and social media kit.",
      tags: ["demo"],
      lineItems: [
        { description: "Logo redesign & brand identity", quantity: 1, unitPrice: 2200, subtotal: 2200 },
        { description: "Brand guidelines document", quantity: 1, unitPrice: 900, subtotal: 900 },
        { description: "Social media kit (10 templates)", quantity: 1, unitPrice: 882.30, subtotal: 882.30 },
      ],
    },
  },
  {
    clientKey: "TechFlow Solutions",
    input: {
      title: "API Integration Development",
      issueDate: "2025-02-01",
      expiryDate: "2025-03-01",
      currency: "USD",
      taxRate: 0,
      subtotal: 12500,
      taxAmount: 0,
      total: 12500,
      notes: "Fixed-price engagement. 60-day delivery from kickoff.",
      tags: ["demo"],
      lineItems: [
        { description: "Technical discovery & architecture", quantity: 1, unitPrice: 2500, subtotal: 2500 },
        { description: "API development (REST + webhooks)", quantity: 80, unitPrice: 100, subtotal: 8000 },
        { description: "Testing, documentation & handoff", quantity: 1, unitPrice: 2000, subtotal: 2000 },
      ],
    },
  },
  {
    clientKey: "Inmobiliaria Pacífico",
    input: {
      title: "Digital Marketing Campaign — Q2 2025",
      issueDate: "2025-03-01",
      expiryDate: "2025-03-31",
      currency: "USD",
      taxRate: 0.13,
      subtotal: 6017.70,
      taxAmount: 782.30,
      total: 6800,
      notes: "3-month retainer covering social, Google Ads, and monthly reporting.",
      tags: ["demo"],
      lineItems: [
        { description: "Social media management (3 months)", quantity: 3, unitPrice: 800, subtotal: 2400 },
        { description: "Google Ads management & budget", quantity: 3, unitPrice: 1200, subtotal: 3600 },
        { description: "Monthly analytics report", quantity: 3, unitPrice: 5.90, subtotal: 17.70 },
      ],
    },
  },
  {
    clientKey: "ArtisanCR",
    input: {
      title: "E-Commerce Platform Launch",
      issueDate: "2025-03-15",
      expiryDate: "2025-04-15",
      currency: "USD",
      taxRate: 0.13,
      subtotal: 7256.64,
      taxAmount: 943.36,
      total: 8200,
      notes: "Includes custom Shopify theme, product setup (up to 50 SKUs), and launch training.",
      tags: ["demo"],
      lineItems: [
        { description: "Custom Shopify theme development", quantity: 1, unitPrice: 4500, subtotal: 4500 },
        { description: "Product catalog setup (50 SKUs)", quantity: 50, unitPrice: 25, subtotal: 1250 },
        { description: "Payment gateway & shipping config", quantity: 1, unitPrice: 800, subtotal: 800 },
        { description: "Launch training session (2h)", quantity: 2, unitPrice: 353.32, subtotal: 706.64 },
      ],
    },
  },
];

const DEMO_ASSETS: DemoAsset[] = [
  {
    employeeIndex: 0, // Carlos Vargas
    data: {
      name: "MacBook Pro 14\" M3 Pro",
      category: "Electronics",
      brand: "Apple",
      model: "MacBook Pro 14\" M3 Pro",
      serialNumber: "C02XG0EKJGH8",
      barcode: "ASSET-DEMO-001",
      status: "checked_out",
      location: "Main Office",
      purchaseDate: new Date("2024-01-15"),
      purchasePrice: "2499.00",
      warrantyExpiry: new Date("2026-01-15"),
      supplier: "Apple Store",
      buyUrl: null,
      notes: "Primary workstation for design team.",
      tags: ["demo"],
    },
  },
  {
    employeeIndex: 1, // Mariana Jiménez
    data: {
      name: "iPhone 15 Pro 256GB",
      category: "Electronics",
      brand: "Apple",
      model: "iPhone 15 Pro 256GB",
      serialNumber: "DNPX8F2D3K7A",
      barcode: "ASSET-DEMO-002",
      status: "checked_out",
      location: "Main Office",
      purchaseDate: new Date("2024-02-01"),
      purchasePrice: "999.00",
      warrantyExpiry: new Date("2026-02-01"),
      supplier: "Apple Store",
      buyUrl: null,
      notes: null,
      tags: ["demo"],
    },
  },
  {
    employeeIndex: 2, // Sofía Mata
    data: {
      name: "Herman Miller Aeron Chair",
      category: "Furniture",
      brand: "Herman Miller",
      model: "Aeron Chair Size C",
      serialNumber: "HM-AC-2024-0042",
      barcode: "ASSET-DEMO-003",
      status: "checked_out",
      location: "Main Office",
      purchaseDate: new Date("2024-03-10"),
      purchasePrice: "1495.00",
      warrantyExpiry: new Date("2036-03-10"),
      supplier: "OfficeMax CR",
      buyUrl: null,
      notes: "12-year manufacturer warranty.",
      tags: ["demo"],
    },
  },
  {
    employeeIndex: null,
    data: {
      name: "Sony Alpha A7 IV Camera",
      category: "Electronics",
      brand: "Sony",
      model: "Alpha A7 IV Mirrorless",
      serialNumber: "4034921850",
      barcode: "ASSET-DEMO-004",
      status: "available",
      location: "Studio / Storage",
      purchaseDate: new Date("2023-11-20"),
      purchasePrice: "2498.00",
      warrantyExpiry: new Date("2025-11-20"),
      supplier: "B&H Photo",
      buyUrl: null,
      notes: "Shared resource — book via calendar.",
      tags: ["demo"],
    },
  },
  {
    employeeIndex: null,
    data: {
      name: "Epson EB-X51 Projector",
      category: "Electronics",
      brand: "Epson",
      model: "EB-X51",
      serialNumber: "X51CR-20240055",
      barcode: "ASSET-DEMO-005",
      status: "available",
      location: "Conference Room",
      purchaseDate: new Date("2024-05-01"),
      purchasePrice: "599.00",
      warrantyExpiry: new Date("2026-05-01"),
      supplier: "Importaciones Tecnológicas CR",
      buyUrl: null,
      notes: null,
      tags: ["demo"],
    },
  },
];

// ── Status ────────────────────────────────────────────────────────────────────

export async function getDemoStatus(tenantId: string): Promise<{
  clients: number;
  providers: number;
  employees: number;
  quotes: number;
  assets: number;
}> {
  const [clientRows, providerRows, employeeRows, quoteRows, assetRows] = await Promise.all([
    db
      .select({ n: count() })
      .from(clients)
      .where(and(eq(clients.tenantId, tenantId), sql`${clients.tags} @> ARRAY['demo']::text[]`)),
    db
      .select({ n: count() })
      .from(providers)
      .where(and(eq(providers.tenantId, tenantId), sql`${providers.tags} @> ARRAY['demo']::text[]`)),
    db
      .select({ n: count() })
      .from(employees)
      .where(and(eq(employees.tenantId, tenantId), sql`${employees.tags} @> ARRAY['demo']::text[]`)),
    db
      .select({ n: count() })
      .from(quotes)
      .where(and(eq(quotes.tenantId, tenantId), sql`${quotes.tags} @> ARRAY['demo']::text[]`)),
    db
      .select({ n: count() })
      .from(assets)
      .where(and(eq(assets.tenantId, tenantId), sql`${assets.tags} @> ARRAY['demo']::text[]`)),
  ]);
  return {
    clients: Number(clientRows[0]?.n ?? 0),
    providers: Number(providerRows[0]?.n ?? 0),
    employees: Number(employeeRows[0]?.n ?? 0),
    quotes: Number(quoteRows[0]?.n ?? 0),
    assets: Number(assetRows[0]?.n ?? 0),
  };
}

// ── Seed ──────────────────────────────────────────────────────────────────────

export async function seedDemoData(tenantId: string, seededBy: string): Promise<void> {
  // Clients (track IDs for quote linking)
  const clientIdByName = new Map<string, { id: string; email: string }>();
  for (const demo of DEMO_CLIENTS) {
    const client = await createClient(tenantId, seededBy, demo.input);
    clientIdByName.set(demo.input.name, { id: client.id, email: demo.input.billingEmail });
    for (const contact of demo.contacts) {
      await addClientContact(tenantId, client.id, contact);
    }
  }

  // Providers
  for (const demo of DEMO_PROVIDERS) {
    const provider = await createProvider(tenantId, seededBy, demo.input);
    for (const contact of demo.contacts) {
      await addProviderContact(tenantId, provider.id, contact);
    }
  }

  // Employees (track IDs for asset assignment)
  const createdEmployeeIds: string[] = [];
  for (const emp of DEMO_EMPLOYEES) {
    const employee = await createEmployee(tenantId, seededBy, emp);
    createdEmployeeIds.push(employee.id);
  }

  // Assets (some assigned to demo employees)
  for (const asset of DEMO_ASSETS) {
    await createAsset(tenantId, seededBy, {
      ...asset.data,
      assignedToId: asset.employeeIndex !== null ? (createdEmployeeIds[asset.employeeIndex] ?? null) : null,
    });
  }

  // Quotes (linked to demo clients by name)
  for (const tmpl of DEMO_QUOTE_TEMPLATES) {
    const clientRef = clientIdByName.get(tmpl.clientKey);
    if (!clientRef) continue;
    const clientEntry = DEMO_CLIENTS.find((c) => c.input.name === tmpl.clientKey);
    await createQuote(tenantId, seededBy, {
      ...tmpl.input,
      clientId: clientRef.id,
      clientName: tmpl.clientKey,
      clientEmail: clientRef.email,
      // Resolve primary contact email if available
      ...(clientEntry?.contacts.find((c) => c.isPrimary)
        ? { clientEmail: clientEntry.contacts.find((c) => c.isPrimary)!.email }
        : {}),
    });
  }
}

// ── Reset ─────────────────────────────────────────────────────────────────────

export async function resetDemoData(tenantId: string): Promise<void> {
  // Delete quotes first (FK → clients) and assets first (FK → employees)
  await Promise.all([
    db
      .delete(quotes)
      .where(and(eq(quotes.tenantId, tenantId), sql`${quotes.tags} @> ARRAY['demo']::text[]`)),
    db
      .delete(assets)
      .where(and(eq(assets.tenantId, tenantId), sql`${assets.tags} @> ARRAY['demo']::text[]`)),
  ]);

  // Then delete clients, providers, employees
  await Promise.all([
    db
      .delete(clients)
      .where(and(eq(clients.tenantId, tenantId), sql`${clients.tags} @> ARRAY['demo']::text[]`)),
    db
      .delete(providers)
      .where(and(eq(providers.tenantId, tenantId), sql`${providers.tags} @> ARRAY['demo']::text[]`)),
    db
      .delete(employees)
      .where(and(eq(employees.tenantId, tenantId), sql`${employees.tags} @> ARRAY['demo']::text[]`)),
  ]);
}

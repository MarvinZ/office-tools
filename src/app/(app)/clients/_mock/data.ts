export type ClientStatus = "active" | "inactive" | "prospect" | "blocked";
export type PaymentTerms = "immediate" | "net_15" | "net_30" | "net_60" | "net_90";

export type ClientContact = {
  id: string;
  name: string;
  title: string;
  email: string;
  phone?: string;
  isPrimary: boolean;
};

export type ClientDocument = {
  id: string;
  name: string;
  type: "contract" | "nda" | "proposal" | "invoice" | "other";
  url: string;
  uploadedAt: string;
};

export type ClientNote = {
  id: string;
  body: string;
  createdBy: string;
  createdAt: string;
};

export type Client = {
  id: string;
  name: string;           // trading / brand name
  legalName: string;      // legal registered name
  taxId: string;          // cedula jurídica / RUC / EIN
  industry: string;
  status: ClientStatus;
  website?: string;
  paymentTerms: PaymentTerms;
  currency: string;
  creditLimit?: number;
  billingEmail: string;
  // Address
  addressStreet: string;
  addressCity: string;
  addressState: string;
  addressZip: string;
  addressCountry: string;
  // Relations
  contacts: ClientContact[];
  documents: ClientDocument[];
  notes: ClientNote[];
  // Meta
  clientSince: string;
  tags: string[];
  createdAt: string;
};

export const STATUS_CONFIG: Record<ClientStatus, { color: string; dot: string }> = {
  active:   { color: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",   dot: "bg-green-500" },
  inactive: { color: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",          dot: "bg-zinc-400" },
  prospect: { color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",       dot: "bg-blue-500" },
  blocked:  { color: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",           dot: "bg-red-500" },
};

export const PAYMENT_TERMS_OPTIONS: PaymentTerms[] = ["immediate", "net_15", "net_30", "net_60", "net_90"];

export const INDUSTRIES = [
  "Technology", "Retail", "Food & Beverage", "Healthcare", "Construction",
  "Education", "Finance", "Real Estate", "Manufacturing", "Hospitality",
  "Logistics", "Media & Marketing", "Agriculture", "Government", "Other",
];

export const MOCK_CLIENTS: Client[] = [
  {
    id: "cli_001",
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
    addressStreet: "Av. Central 120",
    addressCity: "San José",
    addressState: "San José",
    addressZip: "10101",
    addressCountry: "Costa Rica",
    contacts: [
      { id: "c1", name: "Andrea Solís", title: "Gerente General", email: "andrea@cafemontana.cr", phone: "+506 8800-1234", isPrimary: true },
      { id: "c2", name: "Luis Mora", title: "Jefe de Compras", email: "compras@cafemontana.cr", phone: "+506 8800-5678", isPrimary: false },
    ],
    documents: [
      { id: "d1", name: "Contrato Marco 2024", type: "contract", url: "#", uploadedAt: "2024-01-15" },
      { id: "d2", name: "NDA Firmado", type: "nda", url: "#", uploadedAt: "2024-01-10" },
    ],
    notes: [
      { id: "n1", body: "Prefiere comunicación por WhatsApp. Decisiones las toma Andrea directamente.", createdBy: "Admin", createdAt: "2024-02-10" },
    ],
    clientSince: "2024-01-10",
    tags: ["retainer", "priority"],
    createdAt: "2024-01-10",
  },
  {
    id: "cli_002",
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
    addressStreet: "350 5th Ave, Suite 4100",
    addressCity: "New York",
    addressState: "New York",
    addressZip: "10118",
    addressCountry: "United States",
    contacts: [
      { id: "c3", name: "James Whitfield", title: "CTO", email: "james@techflow.io", phone: "+1 212 555-0100", isPrimary: true },
      { id: "c4", name: "Sara Chen", title: "Project Manager", email: "sara@techflow.io", isPrimary: false },
    ],
    documents: [
      { id: "d3", name: "Master Service Agreement", type: "contract", url: "#", uploadedAt: "2024-03-01" },
    ],
    notes: [],
    clientSince: "2024-03-01",
    tags: ["saas", "long-term"],
    createdAt: "2024-03-01",
  },
  {
    id: "cli_003",
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
    addressStreet: "Paseo Colón, Edif. Torre del Mar, Piso 6",
    addressCity: "San José",
    addressState: "San José",
    addressZip: "10101",
    addressCountry: "Costa Rica",
    contacts: [
      { id: "c5", name: "Roberto Vega", title: "Director", email: "roberto@inmopacifico.cr", phone: "+506 2222-3344", isPrimary: true },
    ],
    documents: [],
    notes: [
      { id: "n2", body: "Proyecto de branding en pausa hasta Q3. Retomar en julio.", createdBy: "Admin", createdAt: "2025-02-20" },
    ],
    clientSince: "2024-06-01",
    tags: ["design-retainer"],
    createdAt: "2024-06-01",
  },
  {
    id: "cli_004",
    name: "ArtisanCR",
    legalName: "Artisan Crafts CR S.R.L.",
    taxId: "3-102-441123",
    industry: "Retail",
    status: "prospect",
    website: "https://artisancr.com",
    paymentTerms: "immediate",
    currency: "USD",
    billingEmail: "hola@artisancr.com",
    addressStreet: "Barrio Escalante, Calle 33",
    addressCity: "San José",
    addressState: "San José",
    addressZip: "10104",
    addressCountry: "Costa Rica",
    contacts: [
      { id: "c6", name: "Valeria Núñez", title: "Fundadora", email: "hola@artisancr.com", phone: "+506 8811-9900", isPrimary: true },
    ],
    documents: [],
    notes: [
      { id: "n3", body: "Rechazó la cotización Q-2025-004 por precio. Seguimiento en 3 meses con propuesta ajustada.", createdBy: "Admin", createdAt: "2025-01-30" },
    ],
    clientSince: "2025-01-20",
    tags: ["e-commerce", "follow-up"],
    createdAt: "2025-01-20",
  },
  {
    id: "cli_005",
    name: "Gym Central",
    legalName: "Gym Central CR S.A.",
    taxId: "3-101-900044",
    industry: "Healthcare",
    status: "active",
    website: "https://gymcentral.cr",
    paymentTerms: "net_15",
    currency: "USD",
    creditLimit: 5000,
    billingEmail: "admin@gymcentral.cr",
    addressStreet: "Avenida Escazú, Local 12",
    addressCity: "Escazú",
    addressState: "San José",
    addressZip: "10201",
    addressCountry: "Costa Rica",
    contacts: [
      { id: "c7", name: "Marco Quirós", title: "CEO", email: "marco@gymcentral.cr", phone: "+506 2289-4400", isPrimary: true },
      { id: "c8", name: "Diana Prado", title: "Marketing Manager", email: "marketing@gymcentral.cr", isPrimary: false },
    ],
    documents: [
      { id: "d4", name: "Propuesta de Redes Sociales", type: "proposal", url: "#", uploadedAt: "2025-03-01" },
    ],
    notes: [],
    clientSince: "2025-03-01",
    tags: ["social-media"],
    createdAt: "2025-03-01",
  },
  {
    id: "cli_006",
    name: "FinTech CR",
    legalName: "FinTech Soluciones CR S.A.",
    taxId: "3-101-788234",
    industry: "Finance",
    status: "inactive",
    website: "https://fintechcr.com",
    paymentTerms: "net_60",
    currency: "USD",
    billingEmail: "product@fintechcr.com",
    addressStreet: "Centro Corporativo El Tobogán, Torre B",
    addressCity: "Heredia",
    addressState: "Heredia",
    addressZip: "40101",
    addressCountry: "Costa Rica",
    contacts: [
      { id: "c9", name: "Felipe Arroyo", title: "Product Lead", email: "product@fintechcr.com", phone: "+506 4000-8800", isPrimary: true },
    ],
    documents: [],
    notes: [
      { id: "n4", body: "Cotización expiró sin respuesta. Empresa en proceso de levantamiento de capital. Reaproximarse en Q4.", createdBy: "Admin", createdAt: "2025-01-16" },
    ],
    clientSince: "2024-12-01",
    tags: ["ux", "fintech"],
    createdAt: "2024-12-01",
  },
];

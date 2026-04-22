export type ProviderStatus = "active" | "inactive" | "blocked";
export type PaymentTerms = "immediate" | "net_15" | "net_30" | "net_60" | "net_90";

export type ProviderContact = {
  id: string;
  name: string;
  title: string;
  email: string;
  phone?: string;
  isPrimary: boolean;
};

export type ProviderDocument = {
  id: string;
  name: string;
  type: "contract" | "price_list" | "certificate" | "invoice" | "other";
  url: string;
  uploadedAt: string;
};

export type ProviderNote = {
  id: string;
  body: string;
  createdBy: string;
  createdAt: string;
};

export type Provider = {
  id: string;
  name: string;
  legalName: string;
  taxId: string;
  category: string;         // what they supply/provide
  status: ProviderStatus;
  website?: string;
  rating: number;           // 1–5
  // Contact
  contacts: ProviderContact[];
  // Address
  addressStreet: string;
  addressCity: string;
  addressState: string;
  addressZip: string;
  addressCountry: string;
  // Financial / payment
  currency: string;
  paymentTerms: PaymentTerms;
  bankName?: string;
  bankAccount?: string;
  bankIban?: string;
  bankSwift?: string;
  // Supply
  productsServices: string;
  leadTimeDays?: number;
  minimumOrderAmount?: number;
  contractExpiry?: string;
  // Meta
  partnerSince: string;
  tags: string[];
  documents: ProviderDocument[];
  notes: ProviderNote[];
  createdAt: string;
};

export const STATUS_CONFIG: Record<ProviderStatus, { color: string; dot: string }> = {
  active:   { color: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300", dot: "bg-green-500" },
  inactive: { color: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",        dot: "bg-zinc-400" },
  blocked:  { color: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",         dot: "bg-red-500" },
};

export const PAYMENT_TERMS_OPTIONS: PaymentTerms[] = ["immediate", "net_15", "net_30", "net_60", "net_90"];

export const PROVIDER_CATEGORIES = [
  "Technology & Software", "Office Supplies", "Marketing & Design", "Legal & Accounting",
  "Logistics & Shipping", "Raw Materials", "Manufacturing", "Cleaning & Maintenance",
  "Security", "HR & Staffing", "Financial Services", "Food & Catering",
  "Utilities", "Real Estate", "Consulting", "Other",
];

export const MOCK_PROVIDERS: Provider[] = [
  {
    id: "prv_001",
    name: "Adobe",
    legalName: "Adobe Inc.",
    taxId: "EIN 77-0019522",
    category: "Technology & Software",
    status: "active",
    website: "https://adobe.com",
    rating: 5,
    contacts: [
      { id: "c1", name: "Enterprise Support", title: "Account Manager", email: "enterprise@adobe.com", phone: "+1 800-585-0774", isPrimary: true },
    ],
    addressStreet: "345 Park Avenue",
    addressCity: "San Jose",
    addressState: "California",
    addressZip: "95110",
    addressCountry: "United States",
    currency: "USD",
    paymentTerms: "net_30",
    bankName: "N/A — Credit Card",
    productsServices: "Creative Cloud (Photoshop, Illustrator, InDesign, Premiere Pro, After Effects). Annual team subscription.",
    leadTimeDays: 0,
    contractExpiry: "2026-01-31",
    partnerSince: "2022-02-01",
    tags: ["software", "design", "essential"],
    documents: [
      { id: "d1", name: "Enterprise License Agreement", type: "contract", url: "#", uploadedAt: "2025-01-31" },
    ],
    notes: [
      { id: "n1", body: "Renovar antes del 31 de enero. Precio negociado para 5 licencias.", createdBy: "Admin", createdAt: "2024-12-01" },
    ],
    createdAt: "2022-02-01",
  },
  {
    id: "prv_002",
    name: "Vercel",
    legalName: "Vercel Inc.",
    taxId: "EIN 85-3729345",
    category: "Technology & Software",
    status: "active",
    website: "https://vercel.com",
    rating: 5,
    contacts: [
      { id: "c2", name: "Billing Support", title: "Support", email: "support@vercel.com", isPrimary: true },
    ],
    addressStreet: "440 N Barranca Ave #4133",
    addressCity: "Covina",
    addressState: "California",
    addressZip: "91723",
    addressCountry: "United States",
    currency: "USD",
    paymentTerms: "immediate",
    productsServices: "Cloud hosting, CI/CD, edge functions, analytics. Pro team plan.",
    leadTimeDays: 0,
    partnerSince: "2023-06-01",
    tags: ["hosting", "infrastructure", "essential"],
    documents: [],
    notes: [],
    createdAt: "2023-06-01",
  },
  {
    id: "prv_003",
    name: "Impresos del Valle",
    legalName: "Impresos del Valle S.A.",
    taxId: "3-101-334512",
    category: "Marketing & Design",
    status: "active",
    website: "https://impresosdelvalle.cr",
    rating: 4,
    contacts: [
      { id: "c3", name: "Carlos Fonseca", title: "Ejecutivo de Ventas", email: "ventas@impresosdelvalle.cr", phone: "+506 2244-6600", isPrimary: true },
      { id: "c4", name: "Recepción", title: "Recepción", email: "info@impresosdelvalle.cr", phone: "+506 2244-6601", isPrimary: false },
    ],
    addressStreet: "Zona Industrial Ulloa, Bodega 14",
    addressCity: "Heredia",
    addressState: "Heredia",
    addressZip: "40101",
    addressCountry: "Costa Rica",
    currency: "CRC",
    paymentTerms: "immediate",
    bankName: "Banco Nacional de Costa Rica",
    bankAccount: "001-02345-6",
    productsServices: "Impresión offset y digital: brochures, banners, tarjetas de presentación, empaque personalizado.",
    leadTimeDays: 5,
    minimumOrderAmount: 50,
    partnerSince: "2023-08-01",
    tags: ["printing", "local"],
    documents: [
      { id: "d2", name: "Lista de Precios 2025", type: "price_list", url: "#", uploadedAt: "2025-01-05" },
    ],
    notes: [
      { id: "n2", body: "Tiempo de entrega real es 7 días para pedidos grandes. Pedir con anticipación.", createdBy: "Admin", createdAt: "2024-09-15" },
    ],
    createdAt: "2023-08-01",
  },
  {
    id: "prv_004",
    name: "Despacho Arias & Cía",
    legalName: "Arias, Bonilla y Asociados S.A.",
    taxId: "3-101-512783",
    category: "Legal & Accounting",
    status: "active",
    website: "https://ariasycía.cr",
    rating: 5,
    contacts: [
      { id: "c5", name: "Lic. Patricia Arias", title: "Socia Directora", email: "parias@ariascia.cr", phone: "+506 2221-8800", isPrimary: true },
      { id: "c6", name: "Lic. Rodrigo Bonilla", title: "Abogado Senior", email: "rbonilla@ariascia.cr", phone: "+506 2221-8801", isPrimary: false },
    ],
    addressStreet: "Edificio Centro Colón, Piso 9, Of. 901",
    addressCity: "San José",
    addressState: "San José",
    addressZip: "10101",
    addressCountry: "Costa Rica",
    currency: "USD",
    paymentTerms: "net_15",
    bankName: "BAC San José",
    bankAccount: "921-3344-1",
    bankSwift: "BCCRCRSJXXX",
    productsServices: "Asesoría legal corporativa, constitución de sociedades, contratos comerciales, propiedad intelectual.",
    partnerSince: "2023-01-15",
    tags: ["legal", "essential"],
    documents: [
      { id: "d3", name: "Contrato de Servicios Legales", type: "contract", url: "#", uploadedAt: "2023-01-15" },
    ],
    notes: [
      { id: "n3", body: "Tarifa por hora: $180. Consultas menores de 30 min sin cobro.", createdBy: "Admin", createdAt: "2023-01-20" },
    ],
    createdAt: "2023-01-15",
  },
  {
    id: "prv_005",
    name: "Servientrega CR",
    legalName: "Servientrega Costa Rica S.A.",
    taxId: "3-101-710034",
    category: "Logistics & Shipping",
    status: "active",
    website: "https://servientrega.cr",
    rating: 3,
    contacts: [
      { id: "c7", name: "Atención al Cliente", title: "Soporte", email: "atencion@servientrega.cr", phone: "+506 4000-7777", isPrimary: true },
      { id: "c8", name: "Kathia Solano", title: "Ejecutiva de Cuenta", email: "ksolano@servientrega.cr", phone: "+506 8922-3300", isPrimary: false },
    ],
    addressStreet: "Zona Franca Metropolitana, Bodega 8",
    addressCity: "San José",
    addressState: "San José",
    addressZip: "10901",
    addressCountry: "Costa Rica",
    currency: "CRC",
    paymentTerms: "immediate",
    bankName: "Banco de Costa Rica",
    bankAccount: "014-11223-3",
    productsServices: "Mensajería y paquetería nacional e internacional. Recogida en oficina disponible.",
    leadTimeDays: 2,
    partnerSince: "2024-03-01",
    tags: ["shipping", "logistics"],
    documents: [
      { id: "d4", name: "Tarifario Corporativo", type: "price_list", url: "#", uploadedAt: "2024-03-01" },
    ],
    notes: [
      { id: "n4", body: "Retrasos frecuentes en zona de Limón. Para entregas urgentes usar DHL.", createdBy: "Admin", createdAt: "2024-10-05" },
    ],
    createdAt: "2024-03-01",
  },
  {
    id: "prv_006",
    name: "Neon Database",
    legalName: "Neon Inc.",
    taxId: "EIN 88-1234567",
    category: "Technology & Software",
    status: "active",
    website: "https://neon.tech",
    rating: 5,
    contacts: [
      { id: "c9", name: "Billing", title: "Support", email: "hello@neon.tech", isPrimary: true },
    ],
    addressStreet: "548 Market St, PMB 99492",
    addressCity: "San Francisco",
    addressState: "California",
    addressZip: "94104",
    addressCountry: "United States",
    currency: "USD",
    paymentTerms: "immediate",
    productsServices: "Serverless PostgreSQL. Branching, autoscaling, scale-to-zero.",
    leadTimeDays: 0,
    partnerSince: "2024-01-01",
    tags: ["database", "infrastructure", "essential"],
    documents: [],
    notes: [],
    createdAt: "2024-01-01",
  },
  {
    id: "prv_007",
    name: "Oficentro La Virgen",
    legalName: "Suministros La Virgen S.A.",
    taxId: "3-101-220091",
    category: "Office Supplies",
    status: "inactive",
    website: undefined,
    rating: 2,
    contacts: [
      { id: "c10", name: "Ventas", title: "Ventas", email: "ventas@oficentrolavirgen.cr", phone: "+506 2255-1100", isPrimary: true },
    ],
    addressStreet: "Av. 2, Calle 9",
    addressCity: "San José",
    addressState: "San José",
    addressZip: "10100",
    addressCountry: "Costa Rica",
    currency: "CRC",
    paymentTerms: "immediate",
    productsServices: "Suministros de oficina: papel, tóner, artículos de papelería.",
    leadTimeDays: 3,
    minimumOrderAmount: 20,
    partnerSince: "2022-05-01",
    tags: ["office"],
    documents: [],
    notes: [
      { id: "n5", body: "Precios más altos que Amazon. Solo usar para urgencias locales.", createdBy: "Admin", createdAt: "2024-06-01" },
    ],
    createdAt: "2022-05-01",
  },
];

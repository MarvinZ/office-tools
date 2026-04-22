export type QuoteStatus = "draft" | "sent" | "viewed" | "accepted" | "declined" | "expired";

export type QuoteLineItem = {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
};

export type QuoteActivity = {
  id: string;
  action: "created" | "sent" | "viewed" | "accepted" | "declined" | "expired" | "updated";
  date: string;
  note?: string;
};

export type Quote = {
  id: string;
  number: string;
  title: string;
  clientName: string;
  clientEmail: string;
  status: QuoteStatus;
  issueDate: string;
  expiryDate: string;
  lineItems: QuoteLineItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  notes: string;
  currency: string;
  activity: QuoteActivity[];
  createdAt: string;
};

export const STATUS_CONFIG: Record<QuoteStatus, { color: string; dot: string }> = {
  draft:    { color: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",     dot: "bg-zinc-400" },
  sent:     { color: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",   dot: "bg-blue-500" },
  viewed:   { color: "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300", dot: "bg-purple-500" },
  accepted: { color: "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300", dot: "bg-green-500" },
  declined: { color: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",       dot: "bg-red-500" },
  expired:  { color: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300", dot: "bg-amber-500" },
};

function items(list: Omit<QuoteLineItem, "subtotal">[]): QuoteLineItem[] {
  return list.map((i) => ({ ...i, subtotal: i.quantity * i.unitPrice }));
}

function totals(lineItems: QuoteLineItem[], taxRate: number) {
  const subtotal = lineItems.reduce((s, i) => s + i.subtotal, 0);
  const taxAmount = Math.round(subtotal * taxRate * 100) / 100;
  return { subtotal, taxRate, taxAmount, total: subtotal + taxAmount };
}

const q1Items = items([
  { id: "li1", description: "Brand identity design (logo, color palette, typography guide)", quantity: 1, unitPrice: 1800 },
  { id: "li2", description: "Stationery design (business card, letterhead, envelope)", quantity: 1, unitPrice: 600 },
  { id: "li3", description: "Brand guidelines document (PDF)", quantity: 1, unitPrice: 400 },
]);

const q2Items = items([
  { id: "li4", description: "Landing page design & development (Next.js)", quantity: 1, unitPrice: 3200 },
  { id: "li5", description: "CMS integration (Sanity)", quantity: 1, unitPrice: 800 },
  { id: "li6", description: "SEO setup & sitemap", quantity: 1, unitPrice: 300 },
  { id: "li7", description: "Hosting setup (Vercel)", quantity: 1, unitPrice: 200 },
]);

const q3Items = items([
  { id: "li8", description: "Monthly retainer – design & development support", quantity: 3, unitPrice: 1500 },
]);

const q4Items = items([
  { id: "li9",  description: "E-commerce platform development (Next.js + Stripe)", quantity: 1, unitPrice: 5500 },
  { id: "li10", description: "Product catalog setup (up to 100 SKUs)", quantity: 1, unitPrice: 1200 },
  { id: "li11", description: "Admin dashboard", quantity: 1, unitPrice: 1800 },
  { id: "li12", description: "QA & testing", quantity: 1, unitPrice: 600 },
]);

const q5Items = items([
  { id: "li13", description: "Social media template pack (10 designs, 3 formats each)", quantity: 1, unitPrice: 950 },
  { id: "li14", description: "Revisions round", quantity: 2, unitPrice: 150 },
]);

const q6Items = items([
  { id: "li15", description: "UI/UX audit report", quantity: 1, unitPrice: 1200 },
  { id: "li16", description: "Wireframes & interactive prototype (Figma)", quantity: 1, unitPrice: 2000 },
  { id: "li17", description: "Presentation deck", quantity: 1, unitPrice: 400 },
]);

export const MOCK_QUOTES: Quote[] = [
  {
    id: "qte_001",
    number: "Q-2025-001",
    title: "Brand Identity Package",
    clientName: "Café Montaña S.A.",
    clientEmail: "info@cafemontana.cr",
    status: "accepted",
    issueDate: "2025-01-10",
    expiryDate: "2025-01-25",
    lineItems: q1Items,
    ...totals(q1Items, 0.13),
    currency: "USD",
    notes: "Includes 2 rounds of revisions. Final files delivered in AI, EPS, SVG, PNG, and PDF formats.",
    activity: [
      { id: "a1", action: "created", date: "2025-01-10" },
      { id: "a2", action: "sent", date: "2025-01-10", note: "Sent to info@cafemontana.cr" },
      { id: "a3", action: "viewed", date: "2025-01-12", note: "Client opened the quote" },
      { id: "a4", action: "accepted", date: "2025-01-14", note: "Client accepted via email" },
    ],
    createdAt: "2025-01-10",
  },
  {
    id: "qte_002",
    number: "Q-2025-002",
    title: "Marketing Website",
    clientName: "TechFlow Solutions",
    clientEmail: "projects@techflow.io",
    status: "sent",
    issueDate: "2025-02-03",
    expiryDate: "2025-02-17",
    lineItems: q2Items,
    ...totals(q2Items, 0.13),
    currency: "USD",
    notes: "Payment: 50% upfront, 50% on delivery. Estimated timeline: 6 weeks.",
    activity: [
      { id: "a5", action: "created", date: "2025-02-03" },
      { id: "a6", action: "sent", date: "2025-02-03", note: "Sent to projects@techflow.io" },
    ],
    createdAt: "2025-02-03",
  },
  {
    id: "qte_003",
    number: "Q-2025-003",
    title: "Design Retainer — Q1 2025",
    clientName: "Inmobiliaria Pacífico",
    clientEmail: "admin@inmopacifico.cr",
    status: "viewed",
    issueDate: "2025-02-15",
    expiryDate: "2025-03-01",
    lineItems: q3Items,
    ...totals(q3Items, 0.13),
    currency: "USD",
    notes: "Monthly retainer covers up to 40 hours per month. Unused hours do not roll over.",
    activity: [
      { id: "a7", action: "created", date: "2025-02-15" },
      { id: "a8", action: "sent", date: "2025-02-15", note: "Sent to admin@inmopacifico.cr" },
      { id: "a9", action: "viewed", date: "2025-02-18" },
    ],
    createdAt: "2025-02-15",
  },
  {
    id: "qte_004",
    number: "Q-2025-004",
    title: "E-Commerce Platform",
    clientName: "ArtisanCR",
    clientEmail: "hola@artisancr.com",
    status: "declined",
    issueDate: "2025-01-20",
    expiryDate: "2025-02-03",
    lineItems: q4Items,
    ...totals(q4Items, 0.13),
    currency: "USD",
    notes: "Full e-commerce solution including payment processing and inventory management.",
    activity: [
      { id: "a10", action: "created", date: "2025-01-20" },
      { id: "a11", action: "sent", date: "2025-01-21", note: "Sent to hola@artisancr.com" },
      { id: "a12", action: "viewed", date: "2025-01-24" },
      { id: "a13", action: "declined", date: "2025-01-29", note: "Client went with another vendor" },
    ],
    createdAt: "2025-01-20",
  },
  {
    id: "qte_005",
    number: "Q-2025-005",
    title: "Social Media Template Pack",
    clientName: "Gym Central",
    clientEmail: "marketing@gymcentral.cr",
    status: "draft",
    issueDate: "2025-03-01",
    expiryDate: "2025-03-15",
    lineItems: q5Items,
    ...totals(q5Items, 0.13),
    currency: "USD",
    notes: "Formats: Instagram (1:1, 4:5, 9:16), Facebook (16:9), LinkedIn (1.91:1). Editable in Canva.",
    activity: [
      { id: "a14", action: "created", date: "2025-03-01" },
    ],
    createdAt: "2025-03-01",
  },
  {
    id: "qte_006",
    number: "Q-2025-006",
    title: "UX Audit & Prototype",
    clientName: "FinTech CR",
    clientEmail: "product@fintechcr.com",
    status: "expired",
    issueDate: "2024-12-01",
    expiryDate: "2024-12-15",
    lineItems: q6Items,
    ...totals(q6Items, 0.13),
    currency: "USD",
    notes: "Audit covers main user flows. Prototype built in Figma with developer handoff.",
    activity: [
      { id: "a15", action: "created", date: "2024-12-01" },
      { id: "a16", action: "sent", date: "2024-12-02", note: "Sent to product@fintechcr.com" },
      { id: "a17", action: "viewed", date: "2024-12-05" },
      { id: "a18", action: "expired", date: "2024-12-15", note: "Quote expired without response" },
    ],
    createdAt: "2024-12-01",
  },
];

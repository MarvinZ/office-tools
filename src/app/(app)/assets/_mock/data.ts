export type AssetStatus = "available" | "checked_out" | "maintenance" | "retired";
export type AssetCategory = "Electronics" | "Furniture" | "Vehicles" | "Equipment" | "Tools" | "Other";

export type AssetDocument = {
  id: string;
  name: string;
  type: "invoice" | "manual" | "warranty" | "other";
  url: string;
  uploadedAt: string;
};

export type AssetHistoryEntry = {
  id: string;
  action: "created" | "checked_out" | "checked_in" | "maintenance_start" | "maintenance_end" | "updated" | "document_added";
  date: string;
  user: string;
  notes?: string;
};

export type Asset = {
  id: string;
  name: string;
  category: AssetCategory;
  brand: string;
  model: string;
  serialNumber: string;
  barcode: string;
  status: AssetStatus;
  location: string;
  assignedTo?: string;
  purchaseDate: string;
  purchasePrice: number;
  warrantyExpiry: string;
  supplier: string;
  buyUrl?: string;
  notes?: string;
  tags: string[];
  photos: string[];
  documents: AssetDocument[];
  history: AssetHistoryEntry[];
  createdAt: string;
};

export const MOCK_ASSETS: Asset[] = [
  {
    id: "ast_001",
    name: 'MacBook Pro 14"',
    category: "Electronics",
    brand: "Apple",
    model: "MacBook Pro 14 M3",
    serialNumber: "C02XG2JHMD6T",
    barcode: "194253716174",
    status: "checked_out",
    location: "Office A",
    assignedTo: "Marvin Zumbado",
    purchaseDate: "2024-01-15",
    purchasePrice: 1999,
    warrantyExpiry: "2027-01-15",
    supplier: "Apple Store",
    buyUrl: "https://apple.com/macbook-pro",
    notes: "Primary dev machine. Handle with care.",
    tags: ["dev", "laptop", "priority"],
    photos: [
      "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800",
      "https://images.unsplash.com/photo-1611186871525-2e7a7e9fe7b8?w=800",
    ],
    documents: [
      { id: "doc_001", name: "Purchase Invoice", type: "invoice", url: "#", uploadedAt: "2024-01-15" },
      { id: "doc_002", name: "AppleCare+ Certificate", type: "warranty", url: "#", uploadedAt: "2024-01-15" },
    ],
    history: [
      { id: "h1", action: "created", date: "2024-01-15", user: "Admin", notes: "Asset registered" },
      { id: "h2", action: "checked_out", date: "2024-01-16", user: "Admin", notes: "Assigned to Marvin Zumbado" },
      { id: "h3", action: "document_added", date: "2024-01-16", user: "Admin", notes: "AppleCare+ certificate uploaded" },
    ],
    createdAt: "2024-01-15",
  },
  {
    id: "ast_002",
    name: "Standing Desk",
    category: "Furniture",
    brand: "Flexispot",
    model: "E7 Pro",
    serialNumber: "FXP-E7P-2024-0042",
    barcode: "604565123456",
    status: "available",
    location: "Office A",
    purchaseDate: "2023-08-10",
    purchasePrice: 649,
    warrantyExpiry: "2028-08-10",
    supplier: "Flexispot.com",
    buyUrl: "https://flexispot.com/e7-pro",
    notes: "Height-adjustable. Max load 355 lbs.",
    tags: ["furniture", "ergonomic"],
    photos: [
      "https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=800",
    ],
    documents: [
      { id: "doc_003", name: "Assembly Manual", type: "manual", url: "#", uploadedAt: "2023-08-10" },
      { id: "doc_004", name: "Purchase Invoice", type: "invoice", url: "#", uploadedAt: "2023-08-10" },
    ],
    history: [
      { id: "h4", action: "created", date: "2023-08-10", user: "Admin", notes: "Asset registered" },
    ],
    createdAt: "2023-08-10",
  },
  {
    id: "ast_003",
    name: "Canon EOS R6",
    category: "Electronics",
    brand: "Canon",
    model: "EOS R6 Mark II",
    serialNumber: "CNR6M2-00312",
    barcode: "013803346497",
    status: "maintenance",
    location: "Storage Room",
    purchaseDate: "2023-03-22",
    purchasePrice: 2499,
    warrantyExpiry: "2025-03-22",
    supplier: "B&H Photo",
    buyUrl: "https://bhphotovideo.com",
    notes: "Sensor cleaning scheduled. Do not use until cleared.",
    tags: ["camera", "photography"],
    photos: [
      "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=800",
    ],
    documents: [
      { id: "doc_005", name: "Purchase Invoice", type: "invoice", url: "#", uploadedAt: "2023-03-22" },
      { id: "doc_006", name: "User Manual", type: "manual", url: "#", uploadedAt: "2023-03-22" },
    ],
    history: [
      { id: "h5", action: "created", date: "2023-03-22", user: "Admin" },
      { id: "h6", action: "checked_out", date: "2024-02-01", user: "Admin", notes: "Assigned for photoshoot" },
      { id: "h7", action: "checked_in", date: "2024-02-05", user: "Admin" },
      { id: "h8", action: "maintenance_start", date: "2024-03-10", user: "Admin", notes: "Sensor cleaning" },
    ],
    createdAt: "2023-03-22",
  },
  {
    id: "ast_004",
    name: "Toyota HiAce Van",
    category: "Vehicles",
    brand: "Toyota",
    model: "HiAce 2022",
    serialNumber: "VIN-JTFSX22P-00194",
    barcode: "VIN00194",
    status: "checked_out",
    location: "Field",
    assignedTo: "Carlos Méndez",
    purchaseDate: "2022-06-01",
    purchasePrice: 38000,
    warrantyExpiry: "2025-06-01",
    supplier: "Toyota Costa Rica",
    notes: "Plate: CRC-1234. Next service at 80,000km.",
    tags: ["vehicle", "transport"],
    photos: [
      "https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?w=800",
    ],
    documents: [
      { id: "doc_007", name: "Vehicle Title", type: "other", url: "#", uploadedAt: "2022-06-01" },
      { id: "doc_008", name: "Insurance Policy", type: "other", url: "#", uploadedAt: "2024-01-01" },
      { id: "doc_009", name: "Purchase Invoice", type: "invoice", url: "#", uploadedAt: "2022-06-01" },
    ],
    history: [
      { id: "h9", action: "created", date: "2022-06-01", user: "Admin" },
      { id: "h10", action: "checked_out", date: "2024-03-01", user: "Admin", notes: "Assigned to Carlos Méndez" },
    ],
    createdAt: "2022-06-01",
  },
  {
    id: "ast_005",
    name: "DeWalt Drill Set",
    category: "Tools",
    brand: "DeWalt",
    model: "DCD777C2",
    serialNumber: "DW-DCD777-00891",
    barcode: "885911474818",
    status: "available",
    location: "Tool Storage",
    purchaseDate: "2023-11-05",
    purchasePrice: 179,
    warrantyExpiry: "2026-11-05",
    supplier: "Home Depot",
    buyUrl: "https://homedepot.com",
    tags: ["tools", "power-tools"],
    photos: [
      "https://images.unsplash.com/photo-1504148455328-c376907d081c?w=800",
    ],
    documents: [
      { id: "doc_010", name: "Purchase Invoice", type: "invoice", url: "#", uploadedAt: "2023-11-05" },
    ],
    history: [
      { id: "h11", action: "created", date: "2023-11-05", user: "Admin" },
      { id: "h12", action: "checked_out", date: "2024-01-10", user: "Admin", notes: "Used for office renovation" },
      { id: "h13", action: "checked_in", date: "2024-01-12", user: "Admin" },
    ],
    createdAt: "2023-11-05",
  },
  {
    id: "ast_006",
    name: 'LG UltraWide Monitor 34"',
    category: "Electronics",
    brand: "LG",
    model: "34WP65C-B",
    serialNumber: "LG-34WP-20240022",
    barcode: "195174041758",
    status: "available",
    location: "Office B",
    purchaseDate: "2024-02-20",
    purchasePrice: 499,
    warrantyExpiry: "2027-02-20",
    supplier: "Amazon",
    buyUrl: "https://amazon.com",
    tags: ["monitor", "display"],
    photos: [
      "https://images.unsplash.com/photo-1527443224154-c4a573d5f5c4?w=800",
    ],
    documents: [
      { id: "doc_011", name: "Purchase Invoice", type: "invoice", url: "#", uploadedAt: "2024-02-20" },
    ],
    history: [
      { id: "h14", action: "created", date: "2024-02-20", user: "Admin" },
    ],
    createdAt: "2024-02-20",
  },
  {
    id: "ast_007",
    name: "Pressure Washer",
    category: "Equipment",
    brand: "Kärcher",
    model: "K5 Premium",
    serialNumber: "KRC-K5P-00443",
    barcode: "400422010059",
    status: "retired",
    location: "Disposed",
    purchaseDate: "2020-04-01",
    purchasePrice: 349,
    warrantyExpiry: "2023-04-01",
    supplier: "Kärcher Store",
    notes: "Motor burned out. Disposed 2024-01-30.",
    tags: ["equipment", "cleaning"],
    photos: [],
    documents: [
      { id: "doc_012", name: "Purchase Invoice", type: "invoice", url: "#", uploadedAt: "2020-04-01" },
    ],
    history: [
      { id: "h15", action: "created", date: "2020-04-01", user: "Admin" },
      { id: "h16", action: "updated", date: "2024-01-30", user: "Admin", notes: "Marked as retired — motor failure" },
    ],
    createdAt: "2020-04-01",
  },
  {
    id: "ast_008",
    name: "Ergonomic Chair",
    category: "Furniture",
    brand: "Herman Miller",
    model: "Aeron Size B",
    serialNumber: "HM-AERON-B-2023-0018",
    barcode: "053693480186",
    status: "checked_out",
    location: "Office A",
    assignedTo: "Ana Rodríguez",
    purchaseDate: "2023-05-15",
    purchasePrice: 1395,
    warrantyExpiry: "2035-05-15",
    supplier: "Herman Miller",
    buyUrl: "https://hermanmiller.com",
    tags: ["furniture", "ergonomic"],
    photos: [
      "https://images.unsplash.com/photo-1580480055273-228ff5388ef8?w=800",
    ],
    documents: [
      { id: "doc_013", name: "Purchase Invoice", type: "invoice", url: "#", uploadedAt: "2023-05-15" },
      { id: "doc_014", name: "12-Year Warranty Certificate", type: "warranty", url: "#", uploadedAt: "2023-05-15" },
    ],
    history: [
      { id: "h17", action: "created", date: "2023-05-15", user: "Admin" },
      { id: "h18", action: "checked_out", date: "2023-05-16", user: "Admin", notes: "Assigned to Ana Rodríguez" },
    ],
    createdAt: "2023-05-15",
  },
];

export const ASSET_CATEGORIES: AssetCategory[] = ["Electronics", "Furniture", "Vehicles", "Equipment", "Tools", "Other"];

export const STATUS_CONFIG: Record<AssetStatus, { label: string; labelEs: string; color: string }> = {
  available:    { label: "Available",    labelEs: "Disponible",   color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" },
  checked_out:  { label: "Checked Out",  labelEs: "En uso",       color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
  maintenance:  { label: "Maintenance",  labelEs: "Mantenimiento",color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300" },
  retired:      { label: "Retired",      labelEs: "Retirado",     color: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400" },
};

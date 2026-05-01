import type { InvoiceStatus } from "@/services/invoices/invoices";

export const INVOICE_STATUS_CONFIG: Record<InvoiceStatus, { color: string; dot: string }> = {
  draft:     { color: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",         dot: "bg-zinc-400" },
  sent:      { color: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",       dot: "bg-blue-500" },
  viewed:    { color: "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300", dot: "bg-purple-500" },
  paid:      { color: "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300",   dot: "bg-green-500" },
  overdue:   { color: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",           dot: "bg-red-500" },
  cancelled: { color: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500",         dot: "bg-zinc-400" },
};

import { requireTool } from "@/services/tenants";

// Every page under /payroll requires the tool to be enabled for the tenant.
export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireTool("payroll");
  return children;
}

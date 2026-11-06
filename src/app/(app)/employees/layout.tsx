import { requireTool } from "@/services/tenants";

// Every page under /employees requires the tool to be enabled for the tenant.
export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireTool("employees");
  return children;
}

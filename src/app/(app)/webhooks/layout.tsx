import { requireTool } from "@/services/tenants";

// Every page under /webhooks requires the tool to be enabled for the tenant.
export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireTool("webhooks");
  return children;
}

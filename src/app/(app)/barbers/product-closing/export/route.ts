import * as XLSX from "xlsx";
import { getTranslations } from "next-intl/server";
import { getAvailableTools, getCurrentTenant } from "@/services/tenants";
import { getMyBarbersRole } from "@/services/barbers/roles";
import { can } from "@/lib/barbers/permissions";
import { getProductClosing } from "@/services/barbers/product-commissions";
import { fmtDay, isDateString } from "@/lib/barbers/dates";

export const dynamic = "force-dynamic";

const MONEY = "#,##0.00";

/** GET ?from&to → the product closing as .xlsx: summary per collaborator + every sale. */
export async function GET(request: Request) {
  const me = await getMyBarbersRole().catch(() => null);
  if (!me || !can(me.role, "view")) return new Response("Forbidden", { status: 403 });
  const tenant = await getCurrentTenant();
  if (!tenant) return new Response("Unauthorized", { status: 401 });
  if (!(await getAvailableTools(tenant)).includes("barbers")) return new Response("Forbidden", { status: 403 });

  const params = new URL(request.url).searchParams;
  const from = params.get("from");
  const to = params.get("to");
  if (!isDateString(from) || !isDateString(to) || to! < from!) return new Response("Invalid dates", { status: 400 });

  const [t, closing] = await Promise.all([getTranslations("barbers.productClosing"), getProductClosing(tenant.id, from!, to!)]);
  const { summary } = closing;
  const title = `${t("closingTitle")} · ${fmtDay(from!)} – ${fmtDay(to!)}`;

  const summaryAoa: (string | number)[][] = [
    [title],
    [],
    [t("sold"), summary.subtotal],
    [t("iva"), summary.ivaAmount],
    [t("charged"), summary.total],
    [t("commissions"), summary.commissions],
    [t("paid"), summary.commissionsPaid],
    [t("pending"), summary.commissionsPending],
    [],
    [t("collaborator"), t("salesCount"), t("commissions"), t("paid"), t("pending")],
    ...summary.byBarber.map((b) => [closing.barberNames[b.barberId] ?? "", b.sales, b.commissions, b.paid, b.pending]),
  ];
  const summaryWs = XLSX.utils.aoa_to_sheet(summaryAoa);

  const salesAoa: (string | number)[][] = [
    [t("date"), t("product"), t("quantity"), t("price"), t("iva"), t("charged"), t("commission"), t("collaborator"), t("status"), t("paidOn")],
    ...closing.sales.map((s) => [
      fmtDay(s.saleDate),
      s.productName,
      s.quantity,
      s.subtotal,
      s.ivaAmount,
      s.total,
      s.commissionTotal,
      s.barberName ?? "",
      s.commissionTotal === 0 ? "" : s.commissionPaidAt ? `${t("paid")}${s.paidAsCashOutflow ? ` · ${t("cashOutflow")}` : ""}` : t("pending"),
      s.commissionPaidAt ? fmtDay(s.commissionPaidAt) : "",
    ]),
  ];
  const salesWs = XLSX.utils.aoa_to_sheet(salesAoa);
  for (const [ws, cols] of [[summaryWs, [1, 2, 3, 4]], [salesWs, [3, 4, 5, 6]]] as const) {
    const range = XLSX.utils.decode_range(ws["!ref"]!);
    for (let r = 0; r <= range.e.r; r++) {
      for (const c of cols) {
        const cell = ws[XLSX.utils.encode_cell({ r, c })];
        if (cell && typeof cell.v === "number" && !(ws === summaryWs && c === 1 && r >= 10)) cell.z = MONEY;
      }
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, summaryWs, t("sheetSummary"));
  XLSX.utils.book_append_sheet(wb, salesWs, t("sheetSales"));
  const body = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const fileName = `${from}_a_${to}_${t("fileName")}.xlsx`;
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="product-closing-${from}-${to}.xlsx"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "no-store",
    },
  });
}

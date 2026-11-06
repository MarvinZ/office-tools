import * as XLSX from "xlsx";
import { getTranslations } from "next-intl/server";
import { getCurrentTenant } from "@/services/tenants";
import { adminGetEnabledTools } from "@/services/admin/tenants";
import { getSettlementDocuments } from "@/services/barbers/settlements";
import { fortnightKey, parseFortnightKey } from "@/lib/barbers/settlement";
import { buildSettlementWorkbook } from "@/lib/barbers/settlement-document";
import { businessDateOf, fmtDay } from "@/lib/barbers/dates";
import { fmtColones } from "@/lib/barbers/currency";

export const dynamic = "force-dynamic";

/**
 * GET ?period=YYYY-MM-H → the fortnight's settlements as .xlsx (summary,
 * bank transfers, one sheet per barber). Route handlers don't pass through
 * the (app) layouts, so tenant and tool access are checked here.
 */
export async function GET(request: Request) {
  const tenant = await getCurrentTenant();
  if (!tenant) return new Response("Unauthorized", { status: 401 });
  if (!(await adminGetEnabledTools(tenant.id)).includes("barbers")) {
    return new Response("Forbidden", { status: 403 });
  }

  const fortnight = parseFortnightKey(new URL(request.url).searchParams.get("period"));
  if (!fortnight) return new Response("Invalid period", { status: 400 });

  const [t, { effective, closing, documents }] = await Promise.all([
    getTranslations("barbers"),
    getSettlementDocuments(tenant.id, fortnight),
  ]);

  const title = `${t("settlements.title")} · ${t(fortnight.half === 1 ? "settlements.firstHalf" : "settlements.secondHalf")} · ${fmtDay(fortnight.from)} – ${fmtDay(fortnight.to)}`;
  const status = closing
    ? t("settlements.closedOn", { date: fmtDay(businessDateOf(closing.closedAt)) })
    : t("settlements.preliminary");

  const workbook = buildSettlementWorkbook(documents, effective.totals, {
    summarySheet: t("settlementDoc.summarySheet"),
    transfersSheet: t("settlementDoc.transfersSheet"),
    title,
    status,
    summaryHeaders: [
      t("settlements.colBarber"), t("settlements.colServices"), t("settlements.colDays"),
      t("settlements.colIncome"), t("settlements.colAddition"), t("settlements.colCardFee"),
      t("settlements.colMaintenance"), t("settlements.colProductCredit"), t("settlements.colVales"),
      t("settlements.colNet"), t("settlements.colIva"), t("settlements.colInvoice"),
      t("settlements.colTips"), t("settlements.colTransfer"),
    ],
    total: t("settlements.total"),
    transferHeaders: [
      t("settlements.colBarber"), t("paymentDetails.idNumber"), t("paymentDetails.iban"), t("settlementDoc.amount"),
    ],
    servicesLabel: t("settlements.colServices"),
    daysLabel: t("settlementDoc.daysWorked"),
    idNumberLabel: t("paymentDetails.idNumber"),
    ibanLabel: t("paymentDetails.iban"),
    line: (key) => t(`settlementDoc.line.${key}`),
    shortfall: (amount) => t("settlements.shortfall", { amount: fmtColones(amount) }),
  });

  const body = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const fileName = `${t("settlementDoc.fileName")} ${fortnightKey(fortnight)}.xlsx`;
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="settlements-${fortnightKey(fortnight)}.xlsx"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "no-store",
    },
  });
}

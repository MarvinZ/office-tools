import { NextResponse } from "next/server";
import { requireCardsApiContext, resolveTargetCollector } from "@/lib/cards/api-auth";
import { ApiError, withCardsApi } from "@/lib/cards/errors";
import { publicItem } from "@/lib/cards/serialize";
import { patchItemSchema } from "@/lib/cards/validation";
import { deleteItem, getItem, updateItem } from "@/services/cards/items";
import { recordAuditLog } from "@/services/audit";

type Params = { collectorId: string; itemId: string };

export const PATCH = withCardsApi<Params>(async (req, { params }) => {
  const { collectorId, itemId } = await params;
  const ctx = await requireCardsApiContext(req);
  const owner = await resolveTargetCollector(ctx, collectorId, "write");
  const patch = patchItemSchema.parse(await req.json());

  const result = await updateItem(ctx.tenant.id, owner.id, itemId, patch);
  if (!result) throw new ApiError(404, "not_found", "Item not found.");

  await recordAuditLog(ctx.tenant.id, ctx.userId, "cards.item.updated", {
    collectorId: owner.id,
    itemId,
    tcgdexId: result.item.card.tcgdexId,
    quantity: result.item.quantity,
    changes: patch,
    ...(result.mergedIntoId ? { mergedIntoId: result.mergedIntoId } : {}),
  });
  return NextResponse.json(publicItem(result.item));
});

export const DELETE = withCardsApi<Params>(async (req, { params }) => {
  const { collectorId, itemId } = await params;
  const ctx = await requireCardsApiContext(req);
  const owner = await resolveTargetCollector(ctx, collectorId, "write");

  const item = await getItem(ctx.tenant.id, owner.id, itemId);
  if (!item || !(await deleteItem(ctx.tenant.id, owner.id, itemId))) {
    throw new ApiError(404, "not_found", "Item not found.");
  }

  await recordAuditLog(ctx.tenant.id, ctx.userId, "cards.item.removed", {
    collectorId: owner.id,
    itemId,
    tcgdexId: item.card.tcgdexId,
    quantity: item.quantity,
  });
  return new NextResponse(null, { status: 204 });
});

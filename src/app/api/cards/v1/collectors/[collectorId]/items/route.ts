import { NextResponse } from "next/server";
import { requireCardsApiContext, resolveTargetCollector } from "@/lib/cards/api-auth";
import { withCardsApi } from "@/lib/cards/errors";
import { publicItem } from "@/lib/cards/serialize";
import { addItemSchema, listItemsQuerySchema } from "@/lib/cards/validation";
import { addItem, listItems } from "@/services/cards/items";
import { recordAuditLog } from "@/services/audit";

type Params = { collectorId: string };

export const GET = withCardsApi<Params>(async (req, { params }) => {
  const ctx = await requireCardsApiContext(req);
  const owner = await resolveTargetCollector(ctx, (await params).collectorId, "read");
  const query = listItemsQuerySchema.parse(Object.fromEntries(new URL(req.url).searchParams));

  const { items, nextCursor } = await listItems(ctx.tenant.id, owner.id, query);
  return NextResponse.json({ items: items.map(publicItem), nextCursor });
});

export const POST = withCardsApi<Params>(async (req, { params }) => {
  const ctx = await requireCardsApiContext(req);
  const owner = await resolveTargetCollector(ctx, (await params).collectorId, "write");
  const input = addItemSchema.parse(await req.json());

  const { item, created } = await addItem(ctx.tenant.id, owner.id, ctx.userId, input);
  await recordAuditLog(ctx.tenant.id, ctx.userId, "cards.item.added", {
    collectorId: owner.id,
    itemId: item.id,
    tcgdexId: item.card.tcgdexId,
    quantity: input.quantity,
  });
  return NextResponse.json(publicItem(item), { status: created ? 201 : 200 });
});

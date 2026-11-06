import { NextResponse } from "next/server";
import { requireCardsApiContext, type CardsApiContext } from "@/lib/cards/api-auth";
import { withCardsApi } from "@/lib/cards/errors";
import { canReadCollection } from "@/lib/cards/permissions";
import { patchMeSchema } from "@/lib/cards/validation";
import { getCollectorTotals, listCollectors, updateCollector, type CollectorRow } from "@/services/cards/collectors";

async function meResponse(ctx: CardsApiContext, collector: CollectorRow) {
  const [members, totals] = await Promise.all([listCollectors(ctx.tenant.id), getCollectorTotals(ctx.tenant.id)]);
  const viewer = { collectorId: collector.id, isParent: ctx.isParent };

  return {
    collector: {
      id: collector.id,
      displayName: collector.displayName,
      isPrivate: collector.isPrivate,
      canManageOthers: ctx.isParent,
    },
    family: { id: ctx.tenant.id, name: ctx.tenant.name },
    // Members appear once they've used the app at least once.
    members: members.map((m) => {
      const visible = canReadCollection(viewer, m);
      const t = totals.get(m.id);
      return {
        id: m.id,
        displayName: m.displayName,
        isPrivate: m.isPrivate,
        cardCount: visible ? (t?.cardCount ?? 0) : null,
        totalValue: visible ? (t?.totalValue ?? {}) : null,
      };
    }),
  };
}

export const GET = withCardsApi(async (req) => {
  const ctx = await requireCardsApiContext(req);
  return NextResponse.json(await meResponse(ctx, ctx.collector));
});

export const PATCH = withCardsApi(async (req) => {
  const ctx = await requireCardsApiContext(req);
  const input = patchMeSchema.parse(await req.json());
  const updated = await updateCollector(ctx.tenant.id, ctx.collector.id, input);
  return NextResponse.json(await meResponse({ ...ctx, collector: updated }, updated));
});

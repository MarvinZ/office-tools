// When a PATCH changes an item's variant/condition into one the collector already owns,
// the two rows become one (spec §6). This decides the merged row's fields.

export type MergeableItem = {
  quantity: number;
  isFavorite: boolean;
  notes: string | null;
  acquiredAt: string | null; // YYYY-MM-DD
};

export type ItemPatch = Partial<MergeableItem>;

/**
 * `source` is the row being edited (it disappears), `target` the existing row it collides with.
 * Explicit patch values win; otherwise nothing the collector entered is lost.
 */
export function mergeItems(source: MergeableItem, target: MergeableItem, patch: ItemPatch): MergeableItem {
  return {
    quantity: target.quantity + (patch.quantity ?? source.quantity),
    isFavorite: patch.isFavorite ?? (source.isFavorite || target.isFavorite),
    notes: patch.notes !== undefined ? patch.notes : mergeNotes(target.notes, source.notes),
    acquiredAt: patch.acquiredAt !== undefined ? patch.acquiredAt : earliest(target.acquiredAt, source.acquiredAt),
  };
}

function mergeNotes(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b || a === b) return a;
  return `${a}\n${b}`;
}

function earliest(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a < b ? a : b;
}

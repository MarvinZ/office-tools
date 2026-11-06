import { z } from "zod";
import { AMOUNT_PATTERN } from "./money";

// The API is the trust boundary for a native client, so unlike the server-action modules
// (see MODULE_BLUEPRINT §0) every request body / query is validated here.

export const CARD_LANGUAGES = ["en", "ja"] as const;
export const CARD_CONDITIONS = ["NM", "LP", "MP", "HP", "DMG"] as const;
export const ITEM_SORTS = ["added", "name", "value", "set"] as const;

const variant = z.string().min(1).max(50).regex(/^[a-z0-9-]+$/, "must be a lowercase printing key");
const httpUrl = z.url({ protocol: /^https?$/ }).max(1000);
const isoDate = z.iso.date();
/** The app sends a date or a full timestamp; only the day is stored. */
const dateOrDateTime = z.union([isoDate, z.iso.datetime({ offset: true })]).transform((s) => s.slice(0, 10));

export const cardSnapshotSchema = z.object({
  tcgdexId: z.string().min(1).max(64),
  language: z.enum(CARD_LANGUAGES),
  name: z.string().min(1).max(200),
  setId: z.string().min(1).max(64),
  setName: z.string().min(1).max(200),
  localId: z.string().min(1).max(32),
  setOfficialCount: z.number().int().nonnegative().nullish(),
  rarity: z.string().max(100).nullish(),
  imageUrl: httpUrl.nullish(),
  marketImageUrl: httpUrl.nullish(),
  tcgplayerGroupId: z.number().int().positive().nullish(),
  tcgplayerProductId: z.number().int().positive().nullish(),
});
export type CardSnapshot = z.infer<typeof cardSnapshotSchema>;

export const clientPriceSchema = z.object({
  variant: variant.nullish(),
  amount: z.string().regex(AMOUNT_PATTERN, "must be a decimal string like \"12.34\""),
  currency: z.string().regex(/^[A-Z]{3}$/, "must be an ISO 4217 code"),
  source: z.string().min(1).max(50),
  updatedAt: dateOrDateTime.nullish(),
});
export type ClientPrice = z.infer<typeof clientPriceSchema>;

export const addItemSchema = z.object({
  card: cardSnapshotSchema,
  variant,
  condition: z.enum(CARD_CONDITIONS).default("NM"),
  quantity: z.number().int().min(1).max(9999).default(1),
  prices: z.array(clientPriceSchema).max(20).default([]),
});
export type AddItemInput = z.infer<typeof addItemSchema>;

export const patchItemSchema = z
  .object({
    quantity: z.number().int().min(1).max(9999),
    condition: z.enum(CARD_CONDITIONS),
    variant,
    isFavorite: z.boolean(),
    notes: z.string().max(2000).nullable(),
    acquiredAt: isoDate.nullable(),
  })
  .partial()
  .strict()
  .refine((p) => Object.keys(p).length > 0, "at least one field is required");
export type PatchItemInput = z.infer<typeof patchItemSchema>;

export const patchMeSchema = z
  .object({
    displayName: z.string().trim().min(1).max(50),
    isPrivate: z.boolean(),
  })
  .partial()
  .strict()
  .refine((p) => Object.keys(p).length > 0, "at least one field is required");
export type PatchMeInput = z.infer<typeof patchMeSchema>;

export const listItemsQuerySchema = z.object({
  q: z.string().trim().min(1).max(100).optional(),
  language: z.enum(CARD_LANGUAGES).optional(),
  setId: z.string().min(1).max(64).optional(),
  favorite: z.enum(["true", "false"]).transform((v) => v === "true").optional(),
  sort: z.enum(ITEM_SORTS).default("added"),
  cursor: z.string().regex(/^\d+$/, "invalid cursor").transform(Number).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export type ListItemsQuery = z.infer<typeof listItemsQuerySchema>;

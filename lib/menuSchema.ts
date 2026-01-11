import { z } from "zod";

// Soft normalization functions
export function clampName(s: string) {
  return s.length <= 80 ? s : s.slice(0, 77) + "...";
}

export function parsePriceAny(p: unknown) {
  if (typeof p === "number") return p;
  const m = String(p || "")
    .replace(",", ".")
    .match(/(\d+(\.\d{1,2})?)/);
  return m ? Number(m[1]) : NaN;
}

export const MenuItem = z.object({

    .union([z.number(), z.string()])
    .transform(parsePriceAny)
    .refine((v) => !isNaN(v), "price required"),

  // Note: order_index column doesn't exist in database, removed from schema

export const MenuPayload = z.object({

export type MenuPayloadT = z.infer<typeof MenuPayload>;

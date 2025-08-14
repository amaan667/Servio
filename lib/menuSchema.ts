import { z } from "zod";

export const MenuItem = z.object({
  name: z.string().max(80),
  description: z.string().nullable().optional(),
  price: z.number().nonnegative(),
  category: z.string().min(1),
  available: z.boolean().default(true),
  order_index: z.number().int().nonnegative().optional(), // fill later
});

export const MenuPayload = z.object({
  items: z.array(MenuItem),
  categories: z.array(z.string()),
});

export type MenuPayloadT = z.infer<typeof MenuPayload>;

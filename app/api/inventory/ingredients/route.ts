import { createUnifiedHandler } from "@/lib/api/unified-handler";
import { inventoryService } from "@/lib/services/InventoryService";
import { z } from "zod";

export const runtime = "nodejs";

const createIngredientSchema = z.object({
  name: z.string().min(1).max(100),
  sku: z.string().max(50).optional().nullable(),
  unit: z.string().min(1).max(20),
  cost_per_unit: z.number().nonnegative().optional(),
  par_level: z.number().nonnegative().optional(),
  reorder_level: z.number().nonnegative().optional(),
  supplier: z.string().max(100).optional().nullable(),
  initial_stock: z.number().nonnegative().optional(),
});

/**
 * GET: Fetch all ingredients for a venue
 */
export const GET = createUnifiedHandler(
  async (_req, context) => {
    const ingredients = await inventoryService.getInventory(context.venueId);
    return ingredients;
  },
  {
    requireVenueAccess: true,
    venueIdSource: "query",
  }
);

/**
 * POST: Create a new inventory ingredient
 */
export const POST = createUnifiedHandler(
  async (_req, context) => {
    const { body, venueId } = context;
    const ingredient = await inventoryService.createIngredient(venueId, body);
    return ingredient;
  },
  {
    requireVenueAccess: true,
    schema: createIngredientSchema,
    requireRole: ["owner", "manager"],
  }
);

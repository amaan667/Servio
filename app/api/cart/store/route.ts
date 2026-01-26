import { NextRequest } from "next/server";

import { createUnifiedHandler } from "@/lib/api/unified-handler";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { validateQuery } from "@/lib/api/validation-schemas";
import { success, apiErrors } from "@/lib/api/standard-response";
import { z } from "zod";

// Validation schemas
const cartItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200),
  price: z.number().nonnegative(),
  quantity: z.number().int().positive(),
  specialInstructions: z.string().max(500).optional(),
  image: z.string().url().optional(),
});

const storeCartRequestSchema = z.object({
  cartId: z.string().uuid(),
  venueId: z.string().uuid(),
  tableNumber: z.number().int().positive().optional(),
  customerName: z.string().min(1).max(100),
  customerPhone: z.string().regex(/^\+?[1-9]\d{1,14}$/),
  items: z.array(cartItemSchema).min(1, "At least one item required"),
  total: z.number().nonnegative(),
  notes: z.string().max(1000).optional(),
});

const getCartQuerySchema = z.object({
  cartId: z.string().uuid(),
});

export const POST = createUnifiedHandler(
  async (_req: NextRequest, context) => {
    const { body, venueId } = context;

      // Verify venue_id matches context
      if (body.venueId !== venueId) {
        return apiErrors.forbidden("Venue ID mismatch");
      }

    // Business logic - Store cart data
    const cartData = {
      id: body.cartId,
      venue_id: venueId,
      table_number: body.tableNumber || null,
      customer_name: body.customerName,
      customer_phone: body.customerPhone,
      items: body.items.map((item) => ({
        menu_item_id: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        specialInstructions: item.specialInstructions || null,
        image: item.image || null,
      })),
      total_amount: body.total,
      notes: body.notes || null,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutes
    };

    return success({ cartData });
  },
  {
    schema: storeCartRequestSchema,
    requireVenueAccess: true,
    rateLimit: RATE_LIMITS.GENERAL,
    extractVenueId: async (req) => {
      try {
        const body = await req.clone().json().catch(() => ({}));
        return (
          (body as { venueId?: string; venue_id?: string })?.venueId ||
          (body as { venueId?: string; venue_id?: string })?.venue_id ||
          null
        );
      } catch {
        return null;
      }
    },
  }
);

export const GET = createUnifiedHandler(
  async (req: NextRequest) => {
    // Validate query parameters
    const { searchParams } = new URL(req.url);
    const query = validateQuery(getCartQuerySchema, {
      cartId: searchParams.get("cartId"),
    });

    // Business logic - Retrieve cart
    // In a real implementation, you'd retrieve from database
    // For now, return null to indicate cart not found

    return success({ cartData: null });
  },
  {
    requireAuth: false, // Cart retrieval can be public
    requireVenueAccess: false,
    rateLimit: RATE_LIMITS.GENERAL,
  }
);

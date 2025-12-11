import { NextRequest } from "next/server";
import { logger } from "@/lib/logger";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { validateBody, validateQuery } from "@/lib/api/validation-schemas";
import { success, apiErrors, isZodError, handleZodError } from "@/lib/api/standard-response";
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

export const POST = withUnifiedAuth(
  async (req: NextRequest, context) => {
    try {
      // STEP 1: Rate limiting (ALWAYS FIRST)
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        return apiErrors.rateLimit(Math.ceil((rateLimitResult.reset - Date.now()) / 1000));
      }

      // STEP 2: Get venueId from context (already verified)
      const venueId = context.venueId;

      // STEP 3: Validate input
      const body = await validateBody(storeCartRequestSchema, await req.json());

      // Verify venue_id matches context
      if (body.venueId !== venueId) {
        return apiErrors.forbidden("Venue ID mismatch");
      }

      // STEP 4: Business logic - Store cart data
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

      logger.info("[CART STORE] Cart stored successfully", {
        cartId: body.cartId,
        venueId,
        userId: context.user.id,
        itemCount: body.items.length,
      });

      // STEP 5: Return success response
      return success({ cartData });
    } catch (error) {
      logger.error("[CART STORE] Unexpected error", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        venueId: context.venueId,
        userId: context.user.id,
      });

      // Handle validation errors
      if (isZodError(error)) {
        return handleZodError(error);
      }

      return apiErrors.internal("Failed to store cart", error);
    }
  },
  {
    // Extract venueId from body
    extractVenueId: async (req) => {
      try {
        const body = await req.json().catch(() => ({}));
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

export const GET = withUnifiedAuth(
  async (req: NextRequest, context) => {
    try {
      // STEP 1: Rate limiting (ALWAYS FIRST)
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        return apiErrors.rateLimit(Math.ceil((rateLimitResult.reset - Date.now()) / 1000));
      }

      // STEP 2: Validate query parameters
      const { searchParams } = new URL(req.url);
      const query = validateQuery(getCartQuerySchema, {
        cartId: searchParams.get("cartId"),
      });

      // STEP 3: Business logic - Retrieve cart
      // In a real implementation, you'd retrieve from database
      // For now, return null to indicate cart not found

      logger.debug("[CART STORE] Cart retrieval requested", {
        cartId: query.cartId,
        userId: context.user.id,
      });

      // STEP 4: Return success response
      return success({ cartData: null });
    } catch (error) {
      logger.error("[CART STORE GET] Unexpected error", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        userId: context.user.id,
      });

      // Handle validation errors
      if (isZodError(error)) {
        return handleZodError(error);
      }

      return apiErrors.internal("Failed to retrieve cart", error);
    }
  },
  {
    // System route - no venue required for cart retrieval
    extractVenueId: async () => null,
  }
);

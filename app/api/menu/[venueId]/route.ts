import { createUnifiedHandler } from "@/lib/api/unified-handler";
import { menuService } from "@/lib/services/MenuService";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { paginationSchema } from "@/lib/api/validation-schemas";
import { z } from "zod";
import { apiErrors } from "@/lib/api/standard-response";

const menuPaginationSchema = paginationSchema.extend({
  limit: z.coerce.number().int().min(1).max(500).default(200),
});

/**
 * GET: Fetch public menu for a venue
 * Public endpoint - no authentication required
 * Works in private browsers and mobile devices
 */
export const GET = createUnifiedHandler(
  async (req, context) => {
    const { params } = context;
    const { searchParams } = req.nextUrl;

    const rawVenueId = params.venueId;
    if (!rawVenueId) {
      return apiErrors.badRequest("Venue ID is required");
    }

    // Handle venue ID format - ensure it has 'venue-' prefix for database lookup
    const venueId = rawVenueId.startsWith("venue-") ? rawVenueId : `venue-${rawVenueId}`;

    const { limit, offset } = menuPaginationSchema.parse({
      limit: searchParams.get("limit") || undefined,
      offset: searchParams.get("offset") || undefined,
    });

    // Add timeout wrapper to prevent hanging requests
    const menuDataPromise = menuService.getPublicMenuFull(venueId, { limit, offset });
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Menu loading timeout")), 10000); // 10 second timeout
    });

    try {
      const menuData = await Promise.race([menuDataPromise, timeoutPromise]);
      return menuData;
    } catch (error) {
      // Enhanced error handling for private browsers and mobile
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      
      // Return user-friendly error with retry suggestion
      return apiErrors.internal(
        "Failed to load menu. Please try again.",
        process.env.NODE_ENV === "development" ? { message: errorMessage } : undefined
      );
    }
  },
  {
    requireAuth: false, // Public endpoint - no auth required
    rateLimit: RATE_LIMITS.MENU_PUBLIC,
    venueIdSource: "params",
  }
);

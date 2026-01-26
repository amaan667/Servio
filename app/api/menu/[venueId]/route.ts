import { createUnifiedHandler } from "@/lib/api/unified-handler";
import { menuService } from "@/lib/services/MenuService";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { paginationSchema } from "@/lib/api/validation-schemas";
import { z } from "zod";
import { apiErrors, success } from "@/lib/api/standard-response";

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
    // 8 second timeout - balances mobile network needs with UX
    const menuDataPromise = menuService.getPublicMenuFull(venueId, { limit, offset });
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Menu loading timeout - please refresh")), 8000);
    });

    try {
      const menuData = await Promise.race([menuDataPromise, timeoutPromise]);

      // Return with edge caching headers for CDN optimization
      // Cache for 60 seconds on client, 120 seconds on CDN, allow stale for 300 seconds while revalidating
      return success(menuData, undefined, undefined, {
        maxAge: 60,
        sMaxAge: 120,
        staleWhileRevalidate: 300,
      });
    } catch (error) {
      // Enhanced error handling for private browsers and mobile
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      
      // Log the actual error for debugging (will be captured by unified handler)
      // Return user-friendly error with retry suggestion
      // Include error details in development, but keep message generic in production
      return apiErrors.internal(
        "Failed to load menu. Please try again.",
        {
          message: errorMessage,
          type: error instanceof Error ? error.name : "Unknown",
          // Include timeout info if it's a timeout error
          ...(errorMessage.includes("timeout") && { suggestion: "This may be due to a slow connection. The request will be retried automatically." }),
        }
      );
    }
  },
  {
    requireAuth: false, // Public endpoint - no auth required
    rateLimit: RATE_LIMITS.MENU_PUBLIC,
    venueIdSource: "params",
  }
);

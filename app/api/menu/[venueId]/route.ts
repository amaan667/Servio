import { createApiHandler } from "@/lib/api/production-handler";
import { menuService } from "@/lib/services/MenuService";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { paginationSchema } from "@/lib/api/validation-schemas";
import { z } from "zod";

const menuPaginationSchema = paginationSchema.extend({
  limit: z.coerce.number().int().min(1).max(500).default(200),
});

/**
 * GET: Fetch public menu for a venue
 */
export const GET = createApiHandler(
  async (req, context) => {
    const { params } = context;
    const { searchParams } = req.nextUrl;

    const rawVenueId = params.venueId;
    // Handle venue ID format - ensure it has 'venue-' prefix for database lookup
    const venueId = rawVenueId.startsWith("venue-") ? rawVenueId : `venue-${rawVenueId}`;

    const { limit, offset } = menuPaginationSchema.parse({
      limit: searchParams.get("limit") || undefined,
      offset: searchParams.get("offset") || undefined,
    });

    const menuData = await menuService.getPublicMenuFull(venueId, { limit, offset });

    return menuData;
  },
  {
    requireAuth: false, // Public endpoint
    rateLimit: RATE_LIMITS.MENU_PUBLIC,
  }
);

import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { cache, cacheKeys } from "@/lib/cache/index";
import { logger } from "@/lib/logger";
import { success, apiErrors } from '@/lib/api/standard-response';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ venueId: string }> }
) {
  let rawVenueId = "unknown";

  try {
    const params = await context.params;
    rawVenueId = params.venueId;

    if (!rawVenueId) {
      return apiErrors.badRequest('Venue ID is required');
    }

    // Handle venue ID format - ensure it has 'venue-' prefix for database lookup
    const venueId = rawVenueId.startsWith("venue-") ? rawVenueId : `venue-${rawVenueId}`;

    logger.debug("[MENU API] Looking up venue:", {
      data: { rawVenueId, transformedVenueId: venueId },
    });

    // Try to get from cache first
    const cacheKey = cacheKeys.menuItems(venueId);
    const cachedMenu = await cache.get(cacheKey);

    if (cachedMenu) {
      return success(cachedMenu);
    }

    // Use admin client to bypass RLS for public menu access
    const supabase = createAdminClient();

    // First check if venue exists with transformed ID
    let { data: venue, error: venueError } = await supabase
      .from("venues")
      .select("venue_id, venue_name")
      .eq("venue_id", venueId)
      .single();

    // If not found with transformed ID, try with original ID as fallback
    if (venueError || !venue) {
      logger.debug("[MENU API] Trying fallback venue lookup with original ID:", {
        value: rawVenueId,
      });
      const { data: fallbackVenue, error: fallbackError } = await supabase
        .from("venues")
        .select("venue_id, venue_name")
        .eq("venue_id", rawVenueId)
        .single();

      if (!fallbackError && fallbackVenue) {
        venue = fallbackVenue;
        venueError = fallbackError;
      }
    }

    if (venueError || !venue) {
      logger.error("[MENU API] Venue not found", {
        rawVenueId,
        transformedVenueId: venueId,
        error: venueError,
      });
      return apiErrors.notFound("Venue not found");
    }

    // Fetch menu items for the venue using the same venue_id that was found
    // Use created_at ordering as fallback since order_index column may not exist
    const { data: menuItems, error: menuError } = await supabase
      .from("menu_items")
      .select("*")
      .eq("venue_id", venue.venue_id)
      .eq("is_available", true)
      .order("created_at", { ascending: true });

    const menuItemCount = menuItems?.length || 0;

    logger.debug("[MENU API] Menu items query", {
      rawVenueId,
      transformedVenueId: venueId,
      actualVenueId: venue.venue_id,
      count: menuItemCount,
      error: menuError?.message || null,
      errorCode: menuError?.code || null,
    });

    if (menuError) {
      logger.error("[MENU API] Error fetching menu items", {
        error: menuError.message,
        code: menuError.code,
        details: menuError.details,
        venueId: venue.venue_id,
      });
      return apiErrors.database('Failed to load menu items');
    }

    // Return menu items with venue info
    const response = {
      venue: {
        id: venue.venue_id,
        name: venue.venue_name,
      },
      menuItems: menuItems || [],
      totalItems: menuItemCount,
    };

    logger.debug("[MENU API] Returning response", {
      venueId: venue.venue_id,
      totalItems: menuItemCount,
      hasItems: menuItemCount > 0,
    });

    // Cache the response for 5 minutes (300 seconds)
    await cache.set(cacheKey, response, { ttl: 300 });

    return success(response);
  } catch (_error) {
    const errorMessage = _error instanceof Error ? _error.message : "Unknown error";
    const errorStack = _error instanceof Error ? _error.stack : undefined;
    logger.error("[MENU API] Unexpected error", {
      error: errorMessage,
      stack: errorStack,
      venueId: rawVenueId,
    });

    return apiErrors.internal(errorMessage);
  }
}

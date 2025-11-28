import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { cache, cacheKeys, cacheTTL } from "@/lib/cache/index";
import { logger } from "@/lib/logger";
import { apiErrors } from '@/lib/api/standard-response';

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
      return NextResponse.json(cachedMenu);
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
      logger.error("[MENU API] Venue not found:", {
        error: { rawVenueId, transformedVenueId: venueId, error: venueError },
      });
      return NextResponse.json(
        { error: "Venue not found", venueId: rawVenueId, searchedAs: venueId },
        { status: 404 }
      );
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

    console.log("[CUSTOMER UI API] Menu items query:", {
      rawVenueId,
      transformedVenueId: venueId,
      actualVenueId: venue.venue_id,
      count: menuItemCount,
      error: menuError?.message || null,
      errorCode: menuError?.code || null,
      sampleItems: menuItems?.slice(0, 3).map((m) => ({ id: m.id, name: m.name })) || [],
      timestamp: new Date().toISOString(),
    });

    if (menuError) {
      console.error("[CUSTOMER UI API] Error fetching menu items:", {
        error: menuError.message,
        code: menuError.code,
        details: menuError.details,
        venueId: venue.venue_id,
      });
      logger.error("[MENU API] Error fetching menu items:", { value: menuError });
      return apiErrors.internal('Failed to load menu items');
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

    console.log("[CUSTOMER UI API] Returning response:", {
      venueId: venue.venue_id,
      totalItems: menuItemCount,
      hasItems: menuItemCount > 0,
    });

    // Log summary for comparison
    console.log("[CUSTOMER UI API] SUMMARY:", {
      rawVenueId,
      transformedVenueId: venueId,
      actualVenueId: venue.venue_id,
      totalMenuItems: menuItemCount,
      timestamp: new Date().toISOString(),
    });

    // Cache the response for 5 minutes
    await cache.set(cacheKey, response, { ttl: cacheTTL.medium });

    return NextResponse.json(response);
  } catch (_error) {
    logger.error("[MENU API] Unexpected error:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
      stack: _error instanceof Error ? _error.stack : undefined,
      venueId: rawVenueId,
    });

    return NextResponse.json(
      {
        error: "Internal server _error",
        details: _error instanceof Error ? _error.message : "Unknown _error",
      },
      { status: 500 }
    );
  }
}

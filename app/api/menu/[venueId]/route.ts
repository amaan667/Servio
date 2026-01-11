import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { cache, cacheKeys } from "@/lib/cache/index";
import { success, apiErrors } from "@/lib/api/standard-response";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { paginationSchema, validateQuery } from "@/lib/api/validation-schemas";
import { z } from "zod";

export async function GET(

  context: { params: Promise<{ venueId: string }> }
) {
  let rawVenueId = "unknown";

  const menuPaginationSchema = paginationSchema.extend({

  try {
    // PUBLIC ENDPOINT: enforce strict rate limiting to protect venue menus from scraping
    const rateLimitResult = await rateLimit(_request, RATE_LIMITS.STRICT);
    if (!rateLimitResult.success) {
      return apiErrors.rateLimit(Math.ceil((rateLimitResult.reset - Date.now()) / 1000));
    }

    const { searchParams } = new URL(_request.url);
    // IMPORTANT: URLSearchParams.get() returns null when missing.
    // Passing null into z.coerce.number() becomes 0, which fails min(1).
    const normalizeParam = (value: string | null) =>
      value === null || value === "" ? undefined : value;
    const { limit, offset } = validateQuery(menuPaginationSchema, {

    const params = await context.params;
    rawVenueId = params.venueId;

    if (!rawVenueId) {
      return apiErrors.badRequest("Venue ID is required");
    }

    // Handle venue ID format - ensure it has 'venue-' prefix for database lookup
    const venueId = rawVenueId.startsWith("venue-") ? rawVenueId : `venue-${rawVenueId}`;

    

    // Try to get from cache first
    const cacheKey = cacheKeys.menuItems(`${venueId}:l${limit}:o${offset}`);
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
      
      return apiErrors.notFound("Venue not found");
    }

    // Fetch menu items for the venue using the same venue_id that was found
    // Use created_at ordering as fallback since order_index column may not exist
    const {

    } = await supabase
      .from("menu_items")
      .select("*", { count: "exact" })
      .eq("venue_id", venue.venue_id)
      .eq("is_available", true)
      .order("created_at", { ascending: true })
      .range(offset, offset + limit - 1);

    const totalItems = typeof menuCount === "number" ? menuCount : menuItems?.length || 0;

    

    if (menuError) {
      
      return apiErrors.database("Failed to load menu items");
    }

    // Fetch latest uploaded PDF images + category order (public customer display)
    const { data: uploadData } = await supabase
      .from("menu_uploads")
      .select("pdf_images, pdf_images_cc, category_order, created_at")
      .eq("venue_id", venue.venue_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const pdfImages: string[] = (uploadData?.pdf_images ||
      uploadData?.pdf_images_cc ||
      []) as string[];

    const categoryOrder: string[] | null = Array.isArray(uploadData?.category_order)
      ? (uploadData?.category_order as string[])

      },

      totalItems,
      pdfImages,
      categoryOrder,

        offset,

      },
    };

    

    // Cache the response for 5 minutes (300 seconds)
    await cache.set(cacheKey, response, { ttl: 300 });

    return success(response);
  } catch (_error) {
    const errorMessage = _error instanceof Error ? _error.message : "Unknown error";
    const errorStack = _error instanceof Error ? _error.stack : undefined;
    

    return apiErrors.internal(errorMessage);
  }
}

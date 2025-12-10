import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { success, apiErrors, isZodError, handleZodError } from "@/lib/api/standard-response";

type CategoryOrderRouteContext = {
  params?: {
    venueId?: string;
  };
};

export async function GET(_req: NextRequest, context?: CategoryOrderRouteContext) {
  try {
    const venueId = context?.params?.venueId;

    if (!venueId) {
      return apiErrors.badRequest('Venue ID is required');
    }

    const supabase = await createClient();

    // Fetch the most recent menu upload to get category order
    const { data: uploadData, error } = await supabase
      .from("menu_uploads")
      .select("parsed_json")
      .eq("venue_id", venueId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      logger.error("[CATEGORY ORDER API] Error fetching upload data:", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return apiErrors.internal('Failed to fetch category order');
    }

    // Extract categories from the parsed_json
    let categories = null;
    if (uploadData?.parsed_json && uploadData.parsed_json.categories) {
      // Categories are stored as an array of strings in the correct PDF order
      categories = uploadData.parsed_json.categories;
    } else {
      // Intentionally empty
    }

    return NextResponse.json({
      categories: categories || null,
    });
  } catch (_error) {
    logger.error("[CATEGORY ORDER API] Unexpected error:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });
    return apiErrors.internal('Internal server error');
  }
}

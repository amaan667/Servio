import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { cache, cacheKeys, cacheTTL } from "@/lib/cache";
import { logger } from "@/lib/logger";
import { apiErrors } from '@/lib/api/standard-response';

export async function GET(_request: NextRequest) {
  try {
    const { searchParams } = new URL(_request.url);
    const venueId = searchParams.get("venueId");

    if (!venueId) {
      return apiErrors.badRequest('venueId is required');
    }

    // Try to get from cache first
    const cacheKey = `menu:categories:${venueId}`;
    const cachedCategories = await cache.get(cacheKey);

    if (cachedCategories) {
      return NextResponse.json(cachedCategories);
    }

    const supabase = await createClient();

    // Get the most recent menu upload to get category order
    const { data: uploadData, error: uploadError } = await supabase
      .from("menu_uploads")
      .select("category_order, created_at, id")
      .eq("venue_id", venueId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (uploadError) {
      logger.error("[CATEGORIES API] Error fetching category order:", { value: uploadError });
      return apiErrors.internal('Failed to fetch category order');
    }

    // Get all unique categories from menu items
    const { data: menuItems, error: menuError } = await supabase
      .from("menu_items")
      .select("category")
      .eq("venue_id", venueId);

    if (menuError) {
      logger.error("[CATEGORIES API] Error fetching menu items:", { value: menuError });
      return apiErrors.internal('Failed to fetch menu items');
    }

    // Extract unique categories
    const uniqueCategories = Array.from(
      new Set(menuItems?.map((item) => item.category).filter(Boolean) || [])
    );

    // Use stored order if available, otherwise use database order
    let orderedCategories = uniqueCategories;
    if (uploadData?.category_order && Array.isArray(uploadData.category_order)) {
      // Merge stored order with unknown new categories
      const storedOrder = uploadData.category_order;
      const newCategories = uniqueCategories.filter((cat) => !storedOrder.includes(cat));
      orderedCategories = [...storedOrder, ...newCategories];
    }

    const response = {
      categories: orderedCategories,
      originalCategories: uploadData?.category_order || [],
      hasStoredOrder: !!uploadData?.category_order,
    };

    // Cache the response for 10 minutes
    await cache.set(cacheKey, response, { ttl: cacheTTL.medium });

    return NextResponse.json(response);
  } catch (_error) {
    logger.error("[CATEGORIES API] Unexpected error:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });
    return apiErrors.internal('Internal server error');
  }
}

export async function PUT(_request: NextRequest) {
  try {
    const req = _request;
    const { searchParams } = new URL(req.url);
    const venueId = searchParams.get("venueId");
    const body = await req.json();
    const { categories  } = body;
    const finalVenueId = venueId || body.venueId;

    if (!finalVenueId || !Array.isArray(categories)) {
      return NextResponse.json(
        { error: "finalVenueId and categories array are required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Update or create menu upload record with new category order
    const { data: existingUpload, error: fetchError } = await supabase
      .from("menu_uploads")
      .select("id")
      .eq("venue_id", finalVenueId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError) {
      logger.error("[CATEGORIES API] Error fetching existing upload:", { value: fetchError });
      return apiErrors.internal('Failed to fetch existing upload');
    }

    // Update or create menu upload record with new category order
    if (existingUpload) {
      const { error: updateError } = await supabase
        .from("menu_uploads")
        .update({
          category_order: categories,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingUpload.id);

      if (updateError) {
        logger.error("[CATEGORIES API] Error updating category order:", { value: updateError });
        return apiErrors.internal('Failed to update category order');
      }
    } else {
      // Create new menu upload record if none exists
      const { error: insertError } = await supabase.from("menu_uploads").insert({
        venue_id: finalVenueId,
        category_order: categories,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (insertError) {
        logger.error("[CATEGORIES API] Error creating category order:", { value: insertError });
        return apiErrors.internal('Failed to create category order');
      }
    }

    return NextResponse.json({
      success: true,
      message: "Category order updated successfully",
      categories,
    });
  } catch (_error) {
    logger.error("[CATEGORIES API] Unexpected error:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });
    return apiErrors.internal('Internal server error');
  }
}

export async function POST(_request: NextRequest) {
  try {
    const { finalVenueId, categoryName } = await _request.json();

    if (!finalVenueId || !categoryName) {
      return apiErrors.badRequest('finalVenueId and categoryName are required');
    }

    const supabase = await createClient();

    // Get current category order
    const { data: uploadData, error: fetchError } = await supabase
      .from("menu_uploads")
      .select("category_order")
      .eq("venue_id", finalVenueId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError) {
      logger.error("[CATEGORIES API] Error fetching category order:", { value: fetchError });
      return apiErrors.internal('Failed to fetch category order');
    }

    // Add new category to the end of the list
    const currentCategories = uploadData?.category_order || [];
    const newCategories = [...currentCategories, categoryName];

    // Update category order
    const { data: existingUpload } = await supabase
      .from("menu_uploads")
      .select("id")
      .eq("venue_id", finalVenueId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingUpload) {
      const { error: updateError } = await supabase
        .from("menu_uploads")
        .update({
          category_order: newCategories,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingUpload.id);

      if (updateError) {
        logger.error("[CATEGORIES API] Error updating category order:", { value: updateError });
        return apiErrors.internal('Failed to update category order');
      }
    } else {
      // For now, just return success without persisting to database
    }

    return NextResponse.json({
      success: true,
      message: "Category added successfully",
      category: categoryName,
      categories: newCategories,
    });
  } catch (_error) {
    logger.error("[CATEGORIES API] Unexpected error:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });
    return apiErrors.internal('Internal server error');
  }
}

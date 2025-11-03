import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { cache, cacheKeys, cacheTTL } from "@/lib/cache";
import { logger } from "@/lib/logger";

export async function GET(_request: NextRequest) {
  try {
    const { searchParams } = new URL(_request.url);
    const venueId = searchParams.get("venueId");

    if (!venueId) {
      return NextResponse.json({ error: "venueId is required" }, { status: 400 });
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
      return NextResponse.json({ error: "Failed to fetch category order" }, { status: 500 });
    }

    // Get all unique categories from menu items
    const { data: menuItems, error: menuError } = await supabase
      .from("menu_items")
      .select("category")
      .eq("venue_id", venueId);

    if (menuError) {
      logger.error("[CATEGORIES API] Error fetching menu items:", { value: menuError });
      return NextResponse.json({ error: "Failed to fetch menu items" }, { status: 500 });
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
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(_request: NextRequest) {
  try {
    const { venueId, categories } = await _request.json();

    if (!venueId || !Array.isArray(categories)) {
      return NextResponse.json(
        { error: "venueId and categories array are required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Update or create menu upload record with new category order
    const { data: existingUpload, error: fetchError } = await supabase
      .from("menu_uploads")
      .select("id")
      .eq("venue_id", venueId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError) {
      logger.error("[CATEGORIES API] Error fetching existing upload:", { value: fetchError });
      return NextResponse.json({ error: "Failed to fetch existing upload" }, { status: 500 });
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
        return NextResponse.json({ error: "Failed to update category order" }, { status: 500 });
      }
    } else {
      // Create new menu upload record if none exists
      const { error: insertError } = await supabase.from("menu_uploads").insert({
        venue_id: venueId,
        category_order: categories,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (insertError) {
        logger.error("[CATEGORIES API] Error creating category order:", { value: insertError });
        return NextResponse.json({ error: "Failed to create category order" }, { status: 500 });
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
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(_request: NextRequest) {
  try {
    const { venueId, categoryName } = await _request.json();

    if (!venueId || !categoryName) {
      return NextResponse.json({ error: "venueId and categoryName are required" }, { status: 400 });
    }

    const supabase = await createClient();

    // Get current category order
    const { data: uploadData, error: fetchError } = await supabase
      .from("menu_uploads")
      .select("category_order")
      .eq("venue_id", venueId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError) {
      logger.error("[CATEGORIES API] Error fetching category order:", { value: fetchError });
      return NextResponse.json({ error: "Failed to fetch category order" }, { status: 500 });
    }

    // Add new category to the end of the list
    const currentCategories = uploadData?.category_order || [];
    const newCategories = [...currentCategories, categoryName];

    // Update category order
    const { data: existingUpload } = await supabase
      .from("menu_uploads")
      .select("id")
      .eq("venue_id", venueId)
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
        return NextResponse.json({ error: "Failed to update category order" }, { status: 500 });
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
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { getAuthUserForAPI } from "@/lib/auth/server";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

/**
 * Menu Item Modifiers API
 * 
 * GET: Fetch modifiers for a menu item
 * POST: Create/update modifiers for a menu item
 * DELETE: Remove modifiers for a menu item
 */

export interface MenuItemModifier {
  id?: string;
  menu_item_id: string;
  name: string; // e.g., "Size", "Toppings", "Extras"
  type: "single" | "multiple"; // Single choice or multiple selections
  required: boolean;
  options: ModifierOption[];
  display_order?: number;
}

export interface ModifierOption {
  id?: string;
  name: string; // e.g., "Small", "Medium", "Large"
  price_modifier: number; // Additional cost (can be negative for discounts)
  is_available: boolean;
  display_order?: number;
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ itemId: string }> }
) {
  try {
    const { itemId } = await context.params;
    const { searchParams } = new URL(req.url);
    const venueId = searchParams.get("venueId");

    if (!itemId) {
      return NextResponse.json({ error: "Item ID is required" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Verify menu item exists and get venue_id
    const { data: menuItem, error: itemError } = await supabase
      .from("menu_items")
      .select("venue_id")
      .eq("id", itemId)
      .single();

    if (itemError || !menuItem) {
      return NextResponse.json({ error: "Menu item not found" }, { status: 404 });
    }

    if (venueId && menuItem.venue_id !== venueId) {
      return NextResponse.json({ error: "Menu item not found" }, { status: 404 });
    }

    // Fetch modifiers (stored as JSON in menu_items table or separate table)
    // For now, we'll use a JSON column approach for simplicity
    const { data: itemWithModifiers, error: fetchError } = await supabase
      .from("menu_items")
      .select("modifiers")
      .eq("id", itemId)
      .single();

    if (fetchError) {
      logger.error("[MODIFIERS GET] Error fetching modifiers:", { error: fetchError });
      return NextResponse.json({ error: "Failed to fetch modifiers" }, { status: 500 });
    }

    const modifiers = (itemWithModifiers?.modifiers as MenuItemModifier[]) || [];

    return NextResponse.json({ modifiers });
  } catch (error) {
    logger.error("[MODIFIERS GET] Unexpected error:", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ itemId: string }> }
) {
  try {
    // Authenticate user
    const { user, error: authError } = await getAuthUserForAPI();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { itemId } = await context.params;
    const body = await req.json();
    const { modifiers } = body as { modifiers: MenuItemModifier[] };

    if (!itemId) {
      return NextResponse.json({ error: "Item ID is required" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Verify menu item exists and user has access
    const { data: menuItem, error: itemError } = await supabase
      .from("menu_items")
      .select("venue_id")
      .eq("id", itemId)
      .single();

    if (itemError || !menuItem) {
      return NextResponse.json({ error: "Menu item not found" }, { status: 404 });
    }

    // Verify venue access
    const { data: venueAccess } = await supabase
      .from("venues")
      .select("venue_id")
      .eq("venue_id", menuItem.venue_id)
      .eq("owner_user_id", user.id)
      .maybeSingle();

    const { data: staffAccess } = await supabase
      .from("user_venue_roles")
      .select("role")
      .eq("venue_id", menuItem.venue_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!venueAccess && (!staffAccess || !["owner", "manager"].includes(staffAccess.role))) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    // Validate modifiers structure
    if (!Array.isArray(modifiers)) {
      return NextResponse.json({ error: "Modifiers must be an array" }, { status: 400 });
    }

    for (const modifier of modifiers) {
      if (!modifier.name || !modifier.type || !Array.isArray(modifier.options)) {
        return NextResponse.json(
          { error: "Invalid modifier structure. Each modifier must have name, type, and options array." },
          { status: 400 }
        );
      }

      if (!["single", "multiple"].includes(modifier.type)) {
        return NextResponse.json(
          { error: "Modifier type must be 'single' or 'multiple'" },
          { status: 400 }
        );
      }

      for (const option of modifier.options) {
        if (!option.name || typeof option.price_modifier !== "number") {
          return NextResponse.json(
            { error: "Invalid option structure. Each option must have name and price_modifier." },
            { status: 400 }
          );
        }
      }
    }

    // Update menu item with modifiers (stored as JSON)
    const { error: updateError } = await supabase
      .from("menu_items")
      .update({
        modifiers: modifiers,
        updated_at: new Date().toISOString(),
      })
      .eq("id", itemId);

    if (updateError) {
      logger.error("[MODIFIERS POST] Error updating modifiers:", { error: updateError });
      return NextResponse.json({ error: "Failed to update modifiers" }, { status: 500 });
    }

    logger.info("[MODIFIERS POST] Modifiers updated successfully", {
      itemId,
      modifierCount: modifiers.length,
    });

    return NextResponse.json({ success: true, modifiers });
  } catch (error) {
    logger.error("[MODIFIERS POST] Unexpected error:", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ itemId: string }> }
) {
  try {
    // Authenticate user
    const { user, error: authError } = await getAuthUserForAPI();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { itemId } = await context.params;

    if (!itemId) {
      return NextResponse.json({ error: "Item ID is required" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Verify menu item exists and user has access
    const { data: menuItem, error: itemError } = await supabase
      .from("menu_items")
      .select("venue_id")
      .eq("id", itemId)
      .single();

    if (itemError || !menuItem) {
      return NextResponse.json({ error: "Menu item not found" }, { status: 404 });
    }

    // Verify venue access
    const { data: venueAccess } = await supabase
      .from("venues")
      .select("venue_id")
      .eq("venue_id", menuItem.venue_id)
      .eq("owner_user_id", user.id)
      .maybeSingle();

    const { data: staffAccess } = await supabase
      .from("user_venue_roles")
      .select("role")
      .eq("venue_id", menuItem.venue_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!venueAccess && (!staffAccess || !["owner", "manager"].includes(staffAccess.role))) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    // Remove modifiers
    const { error: updateError } = await supabase
      .from("menu_items")
      .update({
        modifiers: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", itemId);

    if (updateError) {
      logger.error("[MODIFIERS DELETE] Error removing modifiers:", { error: updateError });
      return NextResponse.json({ error: "Failed to remove modifiers" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("[MODIFIERS DELETE] Unexpected error:", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}


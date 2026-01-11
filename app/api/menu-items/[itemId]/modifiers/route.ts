import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { getAuthUserForAPI } from "@/lib/auth/server";

import { success, apiErrors } from "@/lib/api/standard-response";

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

export async function GET(req: NextRequest, context: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await context.params;
  try {
    const { searchParams } = new URL(req.url);
    const venueId = searchParams.get("venueId");

    if (!itemId) {
      return apiErrors.badRequest("Item ID is required");
    }

    const supabase = createAdminClient();

    // Verify menu item exists and get venue_id
    const { data: menuItem, error: itemError } = await supabase
      .from("menu_items")
      .select("venue_id")
      .eq("id", itemId)
      .single();

    if (itemError || !menuItem) {
      return apiErrors.notFound("Menu item not found");
    }

    if (venueId && menuItem.venue_id !== venueId) {
      return apiErrors.notFound("Menu item not found");
    }

    // Fetch modifiers (stored as JSON in menu_items table or separate table)
    // For now, we'll use a JSON column approach for simplicity
    const { data: itemWithModifiers, error: fetchError } = await supabase
      .from("menu_items")
      .select("modifiers")
      .eq("id", itemId)
      .single();

    if (fetchError) {

      return apiErrors.database("Failed to fetch modifiers");
    }

    const modifiers = (itemWithModifiers?.modifiers as MenuItemModifier[]) || [];

    return success({ modifiers });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    return apiErrors.internal("Internal server error");
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await context.params;
  try {
    // Authenticate user
    const { user, error: authError } = await getAuthUserForAPI();

    if (authError || !user) {
      return apiErrors.unauthorized("Unauthorized");
    }
    const body = await req.json();
    const { modifiers } = body as { modifiers: MenuItemModifier[] };

    if (!itemId) {
      return apiErrors.badRequest("Item ID is required");
    }

    const supabase = createAdminClient();

    // Verify menu item exists and user has access
    const { data: menuItem, error: itemError } = await supabase
      .from("menu_items")
      .select("venue_id")
      .eq("id", itemId)
      .single();

    if (itemError || !menuItem) {
      return apiErrors.notFound("Menu item not found");
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
      return apiErrors.forbidden("Forbidden");
    }

    // Validate modifiers structure
    if (!Array.isArray(modifiers)) {
      return apiErrors.badRequest("Modifiers must be an array");
    }

    for (const modifier of modifiers) {
      if (!modifier.name || !modifier.type || !Array.isArray(modifier.options)) {
        return apiErrors.badRequest(
          "Invalid modifier structure. Each modifier must have name, type, and options array."
        );
      }

      if (!["single", "multiple"].includes(modifier.type)) {
        return apiErrors.badRequest("Modifier type must be 'single' or 'multiple'");
      }

      for (const option of modifier.options) {
        if (!option.name || typeof option.price_modifier !== "number") {
          return apiErrors.badRequest(
            "Invalid option structure. Each option must have name and price_modifier."
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

      return apiErrors.internal("Failed to update modifiers");
    }

    return success({ modifiers });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    return apiErrors.internal("Internal server error");
  }
}

export async function DELETE(_req: NextRequest, context: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await context.params;
  try {
    // Authenticate user
    const { user, error: authError } = await getAuthUserForAPI();

    if (authError || !user) {
      return apiErrors.unauthorized("Unauthorized");
    }

    if (!itemId) {
      return apiErrors.badRequest("Item ID is required");
    }

    const supabase = createAdminClient();

    // Verify menu item exists and user has access
    const { data: menuItem, error: itemError } = await supabase
      .from("menu_items")
      .select("venue_id")
      .eq("id", itemId)
      .single();

    if (itemError || !menuItem) {
      return apiErrors.notFound("Menu item not found");
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
      return apiErrors.forbidden("Forbidden");
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

      return apiErrors.database("Failed to remove modifiers");
    }

    return success({});
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    return apiErrors.internal("Internal server error");
  }
}

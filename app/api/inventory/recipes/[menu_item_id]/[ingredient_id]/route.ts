import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { apiErrors } from "@/lib/api/standard-response";

// DELETE /api/inventory/recipes/[menu_item_id]/[ingredient_id]
// Remove a single ingredient from a recipe
type RecipeParams = { params?: { menu_item_id?: string; ingredient_id?: string } };

export async function DELETE(_request: NextRequest, context: RecipeParams = {}) {
  try {
    const supabase = await createClient();
    const menu_item_id = context.params?.menu_item_id;
    const ingredient_id = context.params?.ingredient_id;

    if (!menu_item_id || !ingredient_id) {
      return apiErrors.badRequest("menu_item_id and ingredient_id are required");
    }

    const { error } = await supabase
      .from("menu_item_ingredients")
      .delete()
      .eq("menu_item_id", menu_item_id)
      .eq("ingredient_id", ingredient_id);

    if (error) {
      logger.error("[INVENTORY API] Error deleting recipe ingredient:", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return apiErrors.internal(error.message || "Internal server error");
    }

    return NextResponse.json({ success: true });
  } catch (_error) {
    logger.error("[INVENTORY API] Unexpected error:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });
    return apiErrors.internal("Internal server error");
  }
}

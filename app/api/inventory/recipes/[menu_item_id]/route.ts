import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import type { RecipeIngredient } from "@/types/inventory";

import { apiErrors } from "@/lib/api/standard-response";

interface RecipeItem {
  ingredient?: {
    cost_per_unit: number;
  };
  qty_per_item: number;
}

// GET /api/inventory/recipes/[menu_item_id]
type RecipeMenuParams = { params?: { menu_item_id?: string } };

export async function GET(_request: NextRequest, context: RecipeMenuParams = {}) {
  try {
    const supabase = await createClient();
    const menu_item_id = context.params?.menu_item_id;

    if (!menu_item_id) {
      return apiErrors.badRequest("menu_item_id is required");
    }

    const { data, error } = await supabase
      .from("menu_item_ingredients")
      .select(
        `
        *,
        ingredient:ingredients(id, name, unit, cost_per_unit)
      `
      )
      .eq("menu_item_id", menu_item_id);

    if (error) {
      return apiErrors.internal(error.message || "Internal server error");
    }

    // Calculate total recipe cost
    const totalCost =
      data?.reduce((sum, item: RecipeItem) => {
        const ingredientCost = item.ingredient?.cost_per_unit || 0;
        return sum + ingredientCost * item.qty_per_item;
      }, 0) || 0;

    return NextResponse.json({
      data,
      total_cost: totalCost,
    });
  } catch (_error) {
    return apiErrors.internal("Internal server error");
  }
}

// POST /api/inventory/recipes/[menu_item_id]
// Upserts recipe ingredients for a menu item
export async function POST(_request: NextRequest, context: RecipeMenuParams = {}) {
  try {
    const supabase = await createClient();
    const menu_item_id = context.params?.menu_item_id;

    if (!menu_item_id) {
      return apiErrors.badRequest("menu_item_id is required");
    }
    const body: { ingredients: RecipeIngredient[] } = await _request.json();

    if (!body.ingredients || !Array.isArray(body.ingredients)) {
      return apiErrors.badRequest("ingredients array is required");
    }

    // Delete existing recipe
    const { error: deleteError } = await supabase
      .from("menu_item_ingredients")
      .delete()
      .eq("menu_item_id", menu_item_id);

    if (deleteError) {
      return apiErrors.internal("Internal server error");
    }

    // Insert new recipe if ingredients provided
    if (body.ingredients.length > 0) {
      const recipeData = body.ingredients.map((ing) => ({
        menu_item_id,
        ingredient_id: ing.ingredient_id,
        qty_per_item: ing.qty_per_item,
        unit: ing.unit,
      }));

      const { data, error: insertError } = await supabase
        .from("menu_item_ingredients")
        .insert(recipeData)
        .select();

      if (insertError) {
        return apiErrors.internal("Internal server error");
      }

      return NextResponse.json({ data }, { status: 201 });
    }

    return NextResponse.json({ data: [] }, { status: 200 });
  } catch (_error) {
    return apiErrors.internal("Internal server error");
  }
}

// DELETE /api/inventory/recipes/[menu_item_id]
// Delete entire recipe for menu item
export async function DELETE(_request: NextRequest, context: RecipeMenuParams = {}) {
  try {
    const supabase = await createClient();
    const menu_item_id = context.params?.menu_item_id;

    if (!menu_item_id) {
      return apiErrors.badRequest("menu_item_id is required");
    }

    const { error } = await supabase
      .from("menu_item_ingredients")
      .delete()
      .eq("menu_item_id", menu_item_id);

    if (error) {
      return apiErrors.internal(error.message || "Internal server error");
    }

    return NextResponse.json({ success: true });
  } catch (_error) {
    return apiErrors.internal("Internal server error");
  }
}

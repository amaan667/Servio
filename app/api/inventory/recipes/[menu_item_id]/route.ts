import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { RecipeIngredient } from '@/types/inventory';

// GET /api/inventory/recipes/[menu_item_id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ menu_item_id: string }> }
) {
  try {
    const supabase = await createClient();
    const { menu_item_id } = await params;

    const { data, error } = await supabase
      .from('menu_item_ingredients')
      .select(`
        *,
        ingredient:ingredients(id, name, unit, cost_per_unit)
      `)
      .eq('menu_item_id', menu_item_id);

    if (error) {
      console.error('[INVENTORY API] Error fetching recipe:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // Calculate total recipe cost
    const totalCost = data?.reduce((sum, item: any) => {
      const ingredientCost = item.ingredient?.cost_per_unit || 0;
      return sum + (ingredientCost * item.qty_per_item);
    }, 0) || 0;

    return NextResponse.json({
      data,
      total_cost: totalCost,
    });
  } catch (error) {
    console.error('[INVENTORY API] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/inventory/recipes/[menu_item_id]
// Upserts recipe ingredients for a menu item
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ menu_item_id: string }> }
) {
  try {
    const supabase = await createClient();
    const { menu_item_id } = await params;
    const body: { ingredients: RecipeIngredient[] } = await request.json();

    if (!body.ingredients || !Array.isArray(body.ingredients)) {
      return NextResponse.json(
        { error: 'ingredients array is required' },
        { status: 400 }
      );
    }

    // Delete existing recipe
    const { error: deleteError } = await supabase
      .from('menu_item_ingredients')
      .delete()
      .eq('menu_item_id', menu_item_id);

    if (deleteError) {
      console.error('[INVENTORY API] Error deleting existing recipe:', deleteError);
      return NextResponse.json(
        { error: deleteError.message },
        { status: 500 }
      );
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
        .from('menu_item_ingredients')
        .insert(recipeData)
        .select();

      if (insertError) {
        console.error('[INVENTORY API] Error inserting recipe:', insertError);
        return NextResponse.json(
          { error: insertError.message },
          { status: 500 }
        );
      }

      return NextResponse.json({ data }, { status: 201 });
    }

    return NextResponse.json({ data: [] }, { status: 200 });
  } catch (error) {
    console.error('[INVENTORY API] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/inventory/recipes/[menu_item_id]
// Delete entire recipe for menu item
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ menu_item_id: string }> }
) {
  try {
    const supabase = await createClient();
    const { menu_item_id } = await params;

    const { error } = await supabase
      .from('menu_item_ingredients')
      .delete()
      .eq('menu_item_id', menu_item_id);

    if (error) {
      console.error('[INVENTORY API] Error deleting recipe:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[INVENTORY API] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}


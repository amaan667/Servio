import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import type { StocktakeRequest } from '@/types/inventory';
import { logger } from '@/lib/logger';

// POST /api/inventory/stock/stocktake
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body: StocktakeRequest = await request.json();

    const { ingredient_id, actual_count, note } = body;

    if (!ingredient_id || actual_count === undefined) {
      return NextResponse.json(
        { error: 'ingredient_id and actual_count are required' },
        { status: 400 }
      );
    }

    // Get ingredient to find venue_id
    const { data: ingredient, error: ingredientError } = await supabase
      .from('ingredients')
      .select('venue_id')
      .eq('id', ingredient_id)
      .single();

    if (ingredientError || !ingredient) {
      return NextResponse.json(
        { error: 'Ingredient not found' },
        { status: 404 }
      );
    }

    // Get current stock level
    const { data: stockLevel, error: stockError } = await supabase
      .from('v_stock_levels')
      .select('on_hand')
      .eq('ingredient_id', ingredient_id)
      .single();

    if (stockError) {
      logger.error('[INVENTORY API] Error fetching stock level:', stockError);
      return NextResponse.json(
        { error: stockError.message },
        { status: 500 }
      );
    }

    const currentStock = stockLevel?.on_hand || 0;
    const delta = actual_count - currentStock;

    // Get current user
    const { data: currentUser } = await supabase.auth.getUser();

    // Create stocktake ledger entry
    const { data, error } = await supabase
      .from('stock_ledgers')
      .insert({
        ingredient_id,
        venue_id: ingredient.venue_id,
        delta,
        reason: 'stocktake',
        ref_type: 'manual',
        note: note || `Stocktake: ${currentStock} → ${actual_count}`,
        created_by: currentUser?.user?.id,
      })
      .select()
      .single();

    if (error) {
      logger.error('[INVENTORY API] Error creating stocktake:', { error: error instanceof Error ? error.message : 'Unknown error' });
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data,
      previous_stock: currentStock,
      new_stock: actual_count,
      delta,
    }, { status: 201 });
  } catch (error) {
    logger.error('[INVENTORY API] Unexpected error:', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}


import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import type { IngredientUnit } from '@/types/inventory';

interface CSVRow {
  name: string;
  sku?: string;
  unit: IngredientUnit;
  cost_per_unit: number;
  on_hand: number;
  par_level: number;
  reorder_level: number;
  supplier?: string;
}

// POST /api/inventory/import/csv
export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const venue_id = formData.get('venue_id') as string;

    if (!file || !venue_id) {
      return NextResponse.json(
        { error: 'file and venue_id are required' },
        { status: 400 }
      );
    }

    // Read CSV content
    const content = await file.text();
    const lines = content.split('\n').filter(line => line.trim());

    if (lines.length < 2) {
      return NextResponse.json(
        { error: 'CSV file is empty or invalid' },
        { status: 400 }
      );
    }

    // Parse CSV (simple parser - assumes no commas in quoted fields)
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
    const rows: CSVRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
      const row: any = {};

      headers.forEach((header, index) => {
        const value = values[index] || '';
        
        if (header.includes('name')) {
          row.name = value;
        } else if (header.includes('sku')) {
          row.sku = value;
        } else if (header.includes('unit')) {
          row.unit = value;
        } else if (header.includes('cost')) {
          row.cost_per_unit = parseFloat(value) || 0;
        } else if (header.includes('on') && header.includes('hand')) {
          row.on_hand = parseFloat(value) || 0;
        } else if (header.includes('par')) {
          row.par_level = parseFloat(value) || 0;
        } else if (header.includes('reorder')) {
          row.reorder_level = parseFloat(value) || 0;
        } else if (header.includes('supplier')) {
          row.supplier = value;
        }
      });

      if (row.name && row.unit) {
        rows.push(row);
      }
    }

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'No valid rows found in CSV' },
        { status: 400 }
      );
    }

    // Get current user
    const { data: currentUser } = await supabase.auth.getUser();

    const imported = [];
    const errors = [];

    // Process each row
    for (const row of rows) {
      try {
        // Upsert ingredient
        const { data: ingredient, error: ingredientError } = await supabase
          .from('ingredients')
          .upsert({
            venue_id,
            name: row.name,
            sku: row.sku,
            unit: row.unit,
            cost_per_unit: row.cost_per_unit,
            par_level: row.par_level,
            reorder_level: row.reorder_level,
            supplier: row.supplier,
          }, {
            onConflict: 'venue_id,name',
          })
          .select()
          .single();

        if (ingredientError) {
          errors.push({ row: row.name, error: ingredientError.message });
          continue;
        }

        // If on_hand is provided and > 0, create a receive ledger entry
        if (row.on_hand && row.on_hand > 0) {
          // Check if we need to set initial stock or adjust
          const { data: currentStock } = await supabase
            .from('v_stock_levels')
            .select('on_hand')
            .eq('ingredient_id', ingredient.id)
            .single();

          const currentOnHand = currentStock?.on_hand || 0;
          const delta = row.on_hand - currentOnHand;

          if (delta !== 0) {
            await supabase.from('stock_ledgers').insert({
              ingredient_id: ingredient.id,
              venue_id,
              delta,
              reason: 'receive',
              ref_type: 'manual',
              note: 'Imported from CSV',
              created_by: currentUser?.user?.id,
            });
          }
        }

        imported.push(ingredient.name);
      } catch (err: any) {
        errors.push({ row: row.name, error: err.message });
      }
    }

    return NextResponse.json({
      success: true,
      imported_count: imported.length,
      error_count: errors.length,
      imported,
      errors,
    });
  } catch (error) {
    console.error('[INVENTORY API] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}


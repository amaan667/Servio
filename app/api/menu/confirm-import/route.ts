import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';

export const runtime = 'nodejs';

interface ImportItem {
  name: string;
  description: string;
  price: number;
  category: string;
  image_url?: string;
}

export async function POST(req: NextRequest) {
  try {
    const { venueId, items, categories, venueName } = await req.json();

    if (!venueId || !items || !Array.isArray(items)) {
      return NextResponse.json(
        { error: 'Invalid request data' },
        { status: 400 }
      );
    }

    console.log('📥 [MENU IMPORT] Starting import for venue:', venueId);
    console.log('📥 [MENU IMPORT] Items to import:', items.length);

    const supabase = createAdminClient();

    // Get the next position number
    const { data: existingItems } = await supabase
      .from('menu_items')
      .select('position')
      .eq('venue_id', venueId)
      .order('position', { ascending: false })
      .limit(1);

    let nextPosition = existingItems && existingItems.length > 0 
      ? (existingItems[0].position || 0) + 1 
      : 0;

    // Prepare menu items for insertion
    const menuItemsToInsert = items.map((item: ImportItem, index: number) => ({
      id: uuidv4(),
      venue_id: venueId,
      name: item.name,
      description: item.description || null,
      price: item.price,
      category: item.category,
      image_url: item.image_url || null,
      is_available: true,
      position: nextPosition + index,
      created_at: new Date().toISOString(),
    }));

    // Insert all menu items
    const { data: insertedItems, error: insertError } = await supabase
      .from('menu_items')
      .insert(menuItemsToInsert)
      .select();

    if (insertError) {
      console.error('❌ [MENU IMPORT] Insert error:', insertError);
      return NextResponse.json(
        { error: `Failed to insert menu items: ${insertError.message}` },
        { status: 500 }
      );
    }

    console.log('✅ [MENU IMPORT] Inserted items:', insertedItems?.length);

    // Update or create category order in menu_uploads
    if (categories && categories.length > 0) {
      const { error: categoryError } = await supabase
        .from('menu_uploads')
        .upsert({
          venue_id: venueId,
          category_order: categories,
          created_at: new Date().toISOString(),
        });

      if (categoryError) {
        console.warn('⚠️ [MENU IMPORT] Category order save failed:', categoryError);
      }
    }

    // Update venue name if provided
    if (venueName) {
      await supabase
        .from('menu_design_settings')
        .upsert({
          venue_id: venueId,
          venue_name: venueName,
        }, {
          onConflict: 'venue_id'
        });
    }

    console.log('🎉 [MENU IMPORT] Import complete!');

    return NextResponse.json({
      success: true,
      imported: insertedItems?.length || 0,
    });
  } catch (error) {
    console.error('❌ [MENU IMPORT] Error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to confirm menu import',
      },
      { status: 500 }
    );
  }
}


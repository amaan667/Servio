import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const { venueId } = await req.json();
    
    if (!venueId) {
      return NextResponse.json({ 
        ok: false, 
        error: 'venueId is required' 
      }, { status: 400 });
    }

    const supabase = await createClient();

    
    // Get current menu items ordered by ID (original insertion order)
    const { data: menuItems, error: itemsError } = await supabase
      .from('menu_items')
      .select('id, name, category, price, order_index')
      .eq('venue_id', venueId)
      .order('id', { ascending: true }); // Order by ID to get the original PDF order

    if (itemsError) {
      console.error('[FIX ORDER INDEX] Error fetching menu items:', itemsError);
      return NextResponse.json({ 
        ok: false, 
        error: `Failed to fetch menu items: ${itemsError.message}` 
      }, { status: 500 });
    }


    if (!menuItems || menuItems.length === 0) {
      return NextResponse.json({ 
        ok: false, 
        error: 'No menu items found for this venue' 
      }, { status: 404 });
    }

    // Update each item with its order_index based on PDF order
    const updates = menuItems.map((item, index) => ({
      id: item.id,
      order_index: index
    }));


    // Update items in batches to avoid hitting query limits
    const batchSize = 50;
    let updatedCount = 0;

    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize);
      
      // Update each item individually since Supabase doesn't support bulk updates easily
      for (const update of batch) {
        const { error: updateError } = await supabase
          .from('menu_items')
          .update({ order_index: update.order_index })
          .eq('id', update.id);

        if (updateError) {
          console.error(`[FIX ORDER INDEX] Error updating item ${update.id}:`, updateError);
        } else {
          updatedCount++;
        }
      }
    }


    // Create a menu upload record with the derived category order
    const categoryFirstAppearance: { [key: string]: number } = {};
    menuItems.forEach((item, index) => {
      const category = item.category || 'Uncategorized';
      if (!(category in categoryFirstAppearance)) {
        categoryFirstAppearance[category] = index;
      }
    });

    // Sort categories by their first appearance (PDF order)
    const correctCategoryOrder = Object.keys(categoryFirstAppearance).sort((a, b) => 
      categoryFirstAppearance[a] - categoryFirstAppearance[b]
    );


    // Insert menu upload record
    const { data: uploadData, error: uploadError } = await supabase
      .from('menu_uploads')
      .insert({
        venue_id: venueId,
        filename: 'existing-menu-fix',
        storage_path: 'n/a',
        file_size: 0,
        extracted_text_length: 0,
        category_order: correctCategoryOrder,
        created_at: new Date().toISOString()
      })
      .select();

    if (uploadError) {
      console.error('[FIX ORDER INDEX] Error creating menu upload record:', uploadError);
      // Don't fail the whole operation for this
    } else {
    }

    return NextResponse.json({ 
      ok: true, 
      message: 'Order index updated successfully',
      updatedItems: updatedCount,
      categoryOrder: correctCategoryOrder
    });

  } catch (error) {
    console.error('[FIX ORDER INDEX] Unexpected error:', error);
    return NextResponse.json({ 
      ok: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

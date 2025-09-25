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

    
    // Get current menu items to derive the correct category order
    const { data: menuItems, error: itemsError } = await supabase
      .from('menu_items')
      .select('id, name, category, price')
      .eq('venue_id', venueId)
      .order('id', { ascending: true }); // Order by ID to get the original PDF order

    if (itemsError) {
      console.error('[FIX CATEGORY ORDER] Error fetching menu items:', itemsError);
      return NextResponse.json({ 
        ok: false, 
        error: `Failed to fetch menu items: ${itemsError.message}` 
      }, { status: 500 });
    }


    // Derive category order from the order items appear in the database
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


    // Update the most recent menu upload with the correct category order
    const { data: uploads, error: fetchError } = await supabase
      .from('menu_uploads')
      .select('id, venue_id, created_at, category_order')
      .eq('venue_id', venueId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (fetchError) {
      console.error('[FIX CATEGORY ORDER] Error fetching menu uploads:', fetchError);
      return NextResponse.json({ 
        ok: false, 
        error: `Failed to fetch menu uploads: ${fetchError.message}` 
      }, { status: 500 });
    }

    if (!uploads || uploads.length === 0) {
      return NextResponse.json({ 
        ok: false, 
        error: 'No menu uploads found for this venue' 
      }, { status: 404 });
    }

    const latestUpload = uploads[0];

    // Update the category order
    const { data: updateData, error: updateError } = await supabase
      .from('menu_uploads')
      .update({ 
        category_order: correctCategoryOrder
      })
      .eq('id', latestUpload.id)
      .select();

    if (updateError) {
      console.error('[FIX CATEGORY ORDER] Error updating category order:', updateError);
      return NextResponse.json({ 
        ok: false, 
        error: `Failed to update category order: ${updateError.message}` 
      }, { status: 500 });
    }

    
    return NextResponse.json({ 
      ok: true, 
      message: 'Category order updated successfully',
      categoryOrder: correctCategoryOrder,
      uploadId: latestUpload.id
    });

  } catch (error) {
    console.error('[FIX CATEGORY ORDER] Unexpected error:', error);
    return NextResponse.json({ 
      ok: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

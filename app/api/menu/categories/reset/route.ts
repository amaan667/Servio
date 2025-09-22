import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const { venueId } = await request.json();

    if (!venueId) {
      return NextResponse.json({ 
        ok: false, 
        error: 'venueId is required' 
      }, { status: 400 });
    }

    console.log('[CATEGORIES RESET] Resetting categories for venue:', venueId);

    const supabase = await createAdminClient();

    // Get the most recent menu upload to get the original category order
    const { data: uploadData, error: uploadError } = await supabase
      .from('menu_uploads')
      .select('category_order')
      .eq('venue_id', venueId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (uploadError) {
      console.error('[CATEGORIES RESET] Error fetching upload data:', uploadError);
      return NextResponse.json({ 
        ok: false, 
        error: `Failed to fetch original categories: ${uploadError.message}` 
      }, { status: 500 });
    }

    if (!uploadData?.category_order || !Array.isArray(uploadData.category_order)) {
      return NextResponse.json({ 
        ok: false, 
        error: 'No original categories found from PDF upload' 
      }, { status: 404 });
    }

    const originalCategories = uploadData.category_order;
    console.log('[CATEGORIES RESET] Found original categories:', originalCategories);

    // Get all current menu items
    const { data: menuItems, error: menuItemsError } = await supabase
      .from('menu_items')
      .select('id, category')
      .eq('venue_id', venueId);

    if (menuItemsError) {
      console.error('[CATEGORIES RESET] Error fetching menu items:', menuItemsError);
      return NextResponse.json({ 
        ok: false, 
        error: `Failed to fetch menu items: ${menuItemsError.message}` 
      }, { status: 500 });
    }

    // Get all current categories from menu items
    const currentCategories = [...new Set(menuItems?.map(item => item.category) || [])];
    console.log('[CATEGORIES RESET] Current categories:', currentCategories);

    // Find categories that were added manually (not in original PDF)
    const manuallyAddedCategories = currentCategories.filter(cat => 
      !originalCategories.some(origCat => 
        origCat.toLowerCase() === cat.toLowerCase()
      )
    );

    console.log('[CATEGORIES RESET] Manually added categories to remove:', manuallyAddedCategories);

    // Delete menu items that belong to manually added categories
    if (manuallyAddedCategories.length > 0) {
      const { error: deleteError } = await supabase
        .from('menu_items')
        .delete()
        .eq('venue_id', venueId)
        .in('category', manuallyAddedCategories);

      if (deleteError) {
        console.error('[CATEGORIES RESET] Error deleting items from manual categories:', deleteError);
        return NextResponse.json({ 
          ok: false, 
          error: `Failed to delete items from manual categories: ${deleteError.message}` 
        }, { status: 500 });
      }

      console.log('[CATEGORIES RESET] Deleted items from manual categories:', manuallyAddedCategories);
    }

    // Update the category_order in the most recent upload to reflect the reset
    const { error: updateError } = await supabase
      .from('menu_uploads')
      .update({ 
        category_order: originalCategories,
        updated_at: new Date().toISOString()
      })
      .eq('venue_id', venueId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (updateError) {
      console.error('[CATEGORIES RESET] Error updating category order:', updateError);
      // Don't fail the entire operation for this
      console.warn('[CATEGORIES RESET] Continuing despite category order update error');
    }

    console.log('[CATEGORIES RESET] Successfully reset categories to original order');

    return NextResponse.json({ 
      ok: true, 
      message: 'Categories reset to original PDF order successfully',
      originalCategories,
      removedCategories: manuallyAddedCategories,
      removedItemsCount: menuItems?.filter(item => 
        manuallyAddedCategories.includes(item.category)
      ).length || 0
    });

  } catch (error) {
    console.error('[CATEGORIES RESET] Error in reset categories API:', error);
    return NextResponse.json({ 
      ok: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

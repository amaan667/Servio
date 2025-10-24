import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';

export const runtime = 'nodejs';

interface MatchedItem {
  name: string;
  description: string;
  price: number;
  category: string;
  image_url?: string;
  page: number;
  x_percent: number;
  y_percent: number;
  confidence: number;
}

interface UnmatchedItem {
  name: string;
  description: string;
  price: number;
  category: string;
  image_url?: string;
}

export async function POST(req: NextRequest) {
  try {
    const { venueId, matchedItems, unmatchedItems } = await req.json();

    if (!venueId) {
      return NextResponse.json(
        { error: 'venueId is required' },
        { status: 400 }
      );
    }

    console.log('💾 [IMPORT] Starting import with hotspots...');
    console.log('💾 [IMPORT] Matched items:', matchedItems?.length || 0);
    console.log('💾 [IMPORT] Unmatched items:', unmatchedItems?.length || 0);

    const supabase = createAdminClient();

    // Get next position
    const { data: existingItems } = await supabase
      .from('menu_items')
      .select('position')
      .eq('venue_id', venueId)
      .order('position', { ascending: false })
      .limit(1);

    let nextPosition = existingItems && existingItems.length > 0 
      ? (existingItems[0].position || 0) + 1 
      : 0;

    const allItemsToInsert = [];
    const hotspotsToInsert = [];

    // Process matched items (have PDF positions)
    if (matchedItems && Array.isArray(matchedItems)) {
      for (let i = 0; i < matchedItems.length; i++) {
        const item = matchedItems[i];
        const itemId = uuidv4();

        // Insert menu item
        allItemsToInsert.push({
          id: itemId,
          venue_id: venueId,
          name: item.name,
          description: item.description || null,
          price: item.price,
          category: item.category,
          image_url: item.image_url || null,
          is_available: true,
          position: nextPosition + i,
          created_at: new Date().toISOString(),
        });

        // Insert hotspot with Vision AI coordinates
        hotspotsToInsert.push({
          id: uuidv4(),
          venue_id: venueId,
          menu_item_id: itemId,
          page_index: item.page,
          x_percent: item.x_percent,
          y_percent: item.y_percent,
          width_percent: 15, // Default width
          height_percent: 8,  // Default height
          created_at: new Date().toISOString(),
        });

        console.log(`  ✅ [IMPORT] ${item.name} → Hotspot at (${item.x_percent}%, ${item.y_percent}%)`);
      }
    }

    nextPosition += matchedItems?.length || 0;

    // Process unmatched items (no PDF position - auto-distribute)
    if (unmatchedItems && Array.isArray(unmatchedItems)) {
      for (let i = 0; i < unmatchedItems.length; i++) {
        const item = unmatchedItems[i];
        const itemId = uuidv4();

        allItemsToInsert.push({
          id: itemId,
          venue_id: venueId,
          name: item.name,
          description: item.description || null,
          price: item.price,
          category: item.category,
          image_url: item.image_url || null,
          is_available: true,
          position: nextPosition + i,
          created_at: new Date().toISOString(),
        });

        // Create fallback hotspot (distribute evenly)
        const row = Math.floor(i / 4);
        const col = i % 4;
        
        hotspotsToInsert.push({
          id: uuidv4(),
          venue_id: venueId,
          menu_item_id: itemId,
          page_index: 0, // Put on first page
          x_percent: 15 + (col * 20), // Spread horizontally
          y_percent: 20 + (row * 15), // Spread vertically
          width_percent: 15,
          height_percent: 8,
          created_at: new Date().toISOString(),
        });

        console.log(`  ⚠️ [IMPORT] ${item.name} → Auto-positioned (fallback)`);
      }
    }

    // Insert all menu items
    if (allItemsToInsert.length > 0) {
      const { error: itemsError } = await supabase
        .from('menu_items')
        .insert(allItemsToInsert);

      if (itemsError) {
        console.error('❌ [IMPORT] Items error:', itemsError);
        throw new Error(`Failed to insert menu items: ${itemsError.message}`);
      }

      console.log('✅ [IMPORT] Inserted menu items:', allItemsToInsert.length);
    }

    // Delete existing hotspots for this venue
    await supabase
      .from('menu_hotspots')
      .delete()
      .eq('venue_id', venueId);

    // Insert all hotspots
    if (hotspotsToInsert.length > 0) {
      const { error: hotspotsError } = await supabase
        .from('menu_hotspots')
        .insert(hotspotsToInsert);

      if (hotspotsError) {
        console.error('❌ [IMPORT] Hotspots error:', hotspotsError);
        throw new Error(`Failed to insert hotspots: ${hotspotsError.message}`);
      }

      console.log('✅ [IMPORT] Inserted hotspots:', hotspotsToInsert.length);
    }

    return NextResponse.json({
      success: true,
      imported: allItemsToInsert.length,
      hotspots: hotspotsToInsert.length,
    });

  } catch (error) {
    console.error('❌ [IMPORT] Error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to import with hotspots',
      },
      { status: 500 }
    );
  }
}


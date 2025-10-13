import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ venueId: string }> }
) {
  try {
    const { venueId } = await context.params;
    
    // Enhanced logging for customer menu access
    
    if (!venueId) {
      return NextResponse.json(
        { error: 'Venue ID is required' },
        { status: 400 }
      );
    }

    // Use server-side Supabase client (bypasses RLS)
    const supabase = await createClient();

    // First check if venue exists
    const { data: venue, error: venueError } = await supabase
      .from('venues')
      .select('venue_id, venue_name')
      .eq('venue_id', venueId)
      .single();

    if (venueError || !venue) {
      console.error('[MENU API] Venue not found:', venueId, venueError);
      return NextResponse.json(
        { error: 'Venue not found', venueId: venueId },
        { status: 404 }
      );
    }

    // Fetch menu items for the venue
    // Use created_at ordering as fallback since order_index column may not exist
    const { data: menuItems, error: menuError } = await supabase
      .from('menu_items')
      .select('*')
      .eq('venue_id', venueId)
      .eq('is_available', true)
      .order('created_at', { ascending: true });

    if (menuError) {
      console.error('[MENU API] Error fetching menu items:', menuError);
      return NextResponse.json(
        { error: 'Failed to load menu items' },
        { status: 500 }
      );
    }

    // Return menu items with venue info
    const response = {
      venue: {
        id: venue.venue_id,
        name: venue.venue_name
      },
      menuItems: menuItems || [],
      totalItems: menuItems?.length || 0
    };

    
    return NextResponse.json(response);

  } catch (error) {
    console.error('[MENU API] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

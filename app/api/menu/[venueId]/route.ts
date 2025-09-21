import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ venueId: string }> }
) {
  try {
    const { venueId } = await context.params;
    
    // Enhanced logging for customer menu access
    console.log('🍕 MENU API CALLED 🍕');
    console.log('[MENU API] ===== MENU REQUEST RECEIVED =====');
    console.log('[MENU API] Timestamp:', new Date().toISOString());
    console.log('[MENU API] Venue ID:', venueId);
    console.log('[MENU API] Request URL:', request.url);
    console.log('[MENU API] User Agent:', request.headers.get('user-agent'));
    console.log('[MENU API] Referer:', request.headers.get('referer'));
    
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
      .select('venue_id, name')
      .eq('venue_id', venueId)
      .single();

    if (venueError || !venue) {
      return NextResponse.json(
        { error: 'Venue not found' },
        { status: 404 }
      );
    }

    // Fetch menu items for the venue
    const { data: menuItems, error: menuError } = await supabase
      .from('menu_items')
      .select('*')
      .eq('venue_id', venueId)
      .eq('available', true)
      .order('category', { ascending: true })
      .order('order_index', { ascending: true, nullsFirst: true })
      .order('name', { ascending: true });

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
        name: venue.name
      },
      menuItems: menuItems || [],
      totalItems: menuItems?.length || 0
    };

    console.log(`[MENU API] Successfully fetched ${response.totalItems} menu items for venue ${venueId}`);
    
    return NextResponse.json(response);

  } catch (error) {
    console.error('[MENU API] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

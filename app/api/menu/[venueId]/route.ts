import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logInfo, logError } from "@/lib/logger";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ venueId: string }> }
) {
  try {
    const { venueId } = await context.params;
    
    // Enhanced logging for customer menu access
    logInfo('🍕 MENU API CALLED 🍕');
    logInfo('[MENU API] ===== MENU REQUEST RECEIVED =====');
    logInfo('[MENU API] Timestamp:', new Date().toISOString());
    logInfo('[MENU API] Venue ID:', venueId);
    logInfo('[MENU API] Request URL:', request.url);
    logInfo('[MENU API] User Agent:', request.headers.get('user-agent'));
    logInfo('[MENU API] Referer:', request.headers.get('referer'));
    
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
    // Use created_at ordering as fallback since order_index column may not exist
    const { data: menuItems, error: menuError } = await supabase
      .from('menu_items')
      .select('*')
      .eq('venue_id', venueId)
      .eq('available', true)
      .order('created_at', { ascending: true });

    if (menuError) {
      logError('[MENU API] Error fetching menu items:', menuError);
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

    logInfo(`[MENU API] Successfully fetched ${response.totalItems} menu items for venue ${venueId}`);
    
    return NextResponse.json(response);

  } catch (error) {
    logError('[MENU API] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

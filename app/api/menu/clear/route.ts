import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const { venue_id } = await request.json();

    if (!venue_id) {
      return NextResponse.json({ ok: false, error: 'venue_id is required' }, { status: 400 });
    }

    console.log('[AUTH DEBUG] Clearing menu items for venue:', venue_id);

    const supabase = createClient();

    // Delete all menu items for the venue
    const { error } = await supabase
      .from('menu_items')
      .delete()
      .eq('venue_id', venue_id);

    if (error) {
      console.error('[AUTH DEBUG] Failed to clear menu items:', error);
      return NextResponse.json({ 
        ok: false, 
        error: `Failed to clear menu items: ${error.message}` 
      }, { status: 500 });
    }

    console.log('[AUTH DEBUG] Successfully cleared all menu items for venue:', venue_id);

    return NextResponse.json({
      ok: true,
      message: 'All menu items cleared successfully'
    });

  } catch (error) {
    console.error('[AUTH DEBUG] Clear menu error:', error);
    return NextResponse.json({ 
      ok: false, 
      error: `Clear menu failed: ${error.message}` 
    }, { status: 500 });
  }
}

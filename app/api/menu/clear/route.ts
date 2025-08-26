import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

let supa: ReturnType<typeof createClient> | null = null;

function getSupabaseClient() {
  if (supa) {
    return supa;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing Supabase environment variables");
  }

  supa = createClient(supabaseUrl, supabaseServiceKey);
  return supa;
}

export async function POST(request: NextRequest) {
  try {
    const { venue_id } = await request.json();

    if (!venue_id) {
      return NextResponse.json({ ok: false, error: 'venue_id is required' }, { status: 400 });
    }

    console.log('[AUTH DEBUG] Clearing menu items for venue:', venue_id);

    // Delete all menu items for the venue
    const { error } = await getSupabaseClient()
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

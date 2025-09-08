import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await req.json();
    const { venueId, resetType = 'all' } = body;

    console.log('[AUTH DEBUG] Table reset request:', { 
      userId: user.id, 
      venueId, 
      resetType 
    });

    let result;
    
    if (resetType === 'venue' && venueId) {
      // Reset specific venue
      const { data, error } = await supabase.rpc('reset_venue_tables', {
        p_venue_id: venueId
      });
      
      if (error) {
        console.error('[AUTH DEBUG] Venue reset error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      
      result = data;
    } else {
      // Reset all tables
      const { data, error } = await supabase.rpc('manual_table_reset', {
        p_venue_id: null
      });
      
      if (error) {
        console.error('[AUTH DEBUG] Manual reset error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      
      result = data;
    }

    console.log('[AUTH DEBUG] Table reset successful:', result);

    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('[AUTH DEBUG] Table reset API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET endpoint to check reset logs
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '10');

    // Get recent reset logs
    const { data, error } = await supabase
      .from('table_reset_logs')
      .select('*')
      .order('reset_timestamp', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[AUTH DEBUG] Reset logs error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: data || []
    });

  } catch (error) {
    console.error('[AUTH DEBUG] Reset logs API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

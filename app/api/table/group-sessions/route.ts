import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const venueId = searchParams.get('venueId');

    if (!venueId) {
      return NextResponse.json({ 
        ok: false, 
        error: 'venueId is required' 
      }, { status: 400 });
    }

    console.log('[GROUP SESSIONS] Fetching group sessions for venue:', venueId);

    const supabase = await createAdminClient();

    try {
      // Get all active group sessions for this venue
      const { data: groupSessions, error } = await supabase
        .from('table_group_sessions')
        .select('*')
        .eq('venue_id', venueId)
        .eq('is_active', true)
        .order('table_number', { ascending: true });

      if (error) {
        if (error.message.includes('does not exist')) {
          console.log('[GROUP SESSIONS] Table does not exist yet, returning empty array');
          return NextResponse.json({ 
            ok: true, 
            groupSessions: [],
            message: 'Table not created yet - returning empty data'
          });
        }
        console.error('[GROUP SESSIONS] Error fetching group sessions:', error);
        return NextResponse.json({ 
          ok: false, 
          error: `Failed to fetch group sessions: ${error.message}` 
        }, { status: 500 });
      }

      console.log('[GROUP SESSIONS] Found group sessions:', groupSessions?.length || 0);

      return NextResponse.json({ 
        ok: true, 
        groupSessions: groupSessions || [],
        count: groupSessions?.length || 0
      });

    } catch (tableError) {
      console.log('[GROUP SESSIONS] Table not available, returning empty array');
      return NextResponse.json({ 
        ok: true, 
        groupSessions: [],
        message: 'Table not available - returning empty data'
      });
    }

  } catch (error) {
    console.error('[GROUP SESSIONS] Error in GET group sessions API:', error);
    return NextResponse.json({ 
      ok: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

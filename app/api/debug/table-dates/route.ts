import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {

    const supabase = await createAdminClient();

    // Find the venue (assuming there's only one, or get the first active one)
    const { data: venues, error: venueError } = await supabase
      .from('venues')
      .select('venue_id, name')
      .eq('active', true)
      .limit(1);

    if (venueError || !venues || venues.length === 0) {
      console.error('[AUTH DEBUG] Could not find venue:', venueError);
      return NextResponse.json({ 
        ok: false, 
        error: 'Could not find venue' 
      }, { status: 500 });
    }

    const venue = venues[0];

    // Check current tables and their creation dates
    const { data: tables, error: tablesError } = await supabase
      .from('tables')
      .select('id, label, seat_count, is_active, created_at')
      .eq('venue_id', venue.venue_id)
      .order('created_at', { ascending: false });

    if (tablesError) {
      console.error('[AUTH DEBUG] Error checking tables:', tablesError);
      return NextResponse.json({ 
        ok: false, 
        error: `Failed to check tables: ${tablesError.message}` 
      }, { status: 500 });
    }

    if (!tables || tables.length === 0) {
      return NextResponse.json({ 
        ok: true, 
        message: 'No tables found for this venue',
        venue: venue,
        tables: []
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tablesWithDates = tables.map(table => {
      const createdDate = new Date(table.created_at);
      const isToday = createdDate >= today;
      const isYesterday = createdDate < today && createdDate >= new Date(today.getTime() - 24 * 60 * 60 * 1000);
      
      return {
        ...table,
        created_date_string: createdDate.toLocaleDateString(),
        created_time_string: createdDate.toLocaleTimeString(),
        is_today: isToday,
        is_yesterday: isYesterday,
        is_older: !isToday && !isYesterday
      };
    });

    const summary = {
      total_tables: tables.length,
      created_today: tablesWithDates.filter(t => t.is_today).length,
      created_yesterday: tablesWithDates.filter(t => t.is_yesterday).length,
      created_earlier: tablesWithDates.filter(t => t.is_older).length
    };


    return NextResponse.json({ 
      ok: true, 
      venue: venue,
      tables: tablesWithDates,
      summary: summary,
      message: summary.created_yesterday > 0 ? 
        `Found ${summary.created_yesterday} table(s) created yesterday that should have been removed!` :
        'All tables are from today or earlier than yesterday'
    });

  } catch (error) {
    console.error('[AUTH DEBUG] Error in table dates check:', error);
    return NextResponse.json({ 
      ok: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

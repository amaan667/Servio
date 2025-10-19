import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

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


    let result;
    
    if (resetType === 'venue' && venueId) {
      // Delete specific venue tables
      const { data, error } = await supabase.rpc('delete_venue_tables', {
        p_venue_id: venueId
      });
      
      if (error) {
        logger.error('[AUTH DEBUG] Venue deletion error:', { error: error instanceof Error ? error.message : 'Unknown error' });
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      
      result = data;
    } else {
      // Delete all tables
      const { data, error } = await supabase.rpc('manual_table_deletion', {
        p_venue_id: null
      });
      
      if (error) {
        logger.error('[AUTH DEBUG] Manual deletion error:', { error: error instanceof Error ? error.message : 'Unknown error' });
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      
      result = data;
    }


    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('[AUTH DEBUG] Table reset API error:', { error: error instanceof Error ? error.message : 'Unknown error' });
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

    // Get recent deletion logs
    const { data, error } = await supabase
      .from('table_deletion_logs')
      .select('*')
      .order('deletion_timestamp', { ascending: false })
      .limit(limit);

    if (error) {
      logger.error('[AUTH DEBUG] Reset logs error:', { error: error instanceof Error ? error.message : 'Unknown error' });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: data || []
    });

  } catch (error) {
    logger.error('[AUTH DEBUG] Reset logs API error:', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

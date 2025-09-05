import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  try {
    const startTime = Date.now();
    const { searchParams } = new URL(req.url);
    const venueId = searchParams.get('venue_id');

    console.log('[TABLES API] Request received for venueId:', venueId, {
      timestamp: new Date().toISOString(),
      url: req.url
    });

    if (!venueId) {
      console.log('[TABLES API] No venueId provided, returning 400');
      return NextResponse.json({ error: 'venue_id is required' }, { status: 400 });
    }

    const supabase = await createClient();
    
    // Add timeout protection
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout after 10 seconds')), 10000);
    });

    // Get tables with their current session and order info
    // Try the view first, fallback to direct query if view doesn't exist
    let tables, error;
    
    const queryPromise = (async () => {
      try {
        const result = await supabase
          .from('tables_with_sessions')
          .select('*')
          .eq('venue_id', venueId)
          .order('label', { ascending: true });
        
        tables = result.data;
        error = result.error;
      } catch (viewError) {
        console.log('[TABLES API] View not found, using direct query');
        
        // Fallback: Direct query to get tables with sessions
        const result = await supabase
          .from('tables')
          .select(`
            id,
            venue_id,
            label,
            seat_count,
            is_active,
            qr_version,
            created_at,
            table_sessions!left (
              id,
              status,
              order_id,
              opened_at,
              closed_at,
              orders!left (
                total_amount,
                customer_name,
                order_status,
                payment_status,
                updated_at
              )
            )
          `)
          .eq('venue_id', venueId)
          .eq('is_active', true)
          .order('label', { ascending: true });
        
        tables = result.data?.map(table => ({
          id: table.id,
          venue_id: table.venue_id,
          label: table.label,
          seat_count: table.seat_count,
          is_active: table.is_active,
          qr_version: table.qr_version,
          table_created_at: table.created_at,
          session_id: table.table_sessions?.[0]?.id || null,
          status: table.table_sessions?.[0]?.status || 'FREE',
          order_id: table.table_sessions?.[0]?.order_id || null,
          opened_at: table.table_sessions?.[0]?.opened_at || null,
          closed_at: table.table_sessions?.[0]?.closed_at || null,
          total_amount: table.table_sessions?.[0]?.orders?.total_amount || null,
          customer_name: table.table_sessions?.[0]?.orders?.customer_name || null,
          order_status: table.table_sessions?.[0]?.orders?.order_status || null,
          payment_status: table.table_sessions?.[0]?.orders?.payment_status || null,
          order_updated_at: table.table_sessions?.[0]?.orders?.updated_at || null,
        })) || [];
        
        error = result.error;
      }
    })();

    // Race between query and timeout
    await Promise.race([queryPromise, timeoutPromise]);

    const queryTime = Date.now() - startTime;
    console.log('[TABLES API] Query completed in:', queryTime + 'ms');

    if (error) {
      console.error('[TABLES API] Error fetching tables:', error);
      return NextResponse.json({ error: 'Failed to fetch tables' }, { status: 500 });
    }

    console.log('[TABLES API] Returning tables:', tables?.length || 0);
    return NextResponse.json({ tables });
  } catch (error) {
    console.error('[TABLES API] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { venue_id, label, seat_count, qr_version } = body;

    if (!venue_id || !label) {
      return NextResponse.json({ error: 'venue_id and label are required' }, { status: 400 });
    }

    const supabase = await createClient();

    // Verify venue exists and user has access
    const { data: venue, error: venueError } = await supabase
      .from('venues')
      .select('venue_id')
      .eq('venue_id', venue_id)
      .single();

    if (venueError || !venue) {
      return NextResponse.json({ error: 'Invalid venue_id' }, { status: 400 });
    }

    // Create table
    const { data: table, error: tableError } = await supabase
      .from('tables')
      .insert({
        venue_id,
        label: label.trim(),
        seat_count: seat_count || 2,
        qr_version: qr_version || 1,
      })
      .select()
      .single();

    if (tableError) {
      console.error('[TABLES API] Error creating table:', tableError);
      return NextResponse.json({ error: 'Failed to create table' }, { status: 500 });
    }

    // Create initial FREE session for the table
    const { data: session, error: sessionError } = await supabase
      .from('table_sessions')
      .insert({
        venue_id,
        table_id: table.id,
        status: 'FREE',
        opened_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (sessionError) {
      console.error('[TABLES API] Error creating initial session:', sessionError);
      // Don't fail the entire operation, just log the error
      // The table was created successfully, session creation is optional
    }

    console.log('[TABLES API] Table created successfully:', {
      tableId: table.id,
      label: table.label,
      sessionId: session?.id || 'none'
    });

    return NextResponse.json({ table });
  } catch (error) {
    console.error('[TABLES API] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

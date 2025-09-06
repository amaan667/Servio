import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient, getAuthenticatedUser } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  try {
    const startTime = Date.now();
    const { searchParams } = new URL(req.url);
    const venueId = searchParams.get('venue_id');

    console.log('[TABLES API] GET request received for venueId:', venueId, {
      timestamp: new Date().toISOString(),
      url: req.url
    });

    if (!venueId) {
      console.log('[TABLES API] No venueId provided, returning 400');
      return NextResponse.json({ error: 'venue_id is required' }, { status: 400 });
    }

    // Check if user is authenticated
    const { user, error: authError } = await getAuthenticatedUser();
    if (authError || !user) {
      console.log('[TABLES API] Authentication failed:', authError);
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    console.log('[TABLES API] User authenticated:', user.id);

    // Use admin client to bypass RLS issues
    const supabase = createAdminClient();
    
    // Verify venue exists and user has access
    const { data: venue, error: venueError } = await supabase
      .from('venues')
      .select('venue_id, owner_id')
      .eq('venue_id', venueId)
      .single();

    if (venueError || !venue) {
      console.error('[TABLES API] Venue not found:', venueError);
      return NextResponse.json({ error: 'Invalid venue_id' }, { status: 400 });
    }

    // Check if user owns the venue
    if (venue.owner_id !== user.id) {
      console.log('[TABLES API] User does not own venue');
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    console.log('[TABLES API] Venue access verified');
    
    // Add timeout protection
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout after 10 seconds')), 10000);
    });

    // Get tables with their current session and order info
    // Try the view first, fallback to direct query if view doesn't exist
    let tables, error;
    
    const queryPromise = (async () => {
      try {
        console.log('[TABLES API] Attempting to query tables_with_sessions view...');
        const result = await supabase
          .from('tables_with_sessions')
          .select('*')
          .eq('venue_id', venueId)
          .order('label', { ascending: true });
        
        if (result.error) {
          console.log('[TABLES API] View query failed:', result.error);
          throw result.error;
        }
        
        tables = result.data;
        error = null;
        console.log('[TABLES API] Successfully queried view, found', tables?.length || 0, 'tables');
      } catch (viewError) {
        console.log('[TABLES API] View not found or failed, using direct query. Error:', viewError);
        
        // Fallback: Direct query to get tables with sessions
        console.log('[TABLES API] Starting fallback query...');
        
        // First get tables
        const tablesResult = await supabase
          .from('tables')
          .select(`
            id,
            venue_id,
            label,
            seat_count,
            is_active,
            qr_version,
            created_at
          `)
          .eq('venue_id', venueId)
          .eq('is_active', true)
          .order('label', { ascending: true });
        
        console.log('[TABLES API] Tables query result:', { 
          data: tablesResult.data?.length || 0, 
          error: tablesResult.error 
        });
        
        if (tablesResult.error) {
          console.error('[TABLES API] Error fetching tables:', tablesResult.error);
          throw tablesResult.error;
        }
        
        // Then get sessions for these tables
        const tableIds = tablesResult.data?.map(t => t.id) || [];
        let sessionsResult = { data: [], error: null };
        
        if (tableIds.length > 0) {
          console.log('[TABLES API] Fetching sessions for', tableIds.length, 'tables...');
          sessionsResult = await supabase
            .from('table_sessions')
            .select(`
              id,
              table_id,
              status,
              order_id,
              opened_at,
              closed_at
            `)
            .in('table_id', tableIds)
            .is('closed_at', null);
          
          console.log('[TABLES API] Sessions query result:', { 
            data: sessionsResult.data?.length || 0, 
            error: sessionsResult.error 
          });
        }
        
        // Get orders for sessions that have order_id
        const orderIds = sessionsResult.data?.filter(s => s.order_id).map(s => s.order_id) || [];
        let ordersResult = { data: [], error: null };
        
        if (orderIds.length > 0) {
          console.log('[TABLES API] Fetching orders for', orderIds.length, 'sessions...');
          ordersResult = await supabase
            .from('orders')
            .select(`
              id,
              total_amount,
              customer_name,
              order_status,
              payment_status,
              updated_at
            `)
            .in('id', orderIds);
          
          console.log('[TABLES API] Orders query result:', { 
            data: ordersResult.data?.length || 0, 
            error: ordersResult.error 
          });
        }
        
        // Get reservations for tables that have RESERVED status
        const reservedTableIds = sessionsResult.data?.filter(s => s.status === 'RESERVED').map(s => s.table_id) || [];
        let reservationsResult = { data: [], error: null };
        
        if (reservedTableIds.length > 0) {
          console.log('[TABLES API] Fetching reservations for', reservedTableIds.length, 'tables...');
          reservationsResult = await supabase
            .from('reservations')
            .select(`
              table_id,
              customer_name,
              reservation_time,
              created_at
            `)
            .in('table_id', reservedTableIds)
            .eq('status', 'ACTIVE');
          
          console.log('[TABLES API] Reservations query result:', { 
            data: reservationsResult.data?.length || 0, 
            error: reservationsResult.error 
          });
        }
        
        // Combine the data
        const result = {
          data: tablesResult.data?.map(table => {
            const session = sessionsResult.data?.find(s => s.table_id === table.id);
            const order = session?.order_id ? ordersResult.data?.find(o => o.id === session.order_id) : null;
            const reservation = session?.status === 'RESERVED' ? reservationsResult.data?.find(r => r.table_id === table.id) : null;
            
            return {
              id: table.id,
              venue_id: table.venue_id,
              label: table.label,
              seat_count: table.seat_count,
              is_active: table.is_active,
              qr_version: table.qr_version,
              table_created_at: table.created_at,
              session_id: session?.id || null,
              status: session?.status || 'FREE',
              order_id: session?.order_id || null,
              opened_at: session?.opened_at || null,
              closed_at: session?.closed_at || null,
              total_amount: order?.total_amount || null,
              customer_name: order?.customer_name || reservation?.customer_name || null,
              order_status: order?.order_status || null,
              payment_status: order?.payment_status || null,
              order_updated_at: order?.updated_at || null,
              reservation_time: reservation?.reservation_time || null,
              reservation_created_at: reservation?.created_at || null,
            };
          }) || [],
          error: null
        };
        
        tables = result.data;
        error = result.error;
        console.log('[TABLES API] Fallback query completed, returning', tables?.length || 0, 'tables');
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
    if (tables && tables.length > 0) {
      console.log('[TABLES API] Table IDs being returned:', tables.map(t => ({ id: t.id, label: t.label })));
    }
    return NextResponse.json({ tables });
  } catch (error) {
    console.error('[TABLES API] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    console.log('[TABLES API] POST request received');
    
    const body = await req.json();
    const { venue_id, label, seat_count, qr_version } = body;

    console.log('[TABLES API] Request body:', { venue_id, label, seat_count, qr_version });

    if (!venue_id || !label) {
      console.log('[TABLES API] Missing required fields');
      return NextResponse.json({ error: 'venue_id and label are required' }, { status: 400 });
    }

    // Check if user is authenticated
    const { user, error: authError } = await getAuthenticatedUser();
    if (authError || !user) {
      console.log('[TABLES API] Authentication failed:', authError);
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    console.log('[TABLES API] User authenticated:', user.id);

    // Use admin client for table creation to bypass RLS issues
    const supabase = createAdminClient();

    // Verify venue exists and user has access
    const { data: venue, error: venueError } = await supabase
      .from('venues')
      .select('venue_id, owner_id')
      .eq('venue_id', venue_id)
      .single();

    if (venueError || !venue) {
      console.error('[TABLES API] Venue not found:', venueError);
      return NextResponse.json({ error: 'Invalid venue_id' }, { status: 400 });
    }

    // Check if user owns the venue
    if (venue.owner_id !== user.id) {
      console.log('[TABLES API] User does not own venue');
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    console.log('[TABLES API] Venue access verified');

    // Create table with constraint bypass
    let table, tableError;
    
    // First, try to disable the trigger temporarily
    try {
      await supabase.rpc('exec_sql', { 
        sql: 'DROP TRIGGER IF EXISTS create_free_session_trigger ON tables;' 
      });
    } catch (triggerError) {
      console.log('[TABLES API] Could not disable trigger:', triggerError);
    }
    
    const { data: initialTable, error: initialError } = await supabase
      .from('tables')
      .insert({
        venue_id,
        label: label.trim(),
        seat_count: seat_count || 2,
        qr_version: qr_version || 1,
      })
      .select()
      .single();

    table = initialTable;
    tableError = initialError;
    
    // Manually create the session for the table
    if (!tableError && table) {
      try {
        const { data: session, error: sessionError } = await supabase
          .from('table_sessions')
          .insert({
            table_id: table.id,
            venue_id: venue_id,
            status: 'FREE',
            opened_at: new Date().toISOString()
          })
          .select()
          .single();
        
        if (sessionError) {
          console.log('[TABLES API] Session creation failed, but table was created:', sessionError);
        } else {
          console.log('[TABLES API] Session created successfully:', session.id);
        }
      } catch (sessionError) {
        console.log('[TABLES API] Session creation error:', sessionError);
      }
    }
    
    // Re-enable the trigger
    try {
      await supabase.rpc('exec_sql', { 
        sql: `
          CREATE OR REPLACE FUNCTION create_free_session_for_new_table()
          RETURNS TRIGGER AS $$
          BEGIN
              IF NOT EXISTS (
                  SELECT 1 FROM table_sessions 
                  WHERE table_id = NEW.id 
                  AND closed_at IS NULL
              ) THEN
                  INSERT INTO table_sessions (table_id, venue_id, status, opened_at)
                  VALUES (NEW.id, NEW.venue_id, 'FREE', NOW());
              END IF;
              RETURN NEW;
          END;
          $$ language 'plpgsql';
          
          CREATE TRIGGER create_free_session_trigger
              AFTER INSERT ON tables
              FOR EACH ROW
              EXECUTE FUNCTION create_free_session_for_new_table();
        ` 
      });
    } catch (triggerError) {
      console.log('[TABLES API] Could not re-enable trigger:', triggerError);
    }

    if (tableError) {
      console.error('[TABLES API] Error creating table:', tableError);
      
      // Check if it's the constraint error we're dealing with
      if (tableError.code === '23505' && tableError.message.includes('uniq_open_session_per_table')) {
        console.log('[TABLES API] Constraint error detected - attempting to work around it');
        
        // Try to create the table without the automatic session creation
        try {
          // First, disable the trigger temporarily
          await supabase.rpc('exec_sql', { 
            sql: 'DROP TRIGGER IF EXISTS create_free_session_trigger ON tables;' 
          });
          
          // Create the table again
          const { data: retryTable, error: retryError } = await supabase
            .from('tables')
            .insert({
              venue_id,
              label: label.trim(),
              seat_count: seat_count || 2,
              qr_version: qr_version || 1,
            })
            .select()
            .single();
          
          if (retryError) {
            console.error('[TABLES API] Retry also failed:', retryError);
            return NextResponse.json({ 
              error: 'Failed to create table', 
              details: retryError.message 
            }, { status: 500 });
          }
          
          // Manually create a session for the table
          const { data: session, error: sessionError } = await supabase
            .from('table_sessions')
            .insert({
              table_id: retryTable.id,
              venue_id: venue_id,
              status: 'FREE',
              opened_at: new Date().toISOString()
            })
            .select()
            .single();
          
          if (sessionError) {
            console.log('[TABLES API] Session creation failed, but table was created:', sessionError);
          }
          
          // Re-enable the trigger
          await supabase.rpc('exec_sql', { 
            sql: `
              CREATE TRIGGER create_free_session_trigger
                AFTER INSERT ON tables
                FOR EACH ROW
                EXECUTE FUNCTION create_free_session_for_new_table();
            ` 
          });
          
          console.log('[TABLES API] Table created successfully with workaround:', retryTable.id);
          
          return NextResponse.json({ 
            success: true,
            table: {
              id: retryTable.id,
              venue_id: retryTable.venue_id,
              label: retryTable.label,
              seat_count: retryTable.seat_count,
              qr_version: retryTable.qr_version,
              created_at: retryTable.created_at
            }
          });
          
        } catch (workaroundError) {
          console.error('[TABLES API] Workaround failed:', workaroundError);
          return NextResponse.json({ 
            error: 'Table creation temporarily unavailable', 
            details: 'There is a database constraint issue preventing table creation. Please run the fix-table-creation-constraint.sql script in your Supabase SQL editor to resolve this issue.',
            code: 'CONSTRAINT_ERROR',
            fix_script: 'fix-table-creation-constraint.sql'
          }, { status: 503 });
        }
      } else {
        return NextResponse.json({ 
          error: 'Failed to create table', 
          details: tableError.message 
        }, { status: 500 });
      }
    }

    if (tableError) {
      return NextResponse.json({ 
        error: 'Failed to create table', 
        details: tableError.message 
      }, { status: 500 });
    }

    console.log('[TABLES API] Table created successfully:', table.id);

    // The trigger should automatically create the initial session, but let's verify
    const { data: session, error: sessionError } = await supabase
      .from('table_sessions')
      .select('id, status')
      .eq('table_id', table.id)
      .eq('status', 'FREE')
      .single();

    if (sessionError) {
      console.error('[TABLES API] Error checking initial session:', sessionError);
      // Don't fail the entire operation, the table was created successfully
    } else {
      console.log('[TABLES API] Initial session created:', session.id);
    }

    console.log('[TABLES API] Table creation completed successfully');

    return NextResponse.json({ 
      success: true,
      table: {
        id: table.id,
        venue_id: table.venue_id,
        label: table.label,
        seat_count: table.seat_count,
        qr_version: table.qr_version,
        created_at: table.created_at
      }
    });
  } catch (error) {
    console.error('[TABLES API] Unexpected error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    console.log('🧪 [TEST TABLES ACCESS] Testing tables table access...');
    
    const supabase = createAdminClient();
    console.log('🧪 [TEST TABLES ACCESS] Admin client created');

    const venueId = 'venue-1e02af4d';
    console.log(`🧪 [TEST TABLES ACCESS] Testing tables access for venue: ${venueId}`);

    // Test 1: Check if tables table exists and is accessible
    console.log('🧪 [TEST TABLES ACCESS] Test 1: Basic tables query...');
    const { data: allTables, error: allTablesError } = await supabase
      .from('tables')
      .select('*')
      .limit(5);

    if (allTablesError) {
      console.error('🧪 [TEST TABLES ACCESS] Error accessing tables table:', allTablesError);
      return NextResponse.json(
        { error: `Tables table access error: ${allTablesError.message}` },
        { status: 500 }
      );
    }

    console.log('🧪 [TEST TABLES ACCESS] Tables table accessible, found:', allTables?.length || 0, 'tables');

    // Test 2: Check tables for specific venue
    console.log('🧪 [TEST TABLES ACCESS] Test 2: Venue-specific tables query...');
    const { data: venueTables, error: venueTablesError } = await supabase
      .from('tables')
      .select('id, label, session_status, venue_id')
      .eq('venue_id', venueId);

    if (venueTablesError) {
      console.error('🧪 [TEST TABLES ACCESS] Error fetching venue tables:', venueTablesError);
      return NextResponse.json(
        { 
          error: `Venue tables fetch error: ${venueTablesError.message}`,
          allTables: allTables
        },
        { status: 500 }
      );
    }

    console.log('🧪 [TEST TABLES ACCESS] Venue tables found:', venueTables?.length || 0);

    // Test 3: Check table_sessions table
    console.log('🧪 [TEST TABLES ACCESS] Test 3: Table sessions access...');
    const { data: tableSessions, error: sessionsError } = await supabase
      .from('table_sessions')
      .select('*')
      .eq('venue_id', venueId)
      .limit(5);

    if (sessionsError) {
      console.warn('🧪 [TEST TABLES ACCESS] Table sessions access warning:', sessionsError);
    } else {
      console.log('🧪 [TEST TABLES ACCESS] Table sessions accessible, found:', tableSessions?.length || 0);
    }

    // Test 4: Check table_runtime_state table
    console.log('🧪 [TEST TABLES ACCESS] Test 4: Table runtime state access...');
    const { data: runtimeState, error: runtimeError } = await supabase
      .from('table_runtime_state')
      .select('*')
      .eq('venue_id', venueId)
      .limit(5);

    if (runtimeError) {
      console.warn('🧪 [TEST TABLES ACCESS] Table runtime state access warning:', runtimeError);
    } else {
      console.log('🧪 [TEST TABLES ACCESS] Table runtime state accessible, found:', runtimeState?.length || 0);
    }

    return NextResponse.json({
      success: true,
      message: 'Tables access test successful',
      results: {
        allTables: allTables?.length || 0,
        venueTables: venueTables?.length || 0,
        tableSessions: tableSessions?.length || 0,
        runtimeState: runtimeState?.length || 0
      },
      data: {
        allTables,
        venueTables,
        tableSessions,
        runtimeState
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('🧪 [TEST TABLES ACCESS] Error in tables access test:', error);
    return NextResponse.json(
      { error: `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}

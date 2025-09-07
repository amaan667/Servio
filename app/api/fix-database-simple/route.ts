import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function POST() {
  try {
    console.log('🔧 Applying simple database fix...');
    
    const supabase = createAdminClient();
    
    // 1. Test if we can access the tables
    console.log('Testing database access...');
    const { data: tables, error: tablesError } = await supabase
      .from('tables')
      .select('id, venue_id, label')
      .limit(5);
    
    if (tablesError) {
      console.error('Tables error:', tablesError);
      return NextResponse.json({
        success: false,
        error: `Tables error: ${tablesError.message}`
      }, { status: 500 });
    }
    
    console.log(`Found ${tables?.length || 0} tables`);
    
    // 2. Test table_sessions access
    const { data: sessions, error: sessionsError } = await supabase
      .from('table_sessions')
      .select('id, table_id, status')
      .limit(5);
    
    if (sessionsError) {
      console.error('Sessions error:', sessionsError);
      return NextResponse.json({
        success: false,
        error: `Sessions error: ${sessionsError.message}`
      }, { status: 500 });
    }
    
    console.log(`Found ${sessions?.length || 0} sessions`);
    
    // 3. Ensure all tables have sessions
    console.log('Ensuring all tables have sessions...');
    let sessionsCreated = 0;
    
    if (tables) {
      for (const table of tables) {
        const { data: existingSession } = await supabase
          .from('table_sessions')
          .select('id')
          .eq('table_id', table.id)
          .is('closed_at', null)
          .maybeSingle();
        
        if (!existingSession) {
          const { error: insertError } = await supabase
            .from('table_sessions')
            .insert({
              venue_id: table.venue_id,
              table_id: table.id,
              status: 'FREE',
              opened_at: new Date().toISOString()
            });
          
          if (!insertError) {
            sessionsCreated++;
          } else {
            console.log(`Error creating session for table ${table.id}:`, insertError.message);
          }
        }
      }
    }
    
    // 4. Test the tables_with_sessions view
    console.log('Testing tables_with_sessions view...');
    const { data: viewData, error: viewError } = await supabase
      .from('tables_with_sessions')
      .select('id, label, status')
      .limit(5);
    
    if (viewError) {
      console.error('View error:', viewError);
      return NextResponse.json({
        success: false,
        error: `View error: ${viewError.message}`,
        details: {
          tablesCount: tables?.length || 0,
          sessionsCount: sessions?.length || 0,
          sessionsCreated,
          viewError: viewError.message
        }
      }, { status: 500 });
    }
    
    console.log(`View accessible, found ${viewData?.length || 0} records`);
    
    return NextResponse.json({
      success: true,
      message: 'Database is accessible and working',
      details: {
        tablesCount: tables?.length || 0,
        sessionsCount: sessions?.length || 0,
        sessionsCreated,
        viewRecords: viewData?.length || 0,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('❌ Simple database fix failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

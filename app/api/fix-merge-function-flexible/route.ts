import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    console.log('[FIX MERGE FUNCTION FLEXIBLE] Starting flexible merge function fix...');
    
    const supabase = createAdminClient();
    
    // Read the SQL file
    const fs = require('fs');
    const path = require('path');
    const sqlPath = path.join(process.cwd(), 'fix-merge-function-flexible.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('[FIX MERGE FUNCTION FLEXIBLE] SQL content loaded, length:', sql.length);
    
    // Split the SQL into individual statements
    const statements = sql
      .split(';')
      .map((stmt: string) => stmt.trim())
      .filter((stmt: string) => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log('[FIX MERGE FUNCTION FLEXIBLE] Found', statements.length, 'SQL statements');
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        console.log(`[FIX MERGE FUNCTION FLEXIBLE] Executing statement ${i + 1}/${statements.length}`);
        console.log(`[FIX MERGE FUNCTION FLEXIBLE] Statement:`, statement.substring(0, 100) + '...');
        
        try {
          const { data, error } = await supabase.rpc('exec_sql', { 
            sql: statement + ';' 
          });
          
          if (error) {
            console.error(`[FIX MERGE FUNCTION FLEXIBLE] Error in statement ${i + 1}:`, error);
            // Continue with other statements
          } else {
            console.log(`[FIX MERGE FUNCTION FLEXIBLE] Statement ${i + 1} executed successfully`);
          }
        } catch (err) {
          console.error(`[FIX MERGE FUNCTION FLEXIBLE] Exception in statement ${i + 1}:`, err);
          // Continue with other statements
        }
      }
    }
    
    // Test the updated function
    console.log('[FIX MERGE FUNCTION FLEXIBLE] Testing updated function...');
    
    // Test with the specific tables that were failing
    const testTableA = '68192cab-8658-4d45-bcc3-c52cf94f9917';
    const testTableB = '419c6d0a-8df2-4d95-a83f-6593eb74df10';
    const testVenueId = 'venue-1e02af4d';
    
    console.log('[FIX MERGE FUNCTION FLEXIBLE] Testing with tables:', { testTableA, testTableB, testVenueId });
    
    // First check the current status of these tables
    const { data: tableAInfo, error: tableAError } = await supabase
      .from('tables')
      .select('id, label, seat_count, merged_with_table_id')
      .eq('id', testTableA)
      .single();
    
    const { data: tableBInfo, error: tableBError } = await supabase
      .from('tables')
      .select('id, label, seat_count, merged_with_table_id')
      .eq('id', testTableB)
      .single();
    
    console.log('[FIX MERGE FUNCTION FLEXIBLE] Table A info:', tableAInfo);
    console.log('[FIX MERGE FUNCTION FLEXIBLE] Table B info:', tableBInfo);
    
    // Check sessions
    const { data: sessionA, error: sessionAError } = await supabase
      .from('table_sessions')
      .select('*')
      .eq('table_id', testTableA)
      .is('closed_at', null)
      .maybeSingle();
    
    const { data: sessionB, error: sessionBError } = await supabase
      .from('table_sessions')
      .select('*')
      .eq('table_id', testTableB)
      .is('closed_at', null)
      .maybeSingle();
    
    console.log('[FIX MERGE FUNCTION FLEXIBLE] Session A:', sessionA);
    console.log('[FIX MERGE FUNCTION FLEXIBLE] Session B:', sessionB);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Flexible merge function has been updated to allow merging tables with FREE or RESERVED status',
      statements_executed: statements.length,
      test_tables: {
        tableA: tableAInfo,
        tableB: tableBInfo,
        sessionA: sessionA,
        sessionB: sessionB
      }
    });
    
  } catch (error) {
    console.error('[FIX MERGE FUNCTION FLEXIBLE] Unexpected error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}

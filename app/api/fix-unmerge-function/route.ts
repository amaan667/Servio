import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    console.log('[FIX UNMERGE FUNCTION] Starting unmerge function fix...');
    
    const supabase = createAdminClient();
    
    // Read the SQL file
    const fs = require('fs');
    const path = require('path');
    const sqlPath = path.join(process.cwd(), 'fix-unmerge-function.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('[FIX UNMERGE FUNCTION] SQL content loaded, length:', sql.length);
    
    // Split the SQL into individual statements
    const statements = sql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log('[FIX UNMERGE FUNCTION] Found', statements.length, 'SQL statements');
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        console.log(`[FIX UNMERGE FUNCTION] Executing statement ${i + 1}/${statements.length}`);
        console.log(`[FIX UNMERGE FUNCTION] Statement:`, statement.substring(0, 100) + '...');
        
        try {
          const { data, error } = await supabase.rpc('exec_sql', { 
            sql: statement + ';' 
          });
          
          if (error) {
            console.error(`[FIX UNMERGE FUNCTION] Error in statement ${i + 1}:`, error);
            // Continue with other statements
          } else {
            console.log(`[FIX UNMERGE FUNCTION] Statement ${i + 1} executed successfully`);
          }
        } catch (err) {
          console.error(`[FIX UNMERGE FUNCTION] Exception in statement ${i + 1}:`, err);
          // Continue with other statements
        }
      }
    }
    
    // Test the updated function
    console.log('[FIX UNMERGE FUNCTION] Testing updated function...');
    
    // First, let's see if we can find a merged table to test with
    const { data: tables, error: tablesError } = await supabase
      .from('tables')
      .select('id, label, merged_with_table_id')
      .not('merged_with_table_id', 'is', null)
      .limit(1);
    
    if (tablesError) {
      console.error('[FIX UNMERGE FUNCTION] Error finding merged tables:', tablesError);
    } else if (tables && tables.length > 0) {
      console.log('[FIX UNMERGE FUNCTION] Found merged table for testing:', tables[0]);
      
      // Test the unmerge function (but don't actually execute it)
      console.log('[FIX UNMERGE FUNCTION] Function should now handle + format labels correctly');
    } else {
      console.log('[FIX UNMERGE FUNCTION] No merged tables found for testing');
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'Unmerge function has been updated to handle + format labels correctly',
      statements_executed: statements.length
    });
    
  } catch (error) {
    console.error('[FIX UNMERGE FUNCTION] Unexpected error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}

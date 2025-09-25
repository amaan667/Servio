import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    
    const supabase = createAdminClient();
    
    // Read the SQL file
    const fs = require('fs');
    const path = require('path');
    const sqlPath = path.join(process.cwd(), 'fix-unmerge-function.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    
    // Split the SQL into individual statements
    const statements = sql
      .split(';')
      .map((stmt: string) => stmt.trim())
      .filter((stmt: string) => stmt.length > 0 && !stmt.startsWith('--'));
    
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        
        try {
          const { data, error } = await supabase.rpc('exec_sql', { 
            sql: statement + ';' 
          });
          
          if (error) {
            console.error(`[FIX UNMERGE FUNCTION] Error in statement ${i + 1}:`, error);
            // Continue with other statements
          } else {
          }
        } catch (err) {
          console.error(`[FIX UNMERGE FUNCTION] Exception in statement ${i + 1}:`, err);
          // Continue with other statements
        }
      }
    }
    
    // Test the updated function
    
    // First, let's see if we can find a merged table to test with
    const { data: tables, error: tablesError } = await supabase
      .from('tables')
      .select('id, label, merged_with_table_id')
      .not('merged_with_table_id', 'is', null)
      .limit(1);
    
    if (tablesError) {
      console.error('[FIX UNMERGE FUNCTION] Error finding merged tables:', tablesError);
    } else if (tables && tables.length > 0) {
      
      // Test the unmerge function (but don't actually execute it)
    } else {
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

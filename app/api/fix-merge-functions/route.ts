import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    console.log('[FIX MERGE FUNCTIONS] Starting merge functions fix...');
    
    // Use admin client for database operations
    const supabase = createAdminClient();
    
    // Read the SQL fix file
    const fs = require('fs');
    const path = require('path');
    const sqlPath = path.join(process.cwd(), 'fix-merge-functions.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('[FIX MERGE FUNCTIONS] SQL file size:', sqlContent.length, 'characters');
    
    // Split the SQL into individual statements
    const statements = sqlContent
      .split(';')
      .map((stmt: string) => stmt.trim())
      .filter((stmt: string) => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`[FIX MERGE FUNCTIONS] Found ${statements.length} SQL statements to execute`);
    
    const results = [];
    let successCount = 0;
    let errorCount = 0;
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      if (statement.trim()) {
        console.log(`[FIX MERGE FUNCTIONS] Executing statement ${i + 1}/${statements.length}...`);
        
        try {
          const { data, error } = await supabase.rpc('exec_sql', { 
            sql: statement + ';' 
          });
          
          if (error) {
            console.error(`[FIX MERGE FUNCTIONS] Error in statement ${i + 1}:`, error.message);
            
            // Continue with other statements unless it's a critical error
            if (error.message.includes('already exists') || 
                error.message.includes('does not exist')) {
              console.log('[FIX MERGE FUNCTIONS] Non-critical error, continuing...');
              successCount++;
              results.push({ statement: i + 1, status: 'warning', message: error.message });
            } else {
              errorCount++;
              results.push({ statement: i + 1, status: 'error', message: error.message });
            }
          } else {
            console.log(`[FIX MERGE FUNCTIONS] Statement ${i + 1} executed successfully`);
            successCount++;
            results.push({ statement: i + 1, status: 'success', message: 'Executed successfully' });
          }
        } catch (err: any) {
          console.error(`[FIX MERGE FUNCTIONS] Unexpected error in statement ${i + 1}:`, err.message);
          errorCount++;
          results.push({ statement: i + 1, status: 'error', message: err.message });
        }
      }
    }
    
    console.log(`[FIX MERGE FUNCTIONS] Execution Summary: ${successCount} successful, ${errorCount} errors`);
    
    return NextResponse.json({
      success: errorCount === 0,
      summary: {
        total: statements.length,
        successful: successCount,
        errors: errorCount
      },
      results: results,
      message: errorCount === 0 
        ? 'Merge functions fix completed successfully!' 
        : `Fix completed with ${errorCount} errors. Check results for details.`
    });
    
  } catch (error: any) {
    console.error('[FIX MERGE FUNCTIONS] Fatal error:', error.message);
    return NextResponse.json({ 
      success: false, 
      error: 'Fatal error during merge functions fix: ' + error.message 
    }, { status: 500 });
  }
}

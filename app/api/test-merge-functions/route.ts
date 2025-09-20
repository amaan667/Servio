import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    console.log('[TEST MERGE FUNCTIONS] Testing database merge functions...');
    
    // Use admin client for database operations
    const supabase = createAdminClient();
    
    // Test if the merge functions exist and are callable
    const testResults = [];
    
    // Test 1: Check if functions exist
    try {
      const { data: functions, error: functionsError } = await supabase
        .from('pg_proc')
        .select('proname, proargtypes')
        .in('proname', ['api_merge_tables', 'api_unmerge_table']);
      
      if (functionsError) {
        testResults.push({
          test: 'Check function existence',
          status: 'error',
          message: `Error checking functions: ${functionsError.message}`
        });
      } else {
        testResults.push({
          test: 'Check function existence',
          status: 'success',
          message: `Found ${functions?.length || 0} functions`,
          data: functions
        });
      }
    } catch (err: any) {
      testResults.push({
        test: 'Check function existence',
        status: 'error',
        message: `Exception: ${err.message}`
      });
    }
    
    // Test 2: Try to call the merge function with dummy data (should fail gracefully)
    try {
      const { data, error } = await supabase.rpc('api_merge_tables', {
        p_venue_id: 'test-venue',
        p_table_a: 'test-table-a',
        p_table_b: 'test-table-b'
      });
      
      if (error) {
        testResults.push({
          test: 'Test merge function call',
          status: 'warning',
          message: `Function callable but failed as expected: ${error.message}`,
          expected: true
        });
      } else {
        testResults.push({
          test: 'Test merge function call',
          status: 'success',
          message: 'Function callable and returned data',
          data: data
        });
      }
    } catch (err: any) {
      testResults.push({
        test: 'Test merge function call',
        status: 'error',
        message: `Function not callable: ${err.message}`
      });
    }
    
    // Test 3: Check if we have any tables to test with
    try {
      const { data: tables, error: tablesError } = await supabase
        .from('tables')
        .select('id, label, status')
        .limit(5);
      
      if (tablesError) {
        testResults.push({
          test: 'Check available tables',
          status: 'error',
          message: `Error fetching tables: ${tablesError.message}`
        });
      } else {
        testResults.push({
          test: 'Check available tables',
          status: 'success',
          message: `Found ${tables?.length || 0} tables`,
          data: tables?.slice(0, 3) // Show first 3 tables
        });
      }
    } catch (err: any) {
      testResults.push({
        test: 'Check available tables',
        status: 'error',
        message: `Exception: ${err.message}`
      });
    }
    
    return NextResponse.json({
      success: true,
      message: 'Merge functions test completed',
      results: testResults,
      summary: {
        total: testResults.length,
        successful: testResults.filter(r => r.status === 'success').length,
        warnings: testResults.filter(r => r.status === 'warning').length,
        errors: testResults.filter(r => r.status === 'error').length
      }
    });
    
  } catch (error: any) {
    console.error('[TEST MERGE FUNCTIONS] Fatal error:', error.message);
    return NextResponse.json({ 
      success: false, 
      error: 'Fatal error during merge functions test: ' + error.message 
    }, { status: 500 });
  }
}

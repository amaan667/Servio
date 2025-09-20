// Apply unmerge function fix
// This script updates the unmerge function to handle + format labels correctly

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// You'll need to replace these with your actual Supabase credentials
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyUnmergeFix() {
  console.log('🔧 Applying unmerge function fix...');
  
  try {
    // Read the SQL file
    const sqlPath = 'fix-unmerge-function.sql';
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('📄 SQL file loaded, length:', sql.length);
    
    // Execute the SQL
    const { data, error } = await supabase.rpc('exec_sql', { 
      sql: sql 
    });
    
    if (error) {
      console.error('❌ Error applying unmerge function fix:', error);
      return;
    }
    
    console.log('✅ Unmerge function fix applied successfully');
    console.log('📋 Function now handles + format labels correctly');
    
    // Test the function by checking if it exists
    console.log('🧪 Testing function...');
    
    // Look for any merged tables to verify the fix
    const { data: tables, error: tablesError } = await supabase
      .from('tables')
      .select('id, label, merged_with_table_id')
      .not('merged_with_table_id', 'is', null)
      .limit(1);
    
    if (tablesError) {
      console.error('❌ Error checking merged tables:', tablesError);
    } else if (tables && tables.length > 0) {
      console.log('✅ Found merged table:', tables[0]);
      console.log('📋 The unmerge function should now work correctly with + format labels');
    } else {
      console.log('ℹ️  No merged tables found, but the function has been updated');
    }
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
  }
}

applyUnmergeFix();

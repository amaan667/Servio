const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.log('Missing Supabase credentials. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
  console.log('\n=== MANUAL STEP REQUIRED ===');
  console.log('Please run the following SQL in your Supabase dashboard SQL Editor:');
  console.log('==================================================');
  
  const sqlContent = fs.readFileSync(path.join(__dirname, 'fix-unmerge-simple.sql'), 'utf8');
  console.log(sqlContent);
  console.log('==================================================');
  console.log('\nAfter running the SQL above, the unmerge functionality will work properly.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyUnmergeSimpleFix() {
  try {
    console.log('🔧 Applying simple unmerge function fix...');
    
    // Read the SQL file
    const sqlContent = fs.readFileSync(path.join(__dirname, 'fix-unmerge-simple.sql'), 'utf8');
    
    // Execute the SQL
    const { data, error } = await supabase.rpc('exec_sql', { sql: sqlContent });
    
    if (error) {
      console.error('❌ Error applying unmerge fix:', error);
      return;
    }
    
    console.log('✅ Simple unmerge function fix applied successfully!');
    console.log('The unmerge functionality should now work properly.');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

applyUnmergeSimpleFix();

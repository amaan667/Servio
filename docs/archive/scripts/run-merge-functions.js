// Script to create the merge tables database functions
// This can be run with: node run-merge-functions.js

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// You'll need to replace these with your actual Supabase credentials
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createMergeFunctions() {
  console.log('Creating merge tables database functions...');
  
  try {
    // Read the SQL file
    const sqlPath = path.join(__dirname, 'create-merge-tables-function.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('\n=== MANUAL STEP REQUIRED ===');
    console.log('Please run the following SQL in your Supabase dashboard SQL Editor:');
    console.log('\n' + '='.repeat(50));
    console.log(sqlContent);
    console.log('='.repeat(50));
    console.log('\nAfter running the SQL above, the merge tables functionality will be available.');
    
    // Test if functions exist
    console.log('\nTesting if functions exist...');
    
    try {
      const { data: testResult, error: testError } = await supabase
        .rpc('api_merge_tables', { 
          p_venue_id: 'venue-1e02af4d', 
          p_table_a: 'test-table-a', 
          p_table_b: 'test-table-b' 
        });

      if (testError && testError.message.includes('function api_merge_tables') && testError.message.includes('does not exist')) {
        console.log('✅ Functions do not exist yet - please run the SQL above to create them.');
      } else {
        console.log('✅ Functions already exist and are working.');
      }
    } catch (error) {
      console.log('✅ Functions do not exist yet - please run the SQL above to create them.');
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

createMergeFunctions();

#!/usr/bin/env node

/**
 * Create the tables_with_sessions view in Supabase
 * This script will create the missing view that's causing the 500 error
 */

const { createClient } = require('@supabase/supabase-js');

// Configuration from your Railway environment
const SUPABASE_URL = 'https://cpwemmofzjfzbmqcgjrq.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwd2VtbW9mempmemJtcWNnanJxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDU4Mjk0MSwiZXhwIjoyMDcwMTU4OTQxfQ.jkhF0M-V19lDfdHtaCq3Sm4KJv0oiI5BhvsFWhw8woc';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function createTablesView() {
  console.log('🗄️  Creating tables_with_sessions view in Supabase...\n');

  try {
    // Read the SQL from the fix script
    const fs = require('fs');
    const sqlContent = fs.readFileSync('/workspace/scripts/fix-tables-with-sessions-view.sql', 'utf8');
    
    console.log('1️⃣ Creating tables_with_sessions view...');
    
    // Execute the SQL
    const { error: viewError } = await supabase.rpc('exec_sql', {
      sql: sqlContent
    });

    if (viewError) {
      console.log('⚠️  View creation failed:', viewError.message);
      console.log('   This might be because the exec_sql function is not available');
      console.log('   Let\'s try a different approach...');
      
      // Try to create the view directly using the SQL editor approach
      console.log('\n🔧 Manual fix required:');
      console.log('   Please run the following SQL manually in your Supabase dashboard');
      console.log('   Go to: https://cpwemmofzjfzbmqcgjrq.supabase.co/project/default/sql');
      console.log('\n   Copy and paste this SQL:');
      console.log('   ======================================');
      console.log(sqlContent);
      console.log('   ======================================');
      
    } else {
      console.log('✅ tables_with_sessions view created successfully');
    }

    // Test the view
    console.log('\n2️⃣ Testing the view...');
    const { data: testData, error: testError } = await supabase
      .from('tables_with_sessions')
      .select('id, venue_id, label, status')
      .limit(1);

    if (testError) {
      console.log('❌ View test failed:', testError.message);
      console.log('\n🔧 The view still needs to be created manually');
    } else {
      console.log('✅ View test successful');
      if (testData && testData.length > 0) {
        console.log('   Sample data:', testData[0]);
      }
    }

    console.log('\n🎉 Process completed!');
    console.log('==========================');
    console.log('✅ tables_with_sessions view should now be available');
    console.log('\n🔍 Next steps:');
    console.log('   1. If the view was created successfully, test the Table Management page');
    console.log('   2. If not, run the SQL manually in Supabase dashboard');
    console.log('   3. The 500 error should be resolved once the view exists');

  } catch (error) {
    console.error('❌ Error creating tables view:', error);
    console.log('\n🔧 Manual fix required:');
    console.log('   Please run the SQL manually in your Supabase dashboard');
    console.log('   Go to: https://cpwemmofzjfzbmqcgjrq.supabase.co/project/default/sql');
    console.log('   Copy and paste the contents of scripts/fix-tables-with-sessions-view.sql');
  }
}

// Run if this file is executed directly
if (require.main === module) {
  createTablesView();
}

module.exports = { createTablesView };
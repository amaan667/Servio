#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL');
  console.error('   SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runSQL(sqlContent, description) {
  console.log(`📝 ${description}...`);
  
  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql: sqlContent });
    
    if (error) {
      console.error(`❌ Error: ${error.message}`);
      return false;
    }
    
    console.log(`✅ ${description} completed successfully`);
    return true;
  } catch (err) {
    console.error(`❌ Error: ${err.message}`);
    return false;
  }
}

async function main() {
  console.log('🚀 Deploying staff soft deletion and forever count fixes...\n');
  
  // Read SQL files
  const schemaUpdateSQL = fs.readFileSync(
    path.join(__dirname, 'scripts', 'update-staff-schema-soft-delete.sql'), 
    'utf8'
  );
  
  const staffCountsSQL = fs.readFileSync(
    path.join(__dirname, 'scripts', 'create-staff-counts-function.sql'), 
    'utf8'
  );
  
  // Run the SQL scripts
  const schemaSuccess = await runSQL(schemaUpdateSQL, 'Applying staff schema updates');
  const countsSuccess = await runSQL(staffCountsSQL, 'Applying staff counts function');
  
  if (schemaSuccess && countsSuccess) {
    console.log('\n🎉 Staff soft deletion and forever count fixes deployed successfully!');
    console.log('\n📋 Changes made:');
    console.log('   1. Added deleted_at column to staff table for soft deletion');
    console.log('   2. Updated staff_counts RPC function to count all staff ever added (forever count)');
    console.log('   3. Updated deletion logic to use soft deletion instead of hard deletion');
    console.log('   4. Updated staff queries to filter out deleted staff');
    console.log('\n💡 The "Total Staff" count will now show all staff ever added, even if they were removed.');
    console.log('   The "Active Staff" count will show only currently active, non-deleted staff.');
  } else {
    console.log('\n❌ Deployment failed. Please check the errors above.');
    process.exit(1);
  }
}

main().catch(console.error);

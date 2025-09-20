#!/usr/bin/env node

/**
 * Apply Fixed Merge Function Script
 * 
 * This script applies the fixed merge table function that uses valid enum values.
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function applyFixedMergeFunction() {
  console.log('🔧 Applying fixed merge function...');
  
  // Check for required environment variables
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.error('❌ NEXT_PUBLIC_SUPABASE_URL environment variable is required');
    process.exit(1);
  }
  
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
    process.exit(1);
  }

  // Create Supabase client with service role key
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    console.log('📖 Reading fixed merge functions SQL file...');
    
    // Read the SQL file
    const sqlContent = fs.readFileSync('fix-merge-functions.sql', 'utf8');
    
    console.log('📄 SQL file size:', sqlContent.length, 'characters');
    
    // Execute the SQL
    const { data, error } = await supabase.rpc('exec_sql', { 
      sql: sqlContent 
    });
    
    if (error) {
      console.error('❌ Error applying fixed merge function:', error);
      return;
    }
    
    console.log('✅ Fixed merge function applied successfully');
    console.log('📋 Function now uses valid table_status enum values (OCCUPIED instead of MERGED)');
    console.log('🚀 Merge functionality should now work correctly!');
    
  } catch (error) {
    console.error('❌ Fatal error during setup:', error.message);
    process.exit(1);
  }
}

// Run the setup
if (require.main === module) {
  applyFixedMergeFunction().catch(console.error);
}

module.exports = { applyFixedMergeFunction };

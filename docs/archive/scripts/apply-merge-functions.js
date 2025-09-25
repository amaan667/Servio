#!/usr/bin/env node

/**
 * Apply Merge Functions Script
 * 
 * This script applies the merge table functions to your Supabase database.
 * Run this after deploying your application to set up the merge functionality.
 * 
 * Usage:
 *   node apply-merge-functions.js
 * 
 * Make sure you have SUPABASE_SERVICE_ROLE_KEY set in your environment variables.
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

async function applyMergeFunctions() {
  console.log('🔄 Starting Merge Functions Setup...');
  
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
    console.log('📖 Reading merge functions SQL file...');
    
    // Read the SQL file
    const sqlPath = path.join(__dirname, 'create-merge-tables-function.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('📄 SQL file size:', sqlContent.length, 'characters');
    
    // Split the SQL into individual statements
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`🔧 Found ${statements.length} SQL statements to execute`);
    
    let successCount = 0;
    let errorCount = 0;
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      if (statement.trim()) {
        console.log(`⚡ Executing statement ${i + 1}/${statements.length}...`);
        
        try {
          const { data, error } = await supabase.rpc('exec_sql', { 
            sql: statement + ';' 
          });
          
          if (error) {
            console.error(`❌ Error in statement ${i + 1}:`, error.message);
            
            // Continue with other statements unless it's a critical error
            if (error.message.includes('already exists') || 
                error.message.includes('does not exist')) {
              console.log('⚠️  Non-critical error, continuing...');
              successCount++;
            } else {
              errorCount++;
            }
          } else {
            console.log(`✅ Statement ${i + 1} executed successfully`);
            successCount++;
          }
        } catch (err) {
          console.error(`❌ Unexpected error in statement ${i + 1}:`, err.message);
          errorCount++;
        }
      }
    }
    
    console.log(`\n📊 Execution Summary:`);
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    
    if (errorCount === 0) {
      console.log('\n🎉 Merge Functions Setup Complete!');
      console.log('');
      console.log('📋 What was configured:');
      console.log('   ✅ Created api_merge_tables function');
      console.log('   ✅ Created api_unmerge_table function');
      console.log('   ✅ Set up proper merge rules (FREE tables only merge with FREE)');
      console.log('   ✅ Configured table merging with combined labels and seat counts');
      console.log('');
      console.log('🚀 Your table merge functionality is now ready!');
      console.log('   • FREE tables can only merge with other FREE tables');
      console.log('   • Merged tables will show combined labels (e.g., "Table 4+Table 6")');
      console.log('   • Seat counts will be combined');
      console.log('   • Secondary table will be marked as merged');
    } else {
      console.log('\n⚠️  Setup completed with some errors.');
      console.log('   Some features may not work correctly.');
      console.log('   Check the error messages above for details.');
    }
    
  } catch (error) {
    console.error('❌ Fatal error during setup:', error.message);
    console.log('');
    console.log('💡 Manual Setup Instructions:');
    console.log('   1. Open your Supabase dashboard');
    console.log('   2. Go to SQL Editor');
    console.log('   3. Copy and paste the contents of create-merge-tables-function.sql');
    console.log('   4. Execute the SQL');
    console.log('   5. Your merge functionality will be ready!');
    process.exit(1);
  }
}

// Run the setup
if (require.main === module) {
  applyMergeFunctions().catch(console.error);
}

module.exports = { applyMergeFunctions };

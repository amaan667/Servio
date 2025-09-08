#!/usr/bin/env node

/**
 * Deploy Table Linking Schema
 * 
 * This script deploys the table linking functionality for merge tables.
 * Run this script to set up the database schema and functions.
 */

const fs = require('fs');
const path = require('path');

async function deployTableLinking() {
  console.log('🚀 Deploying Table Linking Schema...');
  
  try {
    // Read the SQL file
    const sqlPath = path.join(__dirname, 'create-table-linking-schema.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('📄 SQL file loaded successfully');
    console.log('📋 SQL content preview:');
    console.log(sqlContent.substring(0, 200) + '...');
    
    console.log('\n✅ Table Linking Schema ready for deployment!');
    console.log('\n📝 Next steps:');
    console.log('1. Go to your Supabase Dashboard');
    console.log('2. Navigate to SQL Editor');
    console.log('3. Copy the content from scripts/create-table-linking-schema.sql');
    console.log('4. Paste and run the SQL script');
    console.log('5. Verify the following are created:');
    console.log('   - table_session_links table');
    console.log('   - api_merge_tables function');
    console.log('   - api_unmerge_table function');
    console.log('   - get_active_session_for_table function');
    console.log('   - get_table_counts_with_links function');
    console.log('   - close_table_with_unlink function');
    console.log('   - RLS policies for table_session_links');
    
    console.log('\n🔧 Features enabled after deployment:');
    console.log('✅ Merge tables with strict eligibility rules');
    console.log('✅ Unmerge tables functionality');
    console.log('✅ QR routing for linked tables');
    console.log('✅ Updated table counters');
    console.log('✅ Automatic unlinking when closing primary tables');
    console.log('✅ Reservation system with customer name and time');
    
  } catch (error) {
    console.error('❌ Error deploying table linking schema:', error);
    process.exit(1);
  }
}

// Run the deployment
deployTableLinking();

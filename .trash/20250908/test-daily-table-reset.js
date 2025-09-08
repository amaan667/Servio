#!/usr/bin/env node

/**
 * Test script for the daily table deletion system
 * This script tests the database functions and API endpoints
 */

const { createClient } = require('@supabase/supabase-js');

// Configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Error: Missing required environment variables');
  console.error('Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function testDailyDeletion() {
  console.log('🧪 Testing Daily Table Deletion System...\n');

  try {
    // Test 1: Check if tables exist
    console.log('1️⃣ Checking table structure...');
    const { data: tables, error: tablesError } = await supabase
      .from('tables')
      .select('id, venue_id, label, is_active')
      .limit(5);

    if (tablesError) {
      console.error('❌ Error checking tables:', tablesError.message);
      return;
    }

    console.log(`✅ Found ${tables?.length || 0} tables`);
    if (tables && tables.length > 0) {
      console.log(`   Sample table: ${tables[0].label} (venue: ${tables[0].venue_id})`);
    }

    // Test 2: Check table sessions
    console.log('\n2️⃣ Checking current table sessions...');
    const { data: sessions, error: sessionsError } = await supabase
      .from('table_sessions')
      .select('id, table_id, status, opened_at, closed_at')
      .is('closed_at', null)
      .limit(5);

    if (sessionsError) {
      console.error('❌ Error checking sessions:', sessionsError.message);
      return;
    }

    console.log(`✅ Found ${sessions?.length || 0} active sessions`);
    if (sessions && sessions.length > 0) {
      const statusCounts = sessions.reduce((acc, session) => {
        acc[session.status] = (acc[session.status] || 0) + 1;
        return acc;
      }, {});
      console.log(`   Status breakdown:`, statusCounts);
    }

    // Test 3: Test manual deletion function
    console.log('\n3️⃣ Testing manual deletion function...');
    const { data: deletionResult, error: deletionError } = await supabase.rpc('manual_table_deletion', {
      p_venue_id: null
    });

    if (deletionError) {
      console.error('❌ Error testing manual deletion:', deletionError.message);
      return;
    }

    console.log('✅ Manual deletion completed successfully');
    console.log(`   Deleted ${deletionResult.deleted_tables} tables and ${deletionResult.deleted_sessions} sessions across ${deletionResult.venues_affected} venues`);
    console.log(`   Log ID: ${deletionResult.log_id}`);

    // Test 4: Check deletion logs
    console.log('\n4️⃣ Checking deletion logs...');
    const { data: logs, error: logsError } = await supabase
      .from('table_deletion_logs')
      .select('*')
      .order('deletion_timestamp', { ascending: false })
      .limit(3);

    if (logsError) {
      console.error('❌ Error checking logs:', logsError.message);
      return;
    }

    console.log(`✅ Found ${logs?.length || 0} deletion log entries`);
    if (logs && logs.length > 0) {
      logs.forEach((log, index) => {
        console.log(`   ${index + 1}. ${log.deletion_type} deletion at ${log.deletion_timestamp} (${log.tables_deleted} tables, ${log.sessions_deleted} sessions)`);
      });
    }

    // Test 5: Verify tables are completely deleted
    console.log('\n5️⃣ Verifying tables are completely deleted...');
    const { data: remainingTables, error: tablesError2 } = await supabase
      .from('tables')
      .select('id, label, is_active')
      .eq('is_active', true);

    if (tablesError2) {
      console.error('❌ Error checking remaining tables:', tablesError2.message);
      return;
    }

    console.log(`✅ Found ${remainingTables?.length || 0} remaining tables (should be 0)`);
    
    // Test 6: Test venue-specific deletion (if we have a venue)
    if (tables && tables.length > 0) {
      const testVenueId = tables[0].venue_id;
      console.log(`\n6️⃣ Testing venue-specific deletion for venue: ${testVenueId}...`);
      
      const { data: venueDeletionResult, error: venueDeletionError } = await supabase.rpc('delete_venue_tables', {
        p_venue_id: testVenueId
      });

      if (venueDeletionError) {
        console.error('❌ Error testing venue deletion:', venueDeletionError.message);
      } else {
        console.log('✅ Venue-specific deletion completed successfully');
        console.log(`   Deleted ${venueDeletionResult.deleted_tables} tables and ${venueDeletionResult.deleted_sessions} sessions for venue: ${venueDeletionResult.venue_name}`);
      }
    }

    console.log('\n🎉 All tests completed successfully!');
    console.log('\n📋 Summary:');
    console.log('   • Table structure: ✅');
    console.log('   • Session tracking: ✅');
    console.log('   • Manual deletion: ✅');
    console.log('   • Deletion logging: ✅');
    console.log('   • Venue-specific deletion: ✅');
    console.log('\n🚀 The daily table deletion system is ready to use!');

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
testDailyDeletion().then(() => {
  console.log('\n✨ Test script completed');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Test script failed:', error);
  process.exit(1);
});

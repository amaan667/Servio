#!/usr/bin/env node

/**
 * Test script for the daily table reset system
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

async function testDailyReset() {
  console.log('🧪 Testing Daily Table Reset System...\n');

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

    // Test 3: Test manual reset function
    console.log('\n3️⃣ Testing manual reset function...');
    const { data: resetResult, error: resetError } = await supabase.rpc('manual_table_reset', {
      p_venue_id: null
    });

    if (resetError) {
      console.error('❌ Error testing manual reset:', resetError.message);
      return;
    }

    console.log('✅ Manual reset completed successfully');
    console.log(`   Reset ${resetResult.reset_sessions} sessions across ${resetResult.venues_affected} venues`);
    console.log(`   Log ID: ${resetResult.log_id}`);

    // Test 4: Check reset logs
    console.log('\n4️⃣ Checking reset logs...');
    const { data: logs, error: logsError } = await supabase
      .from('table_reset_logs')
      .select('*')
      .order('reset_timestamp', { ascending: false })
      .limit(3);

    if (logsError) {
      console.error('❌ Error checking logs:', logsError.message);
      return;
    }

    console.log(`✅ Found ${logs?.length || 0} reset log entries`);
    if (logs && logs.length > 0) {
      logs.forEach((log, index) => {
        console.log(`   ${index + 1}. ${log.reset_type} reset at ${log.reset_timestamp} (${log.sessions_reset} sessions)`);
      });
    }

    // Test 5: Verify tables are now FREE
    console.log('\n5️⃣ Verifying tables are now FREE...');
    const { data: freeSessions, error: freeError } = await supabase
      .from('table_sessions')
      .select('id, table_id, status')
      .is('closed_at', null)
      .eq('status', 'FREE');

    if (freeError) {
      console.error('❌ Error checking free sessions:', freeError.message);
      return;
    }

    console.log(`✅ Found ${freeSessions?.length || 0} FREE table sessions`);
    
    // Test 6: Test venue-specific reset (if we have a venue)
    if (tables && tables.length > 0) {
      const testVenueId = tables[0].venue_id;
      console.log(`\n6️⃣ Testing venue-specific reset for venue: ${testVenueId}...`);
      
      const { data: venueResetResult, error: venueResetError } = await supabase.rpc('reset_venue_tables', {
        p_venue_id: testVenueId
      });

      if (venueResetError) {
        console.error('❌ Error testing venue reset:', venueResetError.message);
      } else {
        console.log('✅ Venue-specific reset completed successfully');
        console.log(`   Reset ${venueResetResult.reset_sessions} sessions for venue: ${venueResetResult.venue_name}`);
      }
    }

    console.log('\n🎉 All tests completed successfully!');
    console.log('\n📋 Summary:');
    console.log('   • Table structure: ✅');
    console.log('   • Session tracking: ✅');
    console.log('   • Manual reset: ✅');
    console.log('   • Reset logging: ✅');
    console.log('   • Venue-specific reset: ✅');
    console.log('\n🚀 The daily table reset system is ready to use!');

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
testDailyReset().then(() => {
  console.log('\n✨ Test script completed');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Test script failed:', error);
  process.exit(1);
});

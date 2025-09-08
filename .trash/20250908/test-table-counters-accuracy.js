#!/usr/bin/env node

/**
 * Test script for table counters accuracy
 * This script verifies that table counters match the actual table display
 */

const { createClient } = require('@supabase/supabase-js');

// Configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', !!SUPABASE_URL);
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', !!SUPABASE_SERVICE_ROLE_KEY);
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function testTableCountersAccuracy() {
  console.log('🧪 Testing Table Counters Accuracy...\n');

  try {
    // Get all venues
    console.log('1️⃣ Getting venues...');
    const { data: venues, error: venuesError } = await supabase
      .from('venues')
      .select('venue_id, name')
      .limit(5);

    if (venuesError) {
      console.error('❌ Error getting venues:', venuesError.message);
      return;
    }

    console.log(`✅ Found ${venues?.length || 0} venues`);

    for (const venue of venues || []) {
      console.log(`\n📊 Testing venue: ${venue.name} (${venue.venue_id})`);
      
      // Test 1: Get actual table counts
      console.log('   📋 Getting actual table counts...');
      const { data: tables, error: tablesError } = await supabase
        .from('tables')
        .select('id, label, is_active')
        .eq('venue_id', venue.venue_id)
        .eq('is_active', true);

      if (tablesError) {
        console.error('   ❌ Error getting tables:', tablesError.message);
        continue;
      }

      const actualTableCount = tables?.length || 0;
      console.log(`   ✅ Actual tables: ${actualTableCount}`);

      // Test 2: Get table sessions
      console.log('   📋 Getting table sessions...');
      const { data: sessions, error: sessionsError } = await supabase
        .from('table_sessions')
        .select('table_id, status, closed_at')
        .eq('venue_id', venue.venue_id)
        .in('table_id', tables?.map(t => t.id) || [])
        .is('closed_at', null);

      if (sessionsError) {
        console.error('   ❌ Error getting sessions:', sessionsError.message);
        continue;
      }

      const freeSessions = sessions?.filter(s => s.status === 'FREE').length || 0;
      const occupiedSessions = sessions?.filter(s => s.status === 'OCCUPIED').length || 0;
      
      console.log(`   ✅ Free sessions: ${freeSessions}`);
      console.log(`   ✅ Occupied sessions: ${occupiedSessions}`);

      // Test 3: Get API counters
      console.log('   📋 Getting API counters...');
      const { data: apiCounters, error: apiError } = await supabase.rpc('api_table_counters', {
        p_venue_id: venue.venue_id
      });

      if (apiError) {
        console.error('   ❌ Error getting API counters:', apiError.message);
        continue;
      }

      const apiCounter = apiCounters?.[0];
      if (apiCounter) {
        console.log(`   ✅ API Tables Set Up: ${apiCounter.total_tables}`);
        console.log(`   ✅ API Free Now: ${apiCounter.available}`);
        console.log(`   ✅ API In Use Now: ${apiCounter.occupied}`);
      }

      // Test 4: Get real-time counters
      console.log('   📋 Getting real-time counters...');
      const { data: realtimeCounts, error: realtimeError } = await supabase.rpc('get_realtime_table_counts', {
        p_venue_id: venue.venue_id
      });

      if (realtimeError) {
        console.error('   ❌ Error getting real-time counters:', realtimeError.message);
        continue;
      }

      if (realtimeCounts) {
        console.log(`   ✅ Realtime Tables Set Up: ${realtimeCounts.tables_set_up}`);
        console.log(`   ✅ Realtime Free Now: ${realtimeCounts.free_now}`);
        console.log(`   ✅ Realtime In Use Now: ${realtimeCounts.in_use_now}`);
      }

      // Test 5: Verify accuracy
      console.log('   🔍 Verifying accuracy...');
      const isAccurate = (
        actualTableCount === (apiCounter?.total_tables || 0) &&
        actualTableCount === (realtimeCounts?.tables_set_up || 0) &&
        freeSessions === (apiCounter?.available || 0) &&
        freeSessions === (realtimeCounts?.free_now || 0) &&
        occupiedSessions === (apiCounter?.occupied || 0) &&
        occupiedSessions === (realtimeCounts?.in_use_now || 0)
      );

      if (isAccurate) {
        console.log('   ✅ All counters are accurate!');
      } else {
        console.log('   ❌ Counter mismatch detected!');
        console.log('   📊 Summary:');
        console.log(`      Actual tables: ${actualTableCount}`);
        console.log(`      API total: ${apiCounter?.total_tables || 0}`);
        console.log(`      Realtime total: ${realtimeCounts?.tables_set_up || 0}`);
        console.log(`      Actual free: ${freeSessions}`);
        console.log(`      API free: ${apiCounter?.available || 0}`);
        console.log(`      Realtime free: ${realtimeCounts?.free_now || 0}`);
        console.log(`      Actual occupied: ${occupiedSessions}`);
        console.log(`      API occupied: ${apiCounter?.occupied || 0}`);
        console.log(`      Realtime occupied: ${realtimeCounts?.in_use_now || 0}`);
      }
    }

    console.log('\n🎉 Table counters accuracy test completed!');

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
testTableCountersAccuracy().then(() => {
  console.log('\n✨ Test script completed');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Test script failed:', error);
  process.exit(1);
});

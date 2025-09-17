/**
 * Cleanup Yesterday's Tables Script
 * 
 * This script will:
 * 1. Find your venue ID automatically
 * 2. Delete all tables created before today
 * 3. Clear associated table sessions and runtime state
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: Missing Supabase environment variables');
  console.error('Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function cleanupYesterdayTables() {
  try {
    console.log('🔍 Finding your venue...');
    
    // Find the venue (assuming there's only one, or get the first active one)
    const { data: venues, error: venueError } = await supabase
      .from('venues')
      .select('venue_id, name')
      .eq('active', true)
      .limit(1);

    if (venueError || !venues || venues.length === 0) {
      console.error('❌ Error: Could not find venue:', venueError);
      return;
    }

    const venue = venues[0];
    console.log(`✅ Found venue: ${venue.name} (ID: ${venue.venue_id})`);

    // Check what tables exist before deletion
    console.log('\n📊 Checking current tables...');
    const { data: currentTables, error: checkError } = await supabase
      .from('tables')
      .select('id, label, created_at, is_active')
      .eq('venue_id', venue.venue_id)
      .order('created_at', { ascending: false });

    if (checkError) {
      console.error('❌ Error checking tables:', checkError);
      return;
    }

    if (!currentTables || currentTables.length === 0) {
      console.log('✅ No tables found - nothing to clean up!');
      return;
    }

    // Show current tables
    console.log('\nCurrent tables:');
    currentTables.forEach(table => {
      const createdDate = new Date(table.created_at).toLocaleDateString();
      const isToday = new Date(table.created_at).toDateString() === new Date().toDateString();
      console.log(`  - ${table.label} (created: ${createdDate}) ${isToday ? '🟢 TODAY' : '🔴 YESTERDAY'}`);
    });

    // Find tables from yesterday (before today)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterdayTables = currentTables.filter(table => 
      new Date(table.created_at) < today
    );

    if (yesterdayTables.length === 0) {
      console.log('\n✅ No tables from yesterday found - nothing to clean up!');
      return;
    }

    console.log(`\n🧹 Found ${yesterdayTables.length} table(s) from yesterday to delete:`);
    yesterdayTables.forEach(table => {
      const createdDate = new Date(table.created_at).toLocaleDateString();
      console.log(`  - ${table.label} (created: ${createdDate})`);
    });

    // Step 1: Delete table sessions for old tables
    console.log('\n🗑️ Step 1: Deleting table sessions...');
    const oldTableIds = yesterdayTables.map(t => t.id);
    
    const { error: sessionsError } = await supabase
      .from('table_sessions')
      .delete()
      .eq('venue_id', venue.venue_id)
      .in('table_id', oldTableIds);

    if (sessionsError) {
      console.error('❌ Error deleting table sessions:', sessionsError);
      return;
    }
    console.log('✅ Table sessions deleted');

    // Step 2: Delete the actual tables
    console.log('\n🗑️ Step 2: Deleting tables from yesterday...');
    const { error: tablesError } = await supabase
      .from('tables')
      .delete()
      .eq('venue_id', venue.venue_id)
      .in('id', oldTableIds);

    if (tablesError) {
      console.error('❌ Error deleting tables:', tablesError);
      return;
    }
    console.log('✅ Tables from yesterday deleted');

    // Step 3: Table runtime state will update automatically 
    // (it's a view based on the tables and sessions we just deleted)
    console.log('\n✅ Step 3: Table runtime state will update automatically');

    // Final check
    console.log('\n📊 Final verification...');
    const { data: remainingTables, error: finalCheckError } = await supabase
      .from('tables')
      .select('id, label, created_at')
      .eq('venue_id', venue.venue_id);

    if (finalCheckError) {
      console.error('❌ Error in final check:', finalCheckError);
      return;
    }

    console.log(`\n🎉 Cleanup complete!`);
    console.log(`   - Deleted: ${yesterdayTables.length} table(s) from yesterday`);
    console.log(`   - Remaining: ${remainingTables?.length || 0} table(s)`);

    if (remainingTables && remainingTables.length > 0) {
      console.log('\nRemaining tables:');
      remainingTables.forEach(table => {
        const createdDate = new Date(table.created_at).toLocaleDateString();
        console.log(`  - ${table.label} (created: ${createdDate})`);
      });
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the cleanup
console.log('🚀 Starting table cleanup...\n');
cleanupYesterdayTables().then(() => {
  console.log('\n✅ Script completed');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ Script failed:', error);
  process.exit(1);
});

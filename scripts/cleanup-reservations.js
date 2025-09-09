#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function cleanupReservations() {
  try {
    console.log('🔍 Cleaning up orphaned reservations...');
    
    // Get current active tables
    const { data: tables, error: tablesError } = await supabase
      .from('tables')
      .select('id')
      .eq('venue_id', 'venue-1e02af4d')
      .eq('is_active', true);

    if (tablesError) {
      throw new Error(`Failed to fetch tables: ${tablesError.message}`);
    }

    const validTableIds = tables.map(t => t.id);
    console.log(`📊 Valid table IDs: ${validTableIds.join(', ')}`);

    // Get all reservations
    const { data: reservations, error: reservationsError } = await supabase
      .from('reservations')
      .select('*')
      .eq('venue_id', 'venue-1e02af4d');

    if (reservationsError) {
      throw new Error(`Failed to fetch reservations: ${reservationsError.message}`);
    }

    console.log(`📊 Found ${reservations.length} reservations`);

    // Find orphaned reservations (pointing to non-existent tables)
    const orphanedReservations = reservations.filter(r => 
      r.table_id && !validTableIds.includes(r.table_id)
    );

    console.log(`🚨 Found ${orphanedReservations.length} orphaned reservations:`);
    orphanedReservations.forEach((reservation, index) => {
      console.log(`   ${index + 1}. ID: ${reservation.id}, Table: ${reservation.table_id}, Status: ${reservation.status}`);
    });

    if (orphanedReservations.length > 0) {
      console.log('\n🗑️  Deleting orphaned reservations...');
      
      const orphanedIds = orphanedReservations.map(r => r.id);
      
      const { error: deleteError } = await supabase
        .from('reservations')
        .delete()
        .in('id', orphanedIds);

      if (deleteError) {
        console.error('❌ Failed to delete orphaned reservations:', deleteError.message);
      } else {
        console.log(`✅ Deleted ${orphanedReservations.length} orphaned reservations`);
      }
    }

    // Also check for reservations with null table_id that might be causing issues
    const nullTableReservations = reservations.filter(r => !r.table_id);
    console.log(`\n📊 Found ${nullTableReservations.length} reservations with null table_id`);

    if (nullTableReservations.length > 0) {
      console.log('🗑️  Deleting reservations with null table_id...');
      
      const nullTableIds = nullTableReservations.map(r => r.id);
      
      const { error: deleteError2 } = await supabase
        .from('reservations')
        .delete()
        .in('id', nullTableIds);

      if (deleteError2) {
        console.error('❌ Failed to delete null table reservations:', deleteError2.message);
      } else {
        console.log(`✅ Deleted ${nullTableReservations.length} reservations with null table_id`);
      }
    }

    console.log('\n✅ Reservation cleanup complete! Check your dashboard now.');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

cleanupReservations();

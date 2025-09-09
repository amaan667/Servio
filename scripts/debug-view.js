#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function debugView() {
  try {
    console.log('🔍 Debugging the table_runtime_state view...');
    
    // Let's check what tables are involved
    console.log('\n📊 Raw tables data:');
    const { data: tables, error: tablesError } = await supabase
      .from('tables')
      .select('*')
      .eq('venue_id', 'venue-1e02af4d')
      .eq('is_active', true);

    if (tablesError) {
      throw new Error(`Failed to fetch tables: ${tablesError.message}`);
    }

    console.log(`Found ${tables.length} tables:`);
    tables.forEach((table, index) => {
      console.log(`   ${index + 1}. ID: ${table.id}, Label: ${table.label}, Venue: ${table.venue_id}`);
    });

    // Check reservations
    console.log('\n📊 Reservations data:');
    const { data: reservations, error: reservationsError } = await supabase
      .from('reservations')
      .select('*')
      .eq('venue_id', 'venue-1e02af4d');

    if (reservationsError) {
      console.log('No reservations table or error:', reservationsError.message);
    } else {
      console.log(`Found ${reservations.length} reservations:`);
      reservations.forEach((reservation, index) => {
        console.log(`   ${index + 1}. ID: ${reservation.id}, Table: ${reservation.table_id}, Status: ${reservation.status}`);
      });
    }

    // Check if there are any other tables that might be causing the duplication
    console.log('\n📊 All table_sessions for this venue:');
    const { data: allSessions, error: allSessionsError } = await supabase
      .from('table_sessions')
      .select('*')
      .eq('venue_id', 'venue-1e02af4d');

    if (allSessionsError) {
      throw new Error(`Failed to fetch all sessions: ${allSessionsError.message}`);
    }

    console.log(`Found ${allSessions.length} table sessions:`);
    allSessions.forEach((session, index) => {
      console.log(`   ${index + 1}. ID: ${session.id}, Table: ${session.table_id}, Status: ${session.status}`);
    });

    // Let's try to understand the view by checking what might be causing the duplication
    console.log('\n🔍 Checking for any other related data...');
    
    // Check if there are any other tables that might be joined in the view
    const { data: viewData, error: viewError } = await supabase
      .rpc('exec_sql', { 
        sql: `
          SELECT 
            t.id as table_id,
            t.venue_id,
            t.label,
            t.seat_count,
            t.is_active,
            ts.id as session_id,
            ts.status as primary_status,
            ts.opened_at,
            ts.server_id,
            r.id as reserved_now_id,
            r.start_at as reserved_now_start,
            r.end_at as reserved_now_end,
            r.party_size as reserved_now_party_size,
            r.name as reserved_now_name,
            r.phone as reserved_now_phone
          FROM tables t
          LEFT JOIN table_sessions ts ON t.id = ts.table_id AND ts.venue_id = t.venue_id
          LEFT JOIN reservations r ON t.id = r.table_id AND r.venue_id = t.venue_id
          WHERE t.venue_id = 'venue-1e02af4d' 
            AND t.is_active = true
          ORDER BY t.label, ts.created_at DESC, r.created_at DESC
        `
      });

    if (viewError) {
      console.log('Cannot execute custom SQL:', viewError.message);
    } else {
      console.log(`Custom query returned ${viewData.length} rows:`);
      viewData.forEach((row, index) => {
        console.log(`   ${index + 1}. Table: ${row.label}, Session: ${row.session_id}, Reservation: ${row.reserved_now_id}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

debugView();

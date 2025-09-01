#!/usr/bin/env node

/**
 * Debug script to check orders in database
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://cpwemmofzjfzbmqcgjrq.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwd2VtbW9mempmemJtcWNnanJxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDU4Mjk0MSwiZXhwIjoyMDcwMTU4OTQxfQ.jkhF0M-V19lDfdHtaCq3Sm4KJv0oiI5BhvsFWhw8woc';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function debugOrders() {
  console.log('🔍 Debugging orders in database...\n');

  try {
    // 1. Check all venues
    console.log('1️⃣ Checking venues...');
    const { data: venues, error: venuesError } = await supabase
      .from('venues')
      .select('venue_id, name, owner_id')
      .limit(10);

    if (venuesError) {
      console.log('❌ Venues error:', venuesError.message);
    } else {
      console.log('✅ Venues found:', venues.length);
      venues.forEach(venue => {
        console.log(`   - ${venue.venue_id}: ${venue.name} (owner: ${venue.owner_id})`);
      });
    }

    // 2. Check all orders
    console.log('\n2️⃣ Checking all orders...');
    const { data: allOrders, error: allOrdersError } = await supabase
      .from('orders')
      .select('id, venue_id, order_status, total_amount, created_at')
      .limit(10);

    if (allOrdersError) {
      console.log('❌ All orders error:', allOrdersError.message);
    } else {
      console.log('✅ All orders found:', allOrders.length);
      allOrders.forEach(order => {
        console.log(`   - ${order.id}: venue=${order.venue_id}, status=${order.order_status}, amount=${order.total_amount}, created=${order.created_at}`);
      });
    }

    // 3. Check orders by specific venue (if we have venues)
    if (venues && venues.length > 0) {
      const testVenueId = 'venue-1e02af4d'; // Cafe Nur - the one with orders
      console.log(`\n3️⃣ Checking orders for venue: ${testVenueId}`);
      
      const { data: venueOrders, error: venueOrdersError } = await supabase
        .from('orders')
        .select('*')
        .eq('venue_id', testVenueId)
        .limit(5);

      if (venueOrdersError) {
        console.log('❌ Venue orders error:', venueOrdersError.message);
      } else {
        console.log('✅ Venue orders found:', venueOrders.length);
        venueOrders.forEach(order => {
          console.log(`   - ${order.id}: status=${order.order_status}, amount=${order.total_amount}`);
        });
      }

      // 4. Test the specific queries used in LiveOrdersClient
      console.log(`\n4️⃣ Testing LiveOrdersClient queries for venue: ${testVenueId}`);
      
      // Check venue ownership
      const { data: venueDetails, error: venueDetailsError } = await supabase
        .from('venues')
        .select('venue_id, name, owner_id')
        .eq('venue_id', testVenueId)
        .single();
      
      if (venueDetailsError) {
        console.log('❌ Venue details error:', venueDetailsError.message);
      } else {
        console.log('   Venue details:', venueDetails);
      }
      
      // Test live orders query
      const LIVE_STATUSES = ['PLACED', 'ACCEPTED', 'IN_PREP', 'READY', 'OUT_FOR_DELIVERY', 'SERVING'];
      const { data: liveOrders, error: liveError } = await supabase
        .from('orders')
        .select('*')
        .eq('venue_id', testVenueId)
        .in('order_status', LIVE_STATUSES)
        .order('updated_at', { ascending: false });

      console.log('   Live orders query result:', { 
        count: liveOrders?.length || 0, 
        error: liveError?.message || 'none',
        orders: liveOrders?.map(o => ({ id: o.id, status: o.order_status, amount: o.total_amount })) || []
      });

      // Test today orders query
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const { data: todayOrders, error: todayError } = await supabase
        .from('orders')
        .select('*')
        .eq('venue_id', testVenueId)
        .gte('created_at', today.toISOString())
        .lt('created_at', tomorrow.toISOString())
        .order('created_at', { ascending: false });

      console.log('   Today orders query result:', { 
        count: todayOrders?.length || 0, 
        error: todayError?.message || 'none',
        orders: todayOrders?.map(o => ({ id: o.id, status: o.order_status, amount: o.total_amount, created: o.created_at })) || []
      });
    }

  } catch (error) {
    console.error('❌ Error debugging orders:', error);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  debugOrders();
}

module.exports = { debugOrders };

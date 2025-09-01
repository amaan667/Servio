#!/usr/bin/env node

/**
 * Test script to verify all Servio MVP fixes
 * Run this after applying the database and code fixes
 */

const { createClient } = require('@supabase/supabase-js');

// Configuration - update these with your actual values
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key';
const VENUE_ID = process.env.TEST_VENUE_ID || 'demo-cafe';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testFixes() {
  console.log('🧪 Testing Servio MVP fixes...\n');

  try {
    // Test 1: Check if orders_with_totals view exists and works
    console.log('1️⃣ Testing orders_with_totals view...');
    const { data: viewData, error: viewError } = await supabase
      .from('orders_with_totals')
      .select('id, total_amount, subtotal_amount')
      .limit(1);
    
    if (viewError) {
      console.log('❌ orders_with_totals view test failed:', viewError.message);
    } else {
      console.log('✅ orders_with_totals view working correctly');
      if (viewData && viewData.length > 0) {
        console.log('   Sample data:', viewData[0]);
      }
    }

    // Test 2: Check live orders query
    console.log('\n2️⃣ Testing live orders query...');
    const LIVE_STATUSES = ['PLACED', 'ACCEPTED', 'IN_PREP', 'READY', 'OUT_FOR_DELIVERY', 'SERVING'];
    const { data: liveData, error: liveError } = await supabase
      .from('orders_with_totals')
      .select('*')
      .eq('venue_id', VENUE_ID)
      .in('order_status', LIVE_STATUSES)
      .order('updated_at', { ascending: false });

    if (liveError) {
      console.log('❌ Live orders query failed:', liveError.message);
    } else {
      console.log(`✅ Live orders query working correctly (${liveData?.length || 0} orders found)`);
      if (liveData && liveData.length > 0) {
        console.log('   Sample live order:', {
          id: liveData[0].id,
          status: liveData[0].order_status,
          total: liveData[0].total_amount
        });
      }
    }

    // Test 3: Check all today orders query
    console.log('\n3️⃣ Testing all today orders query...');
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();
    
    const { data: todayData, error: todayError } = await supabase
      .from('orders_with_totals')
      .select('*')
      .eq('venue_id', VENUE_ID)
      .gte('created_at', startOfDay)
      .lt('created_at', endOfDay)
      .order('created_at', { ascending: false });

    if (todayError) {
      console.log('❌ All today orders query failed:', todayError.message);
    } else {
      console.log(`✅ All today orders query working correctly (${todayData?.length || 0} orders found)`);
      if (todayData && todayData.length > 0) {
        console.log('   Sample today order:', {
          id: todayData[0].id,
          status: todayData[0].order_status,
          total: todayData[0].total_amount
        });
      }
    }

    // Test 4: Check history orders query
    console.log('\n4️⃣ Testing history orders query...');
    const { data: historyData, error: historyError } = await supabase
      .from('orders_with_totals')
      .select('*')
      .eq('venue_id', VENUE_ID)
      .in('order_status', ['COMPLETED', 'CANCELLED', 'REFUNDED', 'EXPIRED'])
      .lt('created_at', startOfDay)
      .order('created_at', { ascending: false })
      .limit(5);

    if (historyError) {
      console.log('❌ History orders query failed:', historyError.message);
    } else {
      console.log(`✅ History orders query working correctly (${historyData?.length || 0} orders found)`);
      if (historyData && historyData.length > 0) {
        console.log('   Sample history order:', {
          id: historyData[0].id,
          status: historyData[0].order_status,
          total: historyData[0].total_amount
        });
      }
    }

    // Test 5: Check order status values
    console.log('\n5️⃣ Testing order status values...');
    const { data: statusData, error: statusError } = await supabase
      .from('orders')
      .select('order_status, payment_status')
      .eq('venue_id', VENUE_ID)
      .limit(10);

    if (statusError) {
      console.log('❌ Order status check failed:', statusError.message);
    } else {
      const validOrderStatuses = ['PLACED', 'ACCEPTED', 'IN_PREP', 'READY', 'OUT_FOR_DELIVERY', 'SERVING', 'COMPLETED', 'CANCELLED', 'REFUNDED', 'EXPIRED'];
      const validPaymentStatuses = ['UNPAID', 'IN_PROGRESS', 'PAID', 'REFUNDED'];
      
      const invalidOrderStatuses = statusData?.filter(order => !validOrderStatuses.includes(order.order_status)) || [];
      const invalidPaymentStatuses = statusData?.filter(order => !validPaymentStatuses.includes(order.payment_status)) || [];
      
      if (invalidOrderStatuses.length === 0 && invalidPaymentStatuses.length === 0) {
        console.log('✅ All order statuses are valid');
      } else {
        console.log('⚠️  Some invalid statuses found:');
        if (invalidOrderStatuses.length > 0) {
          console.log('   Invalid order_status:', [...new Set(invalidOrderStatuses.map(o => o.order_status))]);
        }
        if (invalidPaymentStatuses.length > 0) {
          console.log('   Invalid payment_status:', [...new Set(invalidPaymentStatuses.map(o => o.payment_status))]);
        }
      }
    }

    // Test 6: Check total amounts
    console.log('\n6️⃣ Testing total amounts...');
    const { data: totalData, error: totalError } = await supabase
      .from('orders_with_totals')
      .select('id, total_amount, subtotal_amount')
      .eq('venue_id', VENUE_ID)
      .limit(5);

    if (totalError) {
      console.log('❌ Total amounts check failed:', totalError.message);
    } else {
      const zeroTotals = totalData?.filter(order => order.total_amount === 0) || [];
      if (zeroTotals.length === 0) {
        console.log('✅ All orders have non-zero totals');
      } else {
        console.log(`⚠️  ${zeroTotals.length} orders have zero totals`);
        console.log('   Sample zero total order:', zeroTotals[0]);
      }
    }

    console.log('\n🎉 All tests completed!');
    
    // Summary
    console.log('\n📊 Summary:');
    console.log('   - Live orders:', liveData?.length || 0);
    console.log('   - Today orders:', todayData?.length || 0);
    console.log('   - History orders:', historyData?.length || 0);
    console.log('   - Total orders in view:', viewData?.length || 0);

  } catch (error) {
    console.error('❌ Test failed with error:', error);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  testFixes();
}

module.exports = { testFixes };

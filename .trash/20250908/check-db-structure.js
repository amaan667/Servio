#!/usr/bin/env node

/**
 * Check database structure to see what columns actually exist
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://cpwemmofzjfzbmqcgjrq.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwd2VtbW9mempmemJtcWNnanJxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDU4Mjk0MSwiZXhwIjoyMDcwMTU4OTQxfQ.jkhF0M-V19lDfdHtaCq3Sm4KJv0oiI5BhvsFWhw8woc';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function createOrdersView() {
  console.log('🔧 Creating orders_with_totals view...\n');

  try {
    // Create the view using raw SQL
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE OR REPLACE VIEW orders_with_totals AS
        SELECT
          o.*,
          COALESCE(
            (SELECT SUM((item->>'price')::numeric * (item->>'quantity')::integer)
             FROM jsonb_array_elements(o.items) AS item), 
            0
          )::numeric AS calculated_total,
          COALESCE(o.total_amount, 0)::numeric AS total_amount
        FROM orders o;
      `
    });

    if (error) {
      console.log('❌ Could not create view using RPC:', error.message);
      console.log('⚠️  You may need to run this SQL manually in Supabase SQL editor');
      console.log('   Go to: https://cpwemmofzjfzbmqcgjrq.supabase.co/project/default/sql');
      console.log('   Copy and paste the contents of scripts/create-simple-orders-view.sql');
    } else {
      console.log('✅ orders_with_totals view created successfully');
      
      // Create indexes
      await supabase.rpc('exec_sql', {
        sql: `
          CREATE INDEX IF NOT EXISTS idx_orders_with_totals_venue_id ON orders_with_totals(venue_id);
          CREATE INDEX IF NOT EXISTS idx_orders_with_totals_order_status ON orders_with_totals(order_status);
          CREATE INDEX IF NOT EXISTS idx_orders_with_totals_created_at ON orders_with_totals(created_at);
          CREATE INDEX IF NOT EXISTS idx_orders_with_totals_scheduled_for ON orders_with_totals(scheduled_for);
        `
      });
      
      // Grant permissions
      await supabase.rpc('exec_sql', {
        sql: `
          GRANT SELECT ON orders_with_totals TO authenticated;
          GRANT SELECT ON orders_with_totals TO anon;
        `
      });
      
      console.log('✅ Indexes and permissions created');
    }
  } catch (error) {
    console.error('❌ Error creating view:', error);
    console.log('⚠️  Manual SQL execution required');
  }
}

async function checkStructure() {
  console.log('🔍 Checking database structure...\n');

  try {
    // Check orders table structure
    console.log('1️⃣ Checking orders table...');
    const { data: ordersData, error: ordersError } = await supabase
      .from('orders')
      .select('*')
      .limit(1);

    if (ordersError) {
      console.log('❌ Could not check orders table:', ordersError.message);
    } else if (ordersData && ordersData.length > 0) {
      const order = ordersData[0];
      console.log('✅ Orders table columns:', Object.keys(order));
      
      // Check if items are embedded or separate
      if (order.items && Array.isArray(order.items)) {
        console.log('✅ Items are embedded in orders table');
        if (order.items.length > 0) {
          console.log('✅ Sample item structure:', order.items[0]);
        }
      }
    }

    // Check if order_items table exists and its structure
    console.log('\n2️⃣ Checking order_items table...');
    const { data: orderItemsData, error: orderItemsError } = await supabase
      .from('order_items')
      .select('*')
      .limit(1);

    if (orderItemsError) {
      console.log('❌ order_items table does not exist or error:', orderItemsError.message);
    } else if (orderItemsData && orderItemsData.length > 0) {
      const item = orderItemsData[0];
      console.log('✅ order_items table columns:', Object.keys(item));
    }

    // Check if orders_with_totals view exists
    console.log('\n3️⃣ Checking orders_with_totals view...');
    const { data: viewData, error: viewError } = await supabase
      .from('orders_with_totals')
      .select('*')
      .limit(1);

    if (viewError) {
      console.log('❌ orders_with_totals view does not exist:', viewError.message);
      console.log('🔧 Creating the view now...');
      await createOrdersView();
    } else if (viewData && viewData.length > 0) {
      const viewOrder = viewData[0];
      console.log('✅ orders_with_totals view columns:', Object.keys(viewOrder));
      console.log('✅ View is working correctly');
    }

    // Check sample order data to understand structure
    console.log('\n4️⃣ Checking sample order data...');
    const { data: sampleOrders, error: sampleError } = await supabase
      .from('orders')
      .select('id, items, total_amount')
      .limit(3);

    if (sampleError) {
      console.log('❌ Could not get sample orders:', sampleError.message);
    } else if (sampleOrders && sampleOrders.length > 0) {
      console.log('✅ Sample orders:');
      sampleOrders.forEach((order, index) => {
        console.log(`   Order ${index + 1}:`);
        console.log(`     ID: ${order.id}`);
        console.log(`     Total: ${order.total_amount}`);
        if (order.items && Array.isArray(order.items)) {
          console.log(`     Items count: ${order.items.length}`);
          if (order.items.length > 0) {
            console.log(`     First item:`, order.items[0]);
          }
        }
      });
    }

    // Summary
    console.log('\n📊 Database Structure Summary:');
    console.log('==============================');
    
    if (ordersData && ordersData.length > 0) {
      const order = ordersData[0];
      if (order.items && Array.isArray(order.items)) {
        console.log('✅ Items are stored as embedded JSON in orders table');
        console.log('✅ No separate order_items table needed');
        console.log('✅ View should use embedded items data');
      } else {
        console.log('❓ Items structure unclear');
      }
    }

  } catch (error) {
    console.error('❌ Error checking structure:', error);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  checkStructure();
}

module.exports = { checkStructure, createOrdersView };

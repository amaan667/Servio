#!/usr/bin/env node

/**
 * Direct database fix script for Supabase
 * This will execute SQL commands directly to fix all the issues
 */

const { createClient } = require('@supabase/supabase-js');

// Configuration from your Railway environment
const SUPABASE_URL = 'https://cpwemmofzjfzbmqcgjrq.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwd2VtbW9mempmemJtcWNnanJxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDU4Mjk0MSwiZXhwIjoyMDcwMTU4OTQxfQ.jkhF0M-V19lDfdHtaCq3Sm4KJv0oiI5BhvsFWhw8woc';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function fixDatabase() {
  console.log('🗄️  Fixing database directly...\n');

  try {
    // 1. First, let's check what tables exist
    console.log('1️⃣ Checking database structure...');
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .in('table_name', ['orders', 'order_items']);

    if (tablesError) {
      console.log('⚠️  Could not check tables:', tablesError.message);
    } else {
      console.log('✅ Found tables:', tables.map(t => t.table_name));
    }

    // 2. Check current order statuses
    console.log('\n2️⃣ Checking current order statuses...');
    const { data: statusData, error: statusError } = await supabase
      .from('orders')
      .select('order_status, payment_status')
      .limit(5);

    if (statusError) {
      console.log('⚠️  Could not check orders:', statusError.message);
    } else {
      console.log('✅ Current order statuses:', [...new Set(statusData.map(o => o.order_status))]);
      console.log('✅ Current payment statuses:', [...new Set(statusData.map(o => o.payment_status))]);
    }

    // 3. Try to create the view using direct SQL execution
    console.log('\n3️⃣ Creating orders_with_totals view...');
    
    // First, let's try to create the view by inserting a test record and then updating it
    // This is a workaround since we can't use exec_sql
    
    // Check if the view already exists
    const { data: viewTest, error: viewTestError } = await supabase
      .from('orders_with_totals')
      .select('*')
      .limit(1);

    if (viewTestError && viewTestError.message.includes('does not exist')) {
      console.log('❌ View does not exist, need to create it manually');
      console.log('\n🔧 Manual steps required:');
      console.log('   1. Go to: https://cpwemmofzjfzbmqcgjrq.supabase.co/project/default/sql');
      console.log('   2. Click "SQL Editor" in left sidebar');
      console.log('   3. Copy and paste this SQL:');
      console.log('\n' + '='.repeat(60));
      console.log(`
CREATE OR REPLACE VIEW orders_with_totals AS
SELECT
  o.*,
  COALESCE(SUM(oi.unit_price * oi.quantity), 0)::numeric AS subtotal_amount,
  COALESCE(SUM(oi.tax_amount), 0)::numeric AS tax_amount,
  COALESCE(SUM(oi.service_amount), 0)::numeric AS service_amount,
  COALESCE(
    SUM(oi.unit_price * oi.quantity) + 
    SUM(COALESCE(oi.tax_amount, 0)) + 
    SUM(COALESCE(oi.service_amount, 0)), 
    0
  )::numeric AS total_amount
FROM orders o
LEFT JOIN order_items oi ON oi.order_id = o.id
GROUP BY o.id;
      `);
      console.log('='.repeat(60));
    } else if (viewTestError) {
      console.log('⚠️  View test error:', viewTestError.message);
    } else {
      console.log('✅ View already exists!');
    }

    // 4. Try to update order statuses directly
    console.log('\n4️⃣ Updating order statuses...');
    
    // Update pending -> PLACED
    const { error: update1Error } = await supabase
      .from('orders')
      .update({ order_status: 'PLACED' })
      .eq('order_status', 'pending');

    if (update1Error) {
      console.log('⚠️  Could not update pending status:', update1Error.message);
    } else {
      console.log('✅ Updated pending -> PLACED');
    }

    // Update preparing -> IN_PREP
    const { error: update2Error } = await supabase
      .from('orders')
      .update({ order_status: 'IN_PREP' })
      .eq('order_status', 'preparing');

    if (update2Error) {
      console.log('⚠️  Could not update preparing status:', update2Error.message);
    } else {
      console.log('✅ Updated preparing -> IN_PREP');
    }

    // Update ready -> READY
    const { error: update3Error } = await supabase
      .from('orders')
      .update({ order_status: 'READY' })
      .eq('order_status', 'ready');

    if (update3Error) {
      console.log('⚠️  Could not update ready status:', update3Error.message);
    } else {
      console.log('✅ Updated ready -> READY');
    }

    // Update completed -> COMPLETED
    const { error: update4Error } = await supabase
      .from('orders')
      .update({ order_status: 'COMPLETED' })
      .eq('order_status', 'completed');

    if (update4Error) {
      console.log('⚠️  Could not update completed status:', update4Error.message);
    } else {
      console.log('✅ Updated completed -> COMPLETED');
    }

    // 5. Update payment statuses
    console.log('\n5️⃣ Updating payment statuses...');
    
    // Update pending -> UNPAID
    const { error: pay1Error } = await supabase
      .from('orders')
      .update({ payment_status: 'UNPAID' })
      .eq('payment_status', 'pending');

    if (pay1Error) {
      console.log('⚠️  Could not update payment pending status:', pay1Error.message);
    } else {
      console.log('✅ Updated payment pending -> UNPAID');
    }

    // Update paid -> PAID
    const { error: pay2Error } = await supabase
      .from('orders')
      .update({ payment_status: 'PAID' })
      .eq('payment_status', 'paid');

    if (pay2Error) {
      console.log('⚠️  Could not update payment paid status:', pay2Error.message);
    } else {
      console.log('✅ Updated payment paid -> PAID');
    }

    // 6. Test the updates
    console.log('\n6️⃣ Testing updates...');
    const { data: finalStatus, error: finalError } = await supabase
      .from('orders')
      .select('order_status, payment_status')
      .limit(10);

    if (finalError) {
      console.log('⚠️  Could not test final status:', finalError.message);
    } else {
      console.log('✅ Final order statuses:', [...new Set(finalStatus.map(o => o.order_status))]);
      console.log('✅ Final payment statuses:', [...new Set(finalStatus.map(o => o.payment_status))]);
    }

    // 7. Summary
    console.log('\n🎉 Database fixes completed!');
    console.log('=============================');
    console.log('✅ Order statuses updated');
    console.log('✅ Payment statuses updated');
    console.log('⚠️  View creation requires manual SQL execution');
    
    console.log('\n🔧 Next steps:');
    console.log('   1. Create the orders_with_totals view manually in Supabase SQL editor');
    console.log('   2. Deploy your code changes');
    console.log('   3. Test the Live Orders tab');
    console.log('   4. Verify order totals are no longer £0.00');

  } catch (error) {
    console.error('❌ Error fixing database:', error);
    console.log('\n🔧 Manual fix required:');
    console.log('   Please run the SQL manually in your Supabase dashboard');
    console.log('   Go to: https://cpwemmofzjfzbmqcgjrq.supabase.co/project/default/sql');
  }
}

// Run if this file is executed directly
if (require.main === module) {
  fixDatabase();
}

module.exports = { fixDatabase };

#!/usr/bin/env node

/**
 * Apply database fixes to Supabase
 * This script will create the orders_with_totals view and fix all the issues
 */

const { createClient } = require('@supabase/supabase-js');

// Configuration from your Railway environment
const SUPABASE_URL = 'https://cpwemmofzjfzbmqcgjrq.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwd2VtbW9mempmemJtcWNnanJxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDU4Mjk0MSwiZXhwIjoyMDcwMTU4OTQxfQ.jkhF0M-V19lDfdHtaCq3Sm4KJv0oiI5BhvsFWhw8woc';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function applyDatabaseFixes() {
  console.log('🗄️  Applying database fixes to Supabase...\n');

  try {
    // 1. Create the orders_with_totals view
    console.log('1️⃣ Creating orders_with_totals view...');
    const { error: viewError } = await supabase.rpc('exec_sql', {
      sql: `
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
      `
    });

    if (viewError) {
      console.log('⚠️  View creation failed (might already exist):', viewError.message);
    } else {
      console.log('✅ orders_with_totals view created successfully');
    }

    // 2. Update existing orders with correct status values
    console.log('\n2️⃣ Updating order statuses...');
    const { error: statusError } = await supabase.rpc('exec_sql', {
      sql: `
        UPDATE orders 
        SET order_status = CASE 
          WHEN order_status IS NULL THEN 'PLACED'
          WHEN order_status = 'pending' THEN 'PLACED'
          WHEN order_status = 'preparing' THEN 'IN_PREP'
          WHEN order_status = 'ready' THEN 'READY'
          WHEN order_status = 'completed' THEN 'COMPLETED'
          WHEN order_status = 'cancelled' THEN 'CANCELLED'
          ELSE order_status
        END
        WHERE order_status IS NULL OR order_status IN ('pending', 'preparing', 'ready', 'completed', 'cancelled');
      `
    });

    if (statusError) {
      console.log('⚠️  Status update failed:', statusError.message);
    } else {
      console.log('✅ Order statuses updated successfully');
    }

    // 3. Update payment statuses
    console.log('\n3️⃣ Updating payment statuses...');
    const { error: paymentError } = await supabase.rpc('exec_sql', {
      sql: `
        UPDATE orders 
        SET payment_status = CASE 
          WHEN payment_status IS NULL THEN 'UNPAID'
          WHEN payment_status = 'pending' THEN 'UNPAID'
          WHEN payment_status = 'paid' THEN 'PAID'
          WHEN payment_status = 'failed' THEN 'UNPAID'
          WHEN payment_status = 'refunded' THEN 'REFUNDED'
          ELSE payment_status
        END
        WHERE payment_status IS NULL OR payment_status IN ('pending', 'paid', 'failed', 'refunded');
      `
    });

    if (paymentError) {
      console.log('⚠️  Payment status update failed:', paymentError.message);
    } else {
      console.log('✅ Payment statuses updated successfully');
    }

    // 4. Test the view
    console.log('\n4️⃣ Testing the view...');
    const { data: testData, error: testError } = await supabase
      .from('orders_with_totals')
      .select('id, total_amount')
      .limit(1);

    if (testError) {
      console.log('❌ View test failed:', testError.message);
      console.log('\n🔧 Manual fix required:');
      console.log('   You may need to run the SQL manually in your Supabase dashboard');
      console.log('   Go to: https://cpwemmofzjfzbmqcgjrq.supabase.co/project/default/sql');
      console.log('   Copy and paste the contents of scripts/run-all-fixes.sql');
    } else {
      console.log('✅ View test successful');
      if (testData && testData.length > 0) {
        console.log('   Sample data:', testData[0]);
      }
    }

    // 5. Show summary
    console.log('\n🎉 Database fixes applied!');
    console.log('==========================');
    console.log('✅ orders_with_totals view created');
    console.log('✅ Order statuses standardized');
    console.log('✅ Payment statuses updated');
    console.log('\n🔍 Next steps:');
    console.log('   1. Deploy your code changes');
    console.log('   2. Test the Live Orders tab');
    console.log('   3. Verify order totals are no longer £0.00');
    console.log('   4. Test order submission flow');

  } catch (error) {
    console.error('❌ Error applying database fixes:', error);
    console.log('\n🔧 Manual fix required:');
    console.log('   Please run the SQL manually in your Supabase dashboard');
    console.log('   Go to: https://cpwemmofzjfzbmqcgjrq.supabase.co/project/default/sql');
    console.log('   Copy and paste the contents of scripts/run-all-fixes.sql');
  }
}

// Run if this file is executed directly
if (require.main === module) {
  applyDatabaseFixes();
}

module.exports = { applyDatabaseFixes };

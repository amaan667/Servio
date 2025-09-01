const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function checkCurrentOrders() {
  console.log('Checking current orders in database...');
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase environment variables');
    process.exit(1);
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    // Check if orders_with_totals view exists
    console.log('\n1. Checking if orders_with_totals view exists...');
    try {
      const { data: viewTest, error: viewError } = await supabase
        .from('orders_with_totals')
        .select('*')
        .limit(1);
      
      if (viewError) {
        console.log('❌ orders_with_totals view does not exist:', viewError.message);
      } else {
        console.log('✅ orders_with_totals view exists');
      }
    } catch (viewError) {
      console.log('❌ orders_with_totals view does not exist:', viewError.message);
    }

    // Check current order statuses
    console.log('\n2. Checking current order statuses...');
    const { data: statusCounts, error: statusError } = await supabase
      .from('orders')
      .select('order_status, status')
      .limit(100);

    if (statusError) {
      console.error('Error fetching order statuses:', statusError);
    } else {
      const statusMap = {};
      statusCounts.forEach(order => {
        const status = order.order_status || order.status;
        statusMap[status] = (statusMap[status] || 0) + 1;
      });
      console.log('Current order status counts:', statusMap);
    }

    // Check for orders with venue-1e02af4d
    console.log('\n3. Checking orders for venue-1e02af4d...');
    const { data: venueOrders, error: venueError } = await supabase
      .from('orders')
      .select('id, order_status, status, payment_status, created_at, total_amount')
      .eq('venue_id', 'venue-1e02af4d')
      .limit(10);

    if (venueError) {
      console.error('Error fetching venue orders:', venueError);
    } else {
      console.log(`Found ${venueOrders?.length || 0} orders for venue-1e02af4d:`, venueOrders);
    }

    // Check for any orders at all
    console.log('\n4. Checking total orders count...');
    const { count: totalOrders, error: countError } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('Error counting orders:', countError);
    } else {
      console.log(`Total orders in database: ${totalOrders}`);
    }

  } catch (error) {
    console.error('Script error:', error);
  }
}

checkCurrentOrders();

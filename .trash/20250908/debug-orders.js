const { createClient } = require('@supabase/supabase-js');
const path = require('path');

// Load .env.local file specifically
require('dotenv').config({ path: path.resolve(process.cwd(), '.env.local') });

async function debugOrders() {
  console.log('🔍 Debugging orders in database...');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase environment variables');
    console.log('Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // 1. Check total orders count
    console.log('\n📊 1. Total orders count...');
    const { count: totalOrders, error: countError } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('❌ Error counting orders:', countError);
    } else {
      console.log(`✅ Total orders: ${totalOrders}`);
    }

    // 2. Check orders for specific venue
    console.log('\n🏪 2. Orders for venue-1e02af4d...');
    const { data: venueOrders, error: venueError } = await supabase
      .from('orders')
      .select('id, order_status, status, payment_status, created_at, total_amount, venue_id')
      .eq('venue_id', 'venue-1e02af4d')
      .order('created_at', { ascending: false });

    if (venueError) {
      console.error('❌ Error fetching venue orders:', venueError);
    } else {
      console.log(`✅ Found ${venueOrders?.length || 0} orders for venue-1e02af4d`);
      
      if (venueOrders && venueOrders.length > 0) {
        console.log('\n📋 Sample orders:');
        venueOrders.slice(0, 5).forEach((order, index) => {
          console.log(`  ${index + 1}. ID: ${order.id.slice(0, 8)}...`);
          console.log(`     Status: ${order.order_status || 'N/A'} (order_status) / ${order.status || 'N/A'} (status)`);
          console.log(`     Payment: ${order.payment_status || 'N/A'}`);
          console.log(`     Created: ${order.created_at}`);
          console.log(`     Amount: ${order.total_amount || 'N/A'}`);
          console.log('');
        });
      }
    }

    // 3. Check status distribution
    console.log('\n📈 3. Status distribution...');
    const { data: allOrders, error: allError } = await supabase
      .from('orders')
      .select('order_status, status, payment_status, created_at');

    if (allError) {
      console.error('❌ Error fetching all orders for status analysis:', allError);
    } else {
      const statusCounts = {};
      const paymentCounts = {};
      const dateCounts = {};

      allOrders.forEach(order => {
        const status = order.order_status || order.status || 'UNKNOWN';
        const payment = order.payment_status || 'UNKNOWN';
        const date = new Date(order.created_at).toISOString().split('T')[0];
        
        statusCounts[status] = (statusCounts[status] || 0) + 1;
        paymentCounts[payment] = (paymentCounts[payment] || 0) + 1;
        dateCounts[date] = (dateCounts[date] || 0) + 1;
      });

      console.log('📊 Status counts:', statusCounts);
      console.log('💰 Payment status counts:', paymentCounts);
      console.log('📅 Recent dates:', Object.keys(dateCounts).sort().reverse().slice(0, 5));
    }

    // 4. Check for today's orders (Europe/London timezone)
    console.log('\n🌍 4. Today\'s orders (Europe/London timezone)...');
    const now = new Date();
    const londonTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/London' }));
    const todayStart = new Date(londonTime.getFullYear(), londonTime.getMonth(), londonTime.getDate());
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayStart.getDate() + 1);
    
    console.log(`   London time: ${londonTime.toISOString()}`);
    console.log(`   Today bounds: ${todayStart.toISOString()} to ${todayEnd.toISOString()}`);

    const { data: todayOrders, error: todayError } = await supabase
      .from('orders')
      .select('id, order_status, status, payment_status, created_at, total_amount')
      .gte('created_at', todayStart.toISOString())
      .lt('created_at', todayEnd.toISOString())
      .order('created_at', { ascending: false });

    if (todayError) {
      console.error('❌ Error fetching today\'s orders:', todayError);
    } else {
      console.log(`✅ Found ${todayOrders?.length || 0} orders for today`);
      
      if (todayOrders && todayOrders.length > 0) {
        console.log('\n📋 Today\'s orders:');
        todayOrders.forEach((order, index) => {
          console.log(`  ${index + 1}. ID: ${order.id.slice(0, 8)}...`);
          console.log(`     Status: ${order.order_status || 'N/A'} (order_status) / ${order.status || 'N/A'} (status)`);
          console.log(`     Payment: ${order.payment_status || 'N/A'}`);
          console.log(`     Created: ${order.created_at}`);
          console.log(`     Amount: ${order.total_amount || 'N/A'}`);
        });
      }
    }

    // 5. Check if orders_with_totals view exists
    console.log('\n🔍 5. Checking orders_with_totals view...');
    try {
      const { data: viewTest, error: viewError } = await supabase
        .from('orders_with_totals')
        .select('id')
        .limit(1);

      if (viewError) {
        console.log('❌ orders_with_totals view does not exist:', viewError.message);
      } else {
        console.log('✅ orders_with_totals view exists');
        
        // Test a query on the view
        const { data: viewData, error: viewQueryError } = await supabase
          .from('orders_with_totals')
          .select('id, order_status, calc_total_amount')
          .limit(3);

        if (viewQueryError) {
          console.log('❌ Error querying view:', viewQueryError.message);
        } else {
          console.log('✅ View query successful, sample data:', viewData);
        }
      }
    } catch (viewError) {
      console.log('❌ orders_with_totals view does not exist:', viewError.message);
    }

  } catch (error) {
    console.error('❌ Script error:', error);
  }
}

debugOrders();

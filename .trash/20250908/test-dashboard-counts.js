#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

async function testDashboardCounts() {
  console.log('🧪 Testing dashboard_counts function...');
  
  // Check environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing environment variables');
    console.error('Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  
  try {
    // Create Supabase client with service role key
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    console.log('✅ Connected to Supabase');
    
    // Test 1: Check if we can access the orders table
    console.log('\n📊 Test 1: Checking orders table access...');
    const { data: ordersTest, error: ordersError } = await supabase
      .from('orders')
      .select('id, venue_id, order_status')
      .eq('venue_id', 'venue-1e02af4d')
      .limit(5);
    
    if (ordersError) {
      console.error('❌ Orders table access failed:', ordersError.message);
    } else {
      console.log('✅ Orders table access successful');
      console.log(`   Found ${ordersTest?.length || 0} orders for venue-1e02af4d`);
      if (ordersTest && ordersTest.length > 0) {
        console.log('   Sample orders:', ordersTest.slice(0, 2));
      }
    }
    
    // Test 2: Test the dashboard_counts function
    console.log('\n📊 Test 2: Testing dashboard_counts function...');
    const { data: countsData, error: countsError } = await supabase
      .rpc('dashboard_counts', { 
        p_venue_id: 'venue-1e02af4d', 
        p_tz: 'Europe/London', 
        p_live_window_mins: 30 
      })
      .single();
    
    if (countsError) {
      console.error('❌ dashboard_counts function failed:', countsError.message);
      console.error('   Error details:', countsError);
    } else {
      console.log('✅ dashboard_counts function successful!');
      console.log('   Results:', countsData);
      console.log(`   - Live orders: ${countsData.live_count}`);
      console.log(`   - Earlier today: ${countsData.earlier_today_count}`);
      console.log(`   - History: ${countsData.history_count}`);
      console.log(`   - Total today: ${countsData.today_orders_count}`);
      console.log(`   - Active tables: ${countsData.active_tables_count}`);
    }
    
    // Test 3: Check if the function exists and has proper permissions
    console.log('\n📊 Test 3: Checking function permissions...');
    const { data: funcData, error: funcError } = await supabase
      .from('information_schema.routines')
      .select('routine_name, routine_type, security_type')
      .eq('routine_name', 'dashboard_counts')
      .eq('routine_schema', 'public');
    
    if (funcError) {
      console.log('⚠️  Could not check function details');
    } else if (funcData && funcData.length > 0) {
      const func = funcData[0];
      console.log('✅ Function exists');
      console.log(`   - Name: ${func.routine_name}`);
      console.log(`   - Type: ${func.routine_type}`);
      console.log(`   - Security: ${func.security_type}`);
    } else {
      console.log('❌ Function not found');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testDashboardCounts();

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkOrders() {
  console.log('🔍 Checking recent orders and table assignments...');
  
  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, table_number, table_id, customer_name, order_status, payment_status, created_at, total_amount')
    .order('created_at', { ascending: false })
    .limit(10);
    
  if (error) {
    console.error('Error fetching orders:', error);
    return;
  }
  
  console.log('Recent orders:');
  orders?.forEach(order => {
    console.log(`- Order ${order.id.slice(-6)}: Table ${order.table_number} (table_id: ${order.table_id || 'null'}), Customer: ${order.customer_name || 'N/A'}, Status: ${order.order_status}/${order.payment_status}, Amount: £${(order.total_amount/100).toFixed(2)}, Created: ${order.created_at}`);
  });
  
  // Check for Counter 9 specifically
  const { data: counter9Orders, error: counter9Error } = await supabase
    .from('orders')
    .select('id, table_number, table_id, customer_name, order_status, payment_status, created_at, total_amount')
    .eq('table_number', 9)
    .order('created_at', { ascending: false })
    .limit(5);
    
  if (!counter9Error && counter9Orders?.length > 0) {
    console.log('\n🎯 Counter 9 orders found:');
    counter9Orders.forEach(order => {
      console.log(`- Order ${order.id.slice(-6)}: Customer: ${order.customer_name || 'N/A'}, Status: ${order.order_status}/${order.payment_status}, Amount: £${(order.total_amount/100).toFixed(2)}, Created: ${order.created_at}`);
    });
  } else {
    console.log('\n❌ No Counter 9 orders found');
  }
}

checkOrders().catch(console.error);
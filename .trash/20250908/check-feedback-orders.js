const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkFeedbackAndOrders() {
  console.log('🔍 Checking feedback and orders...');

  try {
    // Get all feedback entries
    const { data: feedback, error: feedbackError } = await supabase
      .from('feedback')
      .select('*')
      .order('created_at', { ascending: false });

    if (feedbackError) {
      console.error('❌ Error fetching feedback:', feedbackError.message);
      return;
    }

    console.log(`📊 Found ${feedback.length} feedback entries:`);
    feedback.forEach(f => {
      console.log(`  ${f.id}: ${f.customer_name} | ${f.rating}⭐ | Order: ${f.order_id || 'None'} | ${f.created_at}`);
    });

    // Get all orders
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id, customer_name, created_at, venue_id')
      .order('created_at', { ascending: false })
      .limit(10);

    if (ordersError) {
      console.error('❌ Error fetching orders:', ordersError.message);
      return;
    }

    console.log(`\n📊 Found ${orders.length} recent orders:`);
    orders.forEach(o => {
      console.log(`  ${o.id}: ${o.customer_name} | ${o.created_at} | Venue: ${o.venue_id}`);
    });

    // Try to match feedback to orders by date and venue
    console.log('\n🔗 Attempting to match feedback to orders...');
    
    for (const f of feedback) {
      if (!f.order_id) {
        console.log(`\n🔍 Looking for order for feedback ${f.id}...`);
        
        // Find orders from the same venue around the same time
        const feedbackDate = new Date(f.created_at);
        const startDate = new Date(feedbackDate.getTime() - 24 * 60 * 60 * 1000); // 24 hours before
        const endDate = new Date(feedbackDate.getTime() + 24 * 60 * 60 * 1000); // 24 hours after
        
        const { data: matchingOrders, error: matchError } = await supabase
          .from('orders')
          .select('id, customer_name, created_at')
          .eq('venue_id', f.venue_id)
          .gte('created_at', startDate.toISOString())
          .lte('created_at', endDate.toISOString())
          .order('created_at', { ascending: false });

        if (matchError) {
          console.log(`  ❌ Error finding matching orders: ${matchError.message}`);
          continue;
        }

        if (matchingOrders && matchingOrders.length > 0) {
          console.log(`  📋 Found ${matchingOrders.length} potential matching orders:`);
          matchingOrders.forEach(o => {
            console.log(`    ${o.id}: ${o.customer_name} | ${o.created_at}`);
          });

          // Use the most recent order as the match
          const bestMatch = matchingOrders[0];
          console.log(`  ✅ Best match: ${bestMatch.id} (${bestMatch.customer_name})`);

          // Update the feedback entry
          const { error: updateError } = await supabase
            .from('feedback')
            .update({
              order_id: bestMatch.id,
              customer_name: bestMatch.customer_name
            })
            .eq('id', f.id);

          if (updateError) {
            console.log(`  ❌ Error updating feedback: ${updateError.message}`);
          } else {
            console.log(`  ✅ Updated feedback ${f.id} with order ${bestMatch.id} and customer name ${bestMatch.customer_name}`);
          }
        } else {
          console.log(`  ⚠️  No matching orders found for feedback ${f.id}`);
        }
      }
    }

    // Show final results
    console.log('\n📊 Final feedback entries:');
    const { data: finalFeedback, error: finalError } = await supabase
      .from('feedback')
      .select('*')
      .order('created_at', { ascending: false });

    if (!finalError && finalFeedback) {
      finalFeedback.forEach(f => {
        console.log(`  ${f.id}: ${f.customer_name} | ${f.rating}⭐ | Order: ${f.order_id || 'None'}`);
      });
    }

  } catch (error) {
    console.error('❌ Check failed:', error.message);
    process.exit(1);
  }
}

// Run the check
checkFeedbackAndOrders();
